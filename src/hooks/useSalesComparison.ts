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
 * - LW (Last Week): The week before TW (wmWeek - 1)
 * - TWLY (This Week Last Year): Same week number from prior year (wmWeek from 52 weeks ago)
 */
export function useSalesComparison(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);

  // Derive comparison weeks from selected wmWeeks
  // If multiple weeks selected, use the first one as "this week"
  const selectedWeek = filters.wmWeeks.length > 0 ? Math.max(...filters.wmWeeks) : null;
  const lastWeek = selectedWeek !== null ? selectedWeek - 1 : null;
  // TWLY: same week number but 52 weeks earlier
  // In Walmart fiscal calendar, this approximates "this week last year"
  const thisWeekLastYear = selectedWeek !== null ? selectedWeek - 52 : null;

  const filterKey = JSON.stringify({
    selectedWeek,
    lastWeek,
    thisWeekLastYear,
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
    }> => {
      // If no week selected, return empty data
      if (selectedWeek === null) {
        return { tw: [], lw: [], twly: [], selectedWeek: null };
      }

      // Fetch data for all three periods in parallel
      const fetchPeriod = async (wmWeek: number | null): Promise<Tables<'sales_metrics'>[]> => {
        if (wmWeek === null) return [];
        
        const allData: Tables<'sales_metrics'>[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          let query = supabase
            .from('sales_metrics')
            .select('*')
            .eq('wm_week', wmWeek)
            .eq('tag_clientsource', 'WMUS')
            .neq('marketplace_profile_sold_on', 'Transfer')
            .gt('sale_price', 0);

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

      const [twRaw, lwRaw, twlyRaw] = await Promise.all([
        fetchPeriod(selectedWeek),
        fetchPeriod(lastWeek),
        fetchPeriod(thisWeekLastYear),
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
      };
    },
  });
}
