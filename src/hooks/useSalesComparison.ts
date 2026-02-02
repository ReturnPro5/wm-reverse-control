import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTabFilters, TabName } from '@/contexts/FilterContext';
import { Tables } from '@/integrations/supabase/types';
import { addWalmartChannel } from '@/lib/walmartChannel';
import { SalesRecordWithChannel } from './useFilteredData';

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
      const fetchPeriod = async (
        wmWeek: number | null, 
        yearConstraint?: { before?: string; after?: string }
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
          if (wmWeek === null && filters.wmWeeks.length > 0) {
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

      // Helper to format date as YYYY-MM-DD
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      const today = new Date();

      // For LW: Only look at recent data (last 60 days) to get the correct fiscal year's week
      const lwBeforeDate = new Date(today);
      const lwAfterDate = new Date(today);
      lwAfterDate.setDate(lwAfterDate.getDate() - 60);
      const lwBefore = formatDate(lwBeforeDate);
      const lwAfter = formatDate(lwAfterDate);

      // For TWLY: Look at data from approximately 1 year ago
      // Range: 9-15 months ago to capture the same week from last fiscal year
      const twlyBeforeDate = new Date(today);
      twlyBeforeDate.setMonth(twlyBeforeDate.getMonth() - 9);
      const twlyAfterDate = new Date(today);
      twlyAfterDate.setMonth(twlyAfterDate.getMonth() - 15);
      const twlyBefore = formatDate(twlyBeforeDate);
      const twlyAfter = formatDate(twlyAfterDate);

      // TW: Fetch ALL data (no week filter, or filtered by selected weeks if any)
      // LW/TWLY: Only fetch if a specific week is selected, with proper date constraints
      const [twRaw, lwRaw, twlyRaw] = await Promise.all([
        fetchPeriod(null), // TW = all data (respects wmWeeks filter if set)
        selectedWeek !== null ? fetchPeriod(lastWeek, { after: lwAfter, before: lwBefore }) : Promise.resolve([]),
        selectedWeek !== null ? fetchPeriod(selectedWeek, { after: twlyAfter, before: twlyBefore }) : Promise.resolve([]),
      ]);

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
