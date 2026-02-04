import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTabFilters, TabFilters, TabName } from '@/contexts/FilterContext';
import { Tables } from '@/integrations/supabase/types';
import { getWMWeekNumber, getWMDayOfWeek, getWMFiscalYearStart } from '@/lib/wmWeek';
import { filterByWalmartChannel, addWalmartChannel, WalmartChannel } from '@/lib/walmartChannel';

// Calculate WM week from a date string (YYYY-MM-DD)
function getWMWeekFromDateString(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return getWMWeekNumber(date);
}

// Calculate WM day of week from a date string (YYYY-MM-DD)
// Returns 1-7 (Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, Thu=6, Fri=7)
function getWMDayOfWeekFromDateString(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return getWMDayOfWeek(date);
}

// Build a Supabase query with all global filters applied (multi-select arrays)
// NOTE: skipWmWeeks also skips wmDaysOfWeek since both are date-dependent
function applyFilters<T extends { eq: any; not: any; in: any }>(
  query: T,
  filters: TabFilters,
  options: { skipWmWeeks?: boolean } = {},
): T {
  // Data filters - use .in() for arrays
  // When skipWmWeeks is true, we skip both wm_week and wm_day_of_week 
  // because these should be calculated from the relevant date field client-side
  if (!options.skipWmWeeks && filters.wmWeeks.length > 0) {
    query = query.in('wm_week', filters.wmWeeks);
  }
  if (!options.skipWmWeeks && filters.wmDaysOfWeek.length > 0) {
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
  // WMUS exclusive - always filter to WMUS only, ignore tagClientSources filter
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
  
  return query;
}

// Filter results client-side for excluded files
function filterExcludedFiles<T extends { file_upload_id?: string | null }>(
  data: T[] | null,
  excludedFileIds: string[]
): T[] {
  if (!data) return [];
  if (excludedFileIds.length === 0) return data;
  return data.filter(row => !row.file_upload_id || !excludedFileIds.includes(row.file_upload_id));
}

// Filter out "owned" programs from sales data (master_program_name contains "owned")
function filterOwnedPrograms<T extends { master_program_name?: string | null }>(
  data: T[]
): T[] {
  return data.filter(row => {
    const masterProgram = row.master_program_name?.toLowerCase() || '';
    return !masterProgram.includes('owned');
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options-global'],
    staleTime: 5 * 60 * 1000, // 5 minutes - matches other queries
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Use optimized RPC that gets all distinct values in a single query
      const { data, error } = await supabase.rpc('get_filter_options');
      
      if (error) throw error;
      
      // Parse the JSON response
      const options = data as {
        programs: string[];
        masterPrograms: string[];
        categories: string[];
        facilities: string[];
        locations: string[];
        ownerships: string[];
        clientSources: string[];
        marketplaces: string[];
        fileTypes: string[];
        orderTypes: string[];
      };

      return {
        programs: options.programs || [],
        masterPrograms: options.masterPrograms || [],
        categories: options.categories || [],
        facilities: options.facilities || [],
        locations: options.locations || [],
        ownerships: options.ownerships || [],
        clientSources: options.clientSources || [],
        marketplaces: options.marketplaces || [],
        fileTypes: options.fileTypes || [],
        orderTypes: options.orderTypes || [],
      };
    },
  });
}

