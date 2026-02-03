import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTabFilters, TabName } from '@/contexts/FilterContext';
import { Tables } from '@/integrations/supabase/types';
import { addWalmartChannel } from '@/lib/walmartChannel';
import { SalesRecordWithChannel } from './useFilteredData';
import { getWMFiscalYearStart } from '@/lib/wmWeek';

/**
 * Hook to fetch sales data for TW, LW, and TWLY comparison.
 * 
 * - TW (This Week): The currently selected WM Week
 * - LW (Last Week): The week before TW (wmWeek - 1, or 52/53 if crossing year boundary)
 * - TWLY (This Week Last Year): Same week number but from records dated ~1 year ago
 */
export function useSalesComparison(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);

  // Derive comparison weeks from selected wmWeeks
  // If multiple weeks selected, use the highest one as "this week"
  const selectedWeek = filters.wmWeeks.length > 0 ? Math.max(...filters.wmWeeks) : null;
  
  // LW: the week before. Handle wrap-around at year boundary.
  // Week 1 -> LW is week 52 (or 53) from previous fiscal year
  const lastWeek = selectedWeek !== null 
    ? (selectedWeek === 1 ? 52 : selectedWeek - 1) 
    : null;
  
  // TWLY: Same week number, but we need to query by date range for the prior year
  // Since wm_week resets each fiscal year, week 52 of this year and last year 
  // both have wm_week = 52. We'll use the order_closed_date to distinguish.
  const thisWeekLastYearNumber = selectedWeek;

  const filterKey = JSON.stringify({
    selectedWeek,
    lastWeek,
    thisWeekLastYearNumber,
    programNames: filters.programNames,
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
      // Helper to fetch data with optional week constraint
      // skipWmWeekFilter: when true, don't apply any wmWeek filtering (used for TWLY date-based queries)
      const fetchPeriod = async (
        wmWeek: number | null, 
        yearConstraint?: { before?: string; after?: string },
        skipWmWeekFilter: boolean = false
      ): Promise<Tables<'sales_metrics'>[]> => {
        const allData: Tables<'sales_metrics'>[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          let query = supabase
            .from('sales_metrics')
            .select('*')
            .eq('tag_clientsource', 'WMUS')
            .neq('marketplace_profile_sold_on', 'Transfer')
            .gt('sale_price', 0);

          // Only filter by week if a specific week is provided
          if (wmWeek !== null && wmWeek > 0) {
            query = query.eq('wm_week', wmWeek);
          }

          // Apply year constraints for TWLY
          if (yearConstraint?.before) {
            query = query.lt('order_closed_date', yearConstraint.before);
          }
          if (yearConstraint?.after) {
            query = query.gte('order_closed_date', yearConstraint.after);
          }

          // Apply additional filters
          if (filters.programNames.length > 0) {
            query = query.in('program_name', filters.programNames);
          }
          if (filters.facilities.length > 0) {
            query = query.in('facility', filters.facilities);
          }
          if (filters.categoryNames.length > 0) {
            query = query.in('category_name', filters.categoryNames);
          }
          if (filters.marketplacesSoldOn.length > 0) {
            query = query.in('marketplace_profile_sold_on', filters.marketplacesSoldOn);
          }
          if (filters.orderTypesSoldOn.length > 0) {
            query = query.in('order_type_sold_on', filters.orderTypesSoldOn);
          }
          
          // Apply WM Week filter if set (for TW - all selected weeks)
          // Skip this for TWLY queries which use date-based filtering instead
          if (!skipWmWeekFilter && wmWeek === null && filters.wmWeeks.length > 0) {
            query = query.in('wm_week', filters.wmWeeks);
          }

          query = query.range(from, from + pageSize - 1);

          const { data, error } = await query;
          if (error) throw error;

          if (!data || data.length === 0) break;
          allData.push(...data);

          if (data.length < pageSize) break;
          from += pageSize;
        }

        // Filter excluded files and owned programs
        let filtered = allData.filter(row => 
          !row.file_upload_id || !filters.excludedFileIds.includes(row.file_upload_id)
        );
        filtered = filtered.filter(row => {
          const masterProgram = row.master_program_name?.toLowerCase() || '';
          return !masterProgram.includes('owned');
        });

        return filtered;
      };

      // All periods need date constraints to prevent stacking data across fiscal years
      // First, fetch a small sample to determine the actual date range of the data
      // Then use that to calculate proper fiscal year boundaries
      
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      
      // First, get a sample of recent data to determine the actual fiscal year context
      // We query without date constraints first to find the max date in the dataset
      const { data: sampleData } = await supabase
        .from('sales_metrics')
        .select('order_closed_date')
        .eq('tag_clientsource', 'WMUS')
        .neq('marketplace_profile_sold_on', 'Transfer')
        .gt('sale_price', 0)
        .order('order_closed_date', { ascending: false })
        .limit(1);
      
      // Determine the fiscal year based on actual data, not system date
      // Parse date with time to avoid timezone issues (add noon time)
      const maxDataDate = sampleData && sampleData.length > 0 
        ? new Date(sampleData[0].order_closed_date + 'T12:00:00')
        : new Date();
      
      // TW: Use the actual Walmart Fiscal Year start date based on the data's max date
      const fiscalYearStart = getWMFiscalYearStart(maxDataDate);
      const twAfter = formatDate(fiscalYearStart);
      
      // TW: Fetch data for selected weeks only (matching KPI cards behavior)
      // If wmWeeks filter is set, use the selected week; otherwise use the derived week from data
      const twWeekToQuery = selectedWeek;
      const twRaw = twWeekToQuery 
        ? await fetchPeriod(twWeekToQuery, { after: twAfter }, true) // Explicitly query the selected week
        : await fetchPeriod(null, { after: twAfter }, false); // No week selected = all current FY data
      
      // Calculate date ranges based on actual data for LW and TWLY
      let lwRaw: Tables<'sales_metrics'>[] = [];
      let twlyRaw: Tables<'sales_metrics'>[] = [];
      
      if (twRaw.length > 0) {
        // Get max date and max week from TW data to determine comparison periods
        const maxDate = twRaw.reduce((max, r) => {
          const d = r.order_closed_date;
          return d > max ? d : max;
        }, twRaw[0].order_closed_date);
        
        // Derive the actual current week from data if none selected
        const derivedWeek = selectedWeek ?? twRaw.reduce((max, r) => {
          const w = r.wm_week ?? 0;
          return w > max ? w : max;
        }, 0);
        
        // LW: the week before the derived week
        const derivedLastWeek = derivedWeek === 1 ? 52 : derivedWeek - 1;
        
        const maxDateObj = new Date(maxDate);
        
        // LW: Look at data within current fiscal year context (last ~3 months from max date)
        // This prevents pulling in last year's same week number
        const lwBeforeDate = new Date(maxDateObj);
        lwBeforeDate.setDate(lwBeforeDate.getDate() + 7); // Include up to a week after max
        const lwAfterDate = new Date(maxDateObj);
        lwAfterDate.setMonth(lwAfterDate.getMonth() - 3); // ~3 months back
        const lwBefore = formatDate(lwBeforeDate);
        const lwAfter = formatDate(lwAfterDate);
        
        // TWLY: Capture the ENTIRE previous fiscal year for year-over-year comparison
        // TW shows current FY aggregate, so TWLY should show prior FY aggregate
        // Calculate previous fiscal year boundaries
        const currentFYStart = getWMFiscalYearStart(maxDateObj);
        
        // Get the previous fiscal year start (use a date from ~13 months ago)
        const dateInPriorFY = new Date(currentFYStart);
        dateInPriorFY.setMonth(dateInPriorFY.getMonth() - 6); // Go back 6 months into prior FY
        const priorFYStart = getWMFiscalYearStart(dateInPriorFY);
        
        // Prior FY ends the day before current FY starts
        const priorFYEnd = new Date(currentFYStart);
        priorFYEnd.setDate(priorFYEnd.getDate() - 1);
        
        const twlyAfter = formatDate(priorFYStart);
        const twlyBefore = formatDate(priorFYEnd);
        
        // Fetch LW and TWLY in parallel with proper date constraints
        // TWLY: Don't filter by wm_week since week numbers differ across fiscal years
        // Pass skipWmWeekFilter=true for TWLY to prevent applying selected wmWeeks filter
        [lwRaw, twlyRaw] = await Promise.all([
          fetchPeriod(derivedLastWeek, { after: lwAfter, before: lwBefore }, false),
          fetchPeriod(null, { after: twlyAfter, before: twlyBefore }, true), // skipWmWeekFilter=true
        ]);
      }

      // Add walmart channel to each record
      const tw = addWalmartChannel(twRaw);
      const lw = addWalmartChannel(lwRaw);
      const twly = addWalmartChannel(twlyRaw);

      // Apply walmart channel filter if set
      const applyChannelFilter = (data: SalesRecordWithChannel[]) => {
        if (filters.walmartChannels.length === 0) return data;
        return data.filter(r => filters.walmartChannels.includes(r.walmartChannel));
      };

      return {
        tw: applyChannelFilter(tw),
        lw: applyChannelFilter(lw),
        twly: applyChannelFilter(twly),
        selectedWeek,
        lastWeek,
      };
    },
  });
}
