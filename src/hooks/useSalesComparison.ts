import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTabFilters, TabName } from '@/contexts/FilterContext';
import { Tables } from '@/integrations/supabase/types';
import { addWalmartChannel, filterByWalmartChannel } from '@/lib/walmartChannel';
import { SalesRecordWithChannel } from './useFilteredData';
import { getWMFiscalYearStart } from '@/lib/wmWeek';

/**
 * Hook to fetch sales data for TW, LW, and TWLY comparison.
 * 
 * CRITICAL: TW query MUST use IDENTICAL logic to useFilteredSales to ensure
 * the TW column always matches the KPI cards exactly.
 * 
 * - TW (This Week): The currently selected WM Week(s) - matches KPI cards exactly
 * - LW (Last Week): The week before (wmWeek - 1, or 52/53 if crossing year boundary)
 * - TWLY (This Week Last Year): Entire previous fiscal year for true YoY comparison
 */
export function useSalesComparison(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);

  // Derive comparison weeks from selected wmWeeks
  // If multiple weeks selected, use the highest one for LW calculation
  const selectedWeek = filters.wmWeeks.length > 0 ? Math.max(...filters.wmWeeks) : null;
  
  // LW: the week before. Handle wrap-around at year boundary.
  const lastWeek = selectedWeek !== null 
    ? (selectedWeek === 1 ? 52 : selectedWeek - 1) 
    : null;

  const filterKey = JSON.stringify({
    wmWeeks: filters.wmWeeks, // Use full array, not just selectedWeek
    wmDaysOfWeek: filters.wmDaysOfWeek,
    lastWeek,
    programNames: filters.programNames,
    masterProgramNames: filters.masterProgramNames,
    facilities: filters.facilities,
    categoryNames: filters.categoryNames,
    tagClientOwnerships: filters.tagClientOwnerships,
    marketplacesSoldOn: filters.marketplacesSoldOn,
    orderTypesSoldOn: filters.orderTypesSoldOn,
    locationIds: filters.locationIds,
    excludedFileIds: filters.excludedFileIds,
    walmartChannels: filters.walmartChannels,
  });

  return useQuery({
    queryKey: ['sales-comparison', tabName, filterKey],
    staleTime: 0,
    queryFn: async (): Promise<{
      tw: SalesRecordWithChannel[];
      lw: SalesRecordWithChannel[];
      twly: SalesRecordWithChannel[];
      selectedWeek: number | null;
      lastWeek: number | null;
    }> => {
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      
      /**
       * CRITICAL: This function MUST match useFilteredData.ts applyFilters() EXACTLY.
       * Any deviation causes KPI cards and TW column to diverge.
       * 
       * Filters applied (in same order as useFilteredData.ts):
       * 1. wmDaysOfWeek (wmWeeks applied separately in fetchAllPages)
       * 2. programNames
       * 3. facilities
       * 4. categoryNames
       * 5. tagClientOwnerships
       * 6. tag_clientsource = 'WMUS' (always)
       * 7. marketplacesSoldOn
       * 8. orderTypesSoldOn
       * 9. locationIds
       * 10. Exclude transfers and $0 sales
       * 
       * NOTE: Fiscal year boundary filter REMOVED - it was incorrectly excluding
       * January weeks (like WK52) that fall before the Feb 1 fiscal year start.
       */
      const applyAllFilters = (query: any) => {
        // Data filters - use .in() for arrays (matches useFilteredSales applyFilters)
        if (filters.wmDaysOfWeek.length > 0) {
          query = query.in('wm_day_of_week', filters.wmDaysOfWeek);
        }
        if (filters.programNames.length > 0) {
          query = query.in('program_name', filters.programNames);
        }
        if (filters.facilities.length > 0) {
          query = query.in('facility', filters.facilities);
        }
        if (filters.categoryNames.length > 0) {
          query = query.in('category_name', filters.categoryNames);
        }
        if (filters.tagClientOwnerships.length > 0) {
          query = query.in('tag_client_ownership', filters.tagClientOwnerships);
        }
        // WMUS exclusive - always filter to WMUS only
        query = query.eq('tag_clientsource', 'WMUS');
        if (filters.marketplacesSoldOn.length > 0) {
          query = query.in('marketplace_profile_sold_on', filters.marketplacesSoldOn);
        }
        if (filters.orderTypesSoldOn.length > 0) {
          query = query.in('order_type_sold_on', filters.orderTypesSoldOn);
        }
        if (filters.locationIds.length > 0) {
          query = query.in('location_id', filters.locationIds);
        }
        
        // Exclude transfers and $0 sales (matches useFilteredSales)
        query = query.neq('marketplace_profile_sold_on', 'Transfer');
        query = query.gt('sale_price', 0);
        
        return query;
      };
      
      // Paginated fetch helper with client-side filtering
      const fetchAllPages = async (
        additionalFilters: (q: any) => any
      ): Promise<Tables<'sales_metrics'>[]> => {
        const allData: Tables<'sales_metrics'>[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          let query = supabase.from('sales_metrics').select('*');
          query = applyAllFilters(query);
          query = additionalFilters(query);
          query = query.range(from, from + pageSize - 1);

          const { data, error } = await query;
          if (error) throw error;
          if (!data || data.length === 0) break;
          
          allData.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        // Client-side filtering: excluded files and owned programs (matches useFilteredSales)
        let filtered = allData.filter(row => 
          !row.file_upload_id || !filters.excludedFileIds.includes(row.file_upload_id)
        );
        filtered = filtered.filter(row => {
          const masterProgram = row.master_program_name?.toLowerCase() || '';
          return !masterProgram.includes('owned');
        });

        return filtered;
      };

      /**
       * TW: Fetch data for selected WM Week(s).
       * NO fiscal year boundary filter - the wmWeeks filter is sufficient.
       */
      const twRaw = await fetchAllPages(q => {
        if (filters.wmWeeks.length > 0) {
          return q.in('wm_week', filters.wmWeeks);
        }
        return q;
      });

      // Calculate LW and TWLY only if we have TW data
      let lwRaw: Tables<'sales_metrics'>[] = [];
      let twlyRaw: Tables<'sales_metrics'>[] = [];

      if (twRaw.length > 0) {
        // Derive the week for LW calculation from selected weeks or data
        const derivedWeek = selectedWeek ?? twRaw.reduce((max, r) => {
          const w = r.wm_week ?? 0;
          return w > max ? w : max;
        }, 0);
        
        const derivedLastWeek = derivedWeek === 1 ? 52 : derivedWeek - 1;

        // Get max date from TW data for LW date constraints
        const maxDate = twRaw.reduce((max, r) => {
          const d = r.order_closed_date;
          return d > max ? d : max;
        }, twRaw[0].order_closed_date);
        
        const maxDateObj = new Date(maxDate + 'T12:00:00');

        // LW: Previous week with date constraints to avoid prior year overlap
        const lwBeforeDate = new Date(maxDateObj);
        lwBeforeDate.setDate(lwBeforeDate.getDate() + 7);
        const lwAfterDate = new Date(maxDateObj);
        lwAfterDate.setMonth(lwAfterDate.getMonth() - 3);
        
        // TWLY: Entire previous fiscal year
        const currentFYStart = getWMFiscalYearStart(maxDateObj);
        const dateInPriorFY = new Date(currentFYStart);
        dateInPriorFY.setMonth(dateInPriorFY.getMonth() - 6);
        const priorFYStart = getWMFiscalYearStart(dateInPriorFY);
        const priorFYEnd = new Date(currentFYStart);
        priorFYEnd.setDate(priorFYEnd.getDate() - 1);

        // Fetch LW and TWLY in parallel
        [lwRaw, twlyRaw] = await Promise.all([
          fetchAllPages(q => q
            .in('wm_week', [derivedLastWeek])
            .gte('order_closed_date', formatDate(lwAfterDate))
            .lt('order_closed_date', formatDate(lwBeforeDate))
          ),
          fetchAllPages(q => q
            .gte('order_closed_date', formatDate(priorFYStart))
            .lt('order_closed_date', formatDate(priorFYEnd))
          ),
        ]);
      }

      // Add walmart channel to each record
      const twWithChannel = addWalmartChannel(twRaw);
      const lwWithChannel = addWalmartChannel(lwRaw);
      const twlyWithChannel = addWalmartChannel(twlyRaw);

      // Apply walmart channel filter if set (matches useFilteredSales)
      const tw = filterByWalmartChannel(twWithChannel, filters.walmartChannels);
      const lw = filterByWalmartChannel(lwWithChannel, filters.walmartChannels);
      const twly = filterByWalmartChannel(twlyWithChannel, filters.walmartChannels);

      return {
        tw,
        lw,
        twly,
        selectedWeek,
        lastWeek,
      };
    },
  });
}