export function useFilteredLifecycle(tabName: TabName = 'inbound') {
  const { filters } = useTabFilters(tabName);

  // Create a stable query key from filter values
  const filterKey = JSON.stringify({
    wmWeeks: filters.wmWeeks,
    wmDaysOfWeek: filters.wmDaysOfWeek,
    programNames: filters.programNames,
    facilities: filters.facilities,
    categoryNames: filters.categoryNames,
    tagClientOwnerships: filters.tagClientOwnerships,
    excludedFileIds: filters.excludedFileIds,
  });

  return useQuery({
    queryKey: ['filtered-lifecycle-inbound-only', tabName, filterKey],
    staleTime: 0,
    queryFn: async () => {
      // ALWAYS get only Inbound file IDs - lifecycle funnel is ONLY for Inbound files
      const { data: inboundFiles, error: filesError } = await supabase
        .from('file_uploads')
        .select('id')
        .eq('file_type', 'Inbound');
      
      if (filesError) throw filesError;
      const inboundFileIds = inboundFiles?.map(f => f.id) || [];
      
      // Filter out excluded files from inbound file IDs
      const activeInboundFileIds = inboundFileIds.filter(id => !filters.excludedFileIds.includes(id));
      
      // Fetch units_canonical ONLY from Inbound files - WITHOUT wm_week filter at DB level
      // We'll calculate WM week per stage date client-side
      type UnitRow = { 
        trgid: string; 
        received_on: string | null; 
        checked_in_on: string | null; 
        tested_on: string | null; 
        first_listed_date: string | null; 
        order_closed_date: string | null; 
        file_upload_id: string | null;
        tag_clientsource: string | null;
      };
      const unitsData: UnitRow[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      if (activeInboundFileIds.length > 0) {
        while (true) {
          let query = supabase
            .from('units_canonical')
            .select('trgid, received_on, checked_in_on, tested_on, first_listed_date, order_closed_date, file_upload_id, tag_clientsource')
            .in('file_upload_id', activeInboundFileIds)
            .order('trgid', { ascending: true }); // Consistent ordering for pagination
          
          // Apply filters EXCEPT wmWeeks - we handle that per-stage-date
          query = applyFilters(query, filters, { skipWmWeeks: true });
          query = query.range(offset, offset + batchSize - 1);
          
          const { data, error } = await query;
          if (error) throw error;
          if (!data || data.length === 0) break;
          
          unitsData.push(...data);
          if (data.length < batchSize) break;
          offset += batchSize;
        }
      }
      
      const filteredUnits = filterExcludedFiles(unitsData, filters.excludedFileIds);
      
      // For each stage, dedupe by trgid and filter by WM week AND day of that stage's date
      const selectedWeeks = filters.wmWeeks;
      const selectedDays = filters.wmDaysOfWeek;
      const hasWeekFilter = selectedWeeks.length > 0;
      const hasDayFilter = selectedDays.length > 0;
      
      // Helper: check if a date matches BOTH week and day filters (calculated from the date)
      const matchesDateFilters = (dateStr: string | null): boolean => {
        if (!dateStr) return false; // No date = can't match
        
        // Check week filter if active
        if (hasWeekFilter) {
          const wmWeek = getWMWeekFromDateString(dateStr);
          if (wmWeek === null || !selectedWeeks.includes(wmWeek)) return false;
        }
        
        // Check day-of-week filter if active
        if (hasDayFilter) {
          const wmDay = getWMDayOfWeekFromDateString(dateStr);
          if (wmDay === null || !selectedDays.includes(wmDay)) return false;
        }
        
        // If no filters are active, include all (but date must exist)
        return true;
      };
      
      // Deduplicate by trgid for each stage, filtered by that stage's date
      const receivedTrgids = new Set<string>();
      const checkedInTrgids = new Set<string>();
      const testedTrgids = new Set<string>();
      const listedTrgids = new Set<string>();
      const soldTrgids = new Set<string>();
      
      filteredUnits.forEach(unit => {
        // Each stage checks if its own date matches the filters
        if (unit.received_on && matchesDateFilters(unit.received_on)) {
          receivedTrgids.add(unit.trgid);
        }
        if (unit.checked_in_on && matchesDateFilters(unit.checked_in_on)) {
          checkedInTrgids.add(unit.trgid);
        }
        if (unit.tested_on && matchesDateFilters(unit.tested_on)) {
          testedTrgids.add(unit.trgid);
        }
        if (unit.first_listed_date && matchesDateFilters(unit.first_listed_date)) {
          listedTrgids.add(unit.trgid);
        }
        if (unit.order_closed_date && matchesDateFilters(unit.order_closed_date)) {
          soldTrgids.add(unit.trgid);
        }
      });
      
      const counts: Record<string, number> = {
        Received: receivedTrgids.size,
        CheckedIn: checkedInTrgids.size,
        Tested: testedTrgids.size,
        Listed: listedTrgids.size,
        Sold: soldTrgids.size,
      };

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      
      return Object.entries(counts).map(([stage, count]) => ({
        stage,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));
    },
  });
}

export type SalesRecordWithChannel = Tables<'sales_metrics'> & { walmartChannel: WalmartChannel };

export function useFilteredSales(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);

  // Create a stable query key from filter values to ensure proper cache invalidation
  const filterKey = JSON.stringify({
    wmWeeks: filters.wmWeeks,
    wmDaysOfWeek: filters.wmDaysOfWeek,
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
    queryKey: ['filtered-sales', tabName, filterKey],
    staleTime: 0, // Always refetch when filters change
    queryFn: async () => {
      // Fetch all records using pagination to bypass 1000 row limit
      const allData: Tables<'sales_metrics'>[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        let query = supabase.from('sales_metrics').select('*');
        query = applyFilters(query, filters);
        // Exclude transfers and $0 sales for accurate unit counts
        query = query.neq('marketplace_profile_sold_on', 'Transfer');
        query = query.gt('sale_price', 0);
        // CRITICAL: ORDER BY is required for consistent pagination results
        // Without it, the same row can appear in multiple pages or be skipped entirely
        query = query.order('id', { ascending: true });
        query = query.range(from, from + pageSize - 1);
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) break;
        allData.push(...data);
        
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      // Filter out excluded files and "owned" programs
      const filteredByFiles = filterExcludedFiles(allData, filters.excludedFileIds);
      const filteredNoOwned = filterOwnedPrograms(filteredByFiles);
      
      // Apply Walmart Channel filter (Sales tabs only)
      const filteredByChannel = filterByWalmartChannel(filteredNoOwned, filters.walmartChannels);
      
      // Add derived walmartChannel to each record for use in visualizations
      return addWalmartChannel(filteredByChannel);
    },
  });
}

export function useFilteredFees(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);

  const filterKey = JSON.stringify({
    wmWeeks: filters.wmWeeks,
    programNames: filters.programNames,
    facilities: filters.facilities,
    excludedFileIds: filters.excludedFileIds,
  });

  return useQuery({
    queryKey: ['filtered-fees', tabName, filterKey],
    staleTime: 0,
    queryFn: async () => {
      let query = supabase.from('fee_metrics').select('*');
      
      if (filters.wmWeeks.length > 0) {
        query = query.in('wm_week', filters.wmWeeks);
      }
      if (filters.programNames.length > 0) {
        query = query.in('program_name', filters.programNames);
      }
      if (filters.facilities.length > 0) {
        query = query.in('facility', filters.facilities);
      }
      // Note: fee_metrics doesn't have tag_clientsource column, WMUS filter applied at data source level
      
      const { data, error } = await query;
      if (error) throw error;
      
      return filterExcludedFiles(data, filters.excludedFileIds);
    },
  });
}

