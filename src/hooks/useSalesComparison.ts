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

      // All periods need date constraints to prevent stacking data across fiscal years
      // TW: Current fiscal year only (last ~9 months from today to capture most recent data)
      // LW: Last ~3 months from max TW date
      // TWLY: 10-14 months ago to capture same week from last fiscal year
      
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      const today = new Date();
      
      // TW: Use the actual Walmart Fiscal Year start date (Saturday closest to Feb 1)
      // This ensures we only get current FY data, not stacking prior year sales
      const fiscalYearStart = getWMFiscalYearStart(today);
      const twAfter = formatDate(fiscalYearStart);
      
      const twRaw = await fetchPeriod(null, { after: twAfter }); // TW = current FY data only
      
      // Calculate date ranges based on actual data for LW and TWLY
      let lwRaw: Tables<'sales_metrics'>[] = [];
      let twlyRaw: Tables<'sales_metrics'>[] = [];
      
      if (selectedWeek !== null && twRaw.length > 0) {
        const maxDate = twRaw.reduce((max, r) => {
          const d = r.order_closed_date;
          return d > max ? d : max;
        }, twRaw[0].order_closed_date);
        
        const maxDateObj = new Date(maxDate);
        
        // LW: Look at data within current fiscal year context (last ~3 months from max date)
        // This prevents pulling in last year's same week number
        const lwBeforeDate = new Date(maxDateObj);
        lwBeforeDate.setDate(lwBeforeDate.getDate() + 7); // Include up to a week after max
        const lwAfterDate = new Date(maxDateObj);
        lwAfterDate.setMonth(lwAfterDate.getMonth() - 3); // ~3 months back
        const lwBefore = formatDate(lwBeforeDate);
        const lwAfter = formatDate(lwAfterDate);
        
        // TWLY: Look back ~1 year to capture the same calendar week from last year
        // Instead of matching wm_week (which resets each fiscal year), we match by 
        // date range: approximately 364 days before the current week's dates
        // This ensures Week 52 of FY26 compares to Week 52 of FY25
        
        // Calculate TWLY date range: 1 year ago from current week's start/end
        const twWeekStart = new Date(maxDateObj);
        twWeekStart.setDate(twWeekStart.getDate() - 6); // Approximate start of current week
        
        const twlyStartDate = new Date(twWeekStart);
        twlyStartDate.setFullYear(twlyStartDate.getFullYear() - 1);
        twlyStartDate.setDate(twlyStartDate.getDate() - 3); // Buffer for week alignment
        
        const twlyEndDate = new Date(maxDateObj);
        twlyEndDate.setFullYear(twlyEndDate.getFullYear() - 1);
        twlyEndDate.setDate(twlyEndDate.getDate() + 4); // Buffer for week alignment
        
        const twlyAfter = formatDate(twlyStartDate);
        const twlyBefore = formatDate(twlyEndDate);
        
        // Fetch LW and TWLY in parallel with proper date constraints
        // TWLY: Don't filter by wm_week since week numbers differ across fiscal years
        [lwRaw, twlyRaw] = await Promise.all([
          fetchPeriod(lastWeek, { after: lwAfter, before: lwBefore }),
          fetchPeriod(null, { after: twlyAfter, before: twlyBefore }), // null = no week filter
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