export function useFilteredLifecycleEvents(tabName: TabName = 'inbound') {
  const { filters } = useTabFilters(tabName);

  const filterKey = JSON.stringify({
    wmWeeks: filters.wmWeeks,
    wmDaysOfWeek: filters.wmDaysOfWeek,
    excludedFileIds: filters.excludedFileIds,
  });

  return useQuery({
    queryKey: ['filtered-lifecycle-events', tabName, filterKey],
    staleTime: 0,
    queryFn: async () => {
      let query = supabase.from('lifecycle_events').select('*');
      
      if (filters.wmWeeks.length > 0) {
        query = query.in('wm_week', filters.wmWeeks);
      }
      if (filters.wmDaysOfWeek.length > 0) {
        query = query.in('wm_day_of_week', filters.wmDaysOfWeek);
      }
      
      const { data, error } = await query.order('event_date', { ascending: false });
      if (error) throw error;
      
      return filterExcludedFiles(data, filters.excludedFileIds);
    },
  });
}

export function useFileUploads(tabName: TabName = 'inbound') {
  const { filters } = useTabFilters(tabName);

  return useQuery({
    queryKey: ['file-uploads-all', tabName, filters.fileTypes],
    queryFn: async () => {
      let query = supabase
        .from('file_uploads')
        .select('*')
        .order('upload_timestamp', { ascending: false });

      if (filters.fileTypes.length > 0) {
        query = query.in('file_type', filters.fileTypes as ('Sales' | 'Inbound' | 'Outbound' | 'Inventory' | 'Unknown')[]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useFilteredWeeklyTrends(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);

  const filterKey = JSON.stringify({
    wmWeeks: filters.wmWeeks,
    programNames: filters.programNames,
    facilities: filters.facilities,
    excludedFileIds: filters.excludedFileIds,
  });

  return useQuery({
    queryKey: ['filtered-weekly-trends', tabName, filterKey],
    staleTime: 0,
    queryFn: async () => {
      // Fetch all records using pagination
      type TrendRow = { wm_week: number | null; gross_sale: number; effective_retail: number | null; file_upload_id: string | null; master_program_name: string | null };
      const allData: TrendRow[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        let query = supabase
          .from('sales_metrics')
          .select('wm_week, gross_sale, effective_retail, file_upload_id, tag_clientsource, master_program_name')
          .not('wm_week', 'is', null)
          .eq('tag_clientsource', 'WMUS'); // WMUS exclusive
        
        if (filters.programNames.length > 0) {
          query = query.in('program_name', filters.programNames);
        }
        if (filters.facilities.length > 0) {
          query = query.in('facility', filters.facilities);
        }
        
        query = query.range(from, from + pageSize - 1).order('wm_week', { ascending: true });
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) break;
        allData.push(...data);
        
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const filtered = filterExcludedFiles(allData, filters.excludedFileIds);
      // Also filter out "owned" programs for weekly trends
      const filteredNoOwned = filterOwnedPrograms(filtered);
      
      const weeklyData: Record<number, { grossSales: number; effectiveRetail: number; count: number }> = {};
      
      filteredNoOwned.forEach(row => {
        const week = row.wm_week!;
        if (!weeklyData[week]) {
          weeklyData[week] = { grossSales: 0, effectiveRetail: 0, count: 0 };
        }
        weeklyData[week].grossSales += Number(row.gross_sale) || 0;
        weeklyData[week].effectiveRetail += Number(row.effective_retail) || 0;
        weeklyData[week].count++;
      });

      return Object.entries(weeklyData)
        .map(([week, data]) => ({
          week: parseInt(week),
          grossSales: data.grossSales,
          effectiveRetail: data.effectiveRetail,
          recoveryRate: data.effectiveRetail > 0 ? (data.grossSales / data.effectiveRetail) * 100 : 0,
          unitsCount: data.count,
        }))
        .slice(-12);
    },
  });
}
