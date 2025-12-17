import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTabFilters, TabFilters, TabName } from '@/contexts/FilterContext';
import { Tables } from '@/integrations/supabase/types';
import { getWMWeekNumber } from '@/lib/wmWeek';

// Calculate WM week from a date string (YYYY-MM-DD)
function getWMWeekFromDateString(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return getWMWeekNumber(date);
}

// Build a Supabase query with all global filters applied (multi-select arrays)
// NOTE: This does NOT apply wmWeeks filter - that's handled per-date-field for lifecycle
function applyFilters<T extends { eq: any; not: any; in: any }>(
  query: T,
  filters: TabFilters,
  options: { skipWmWeeks?: boolean } = {},
): T {
  // Data filters - use .in() for arrays
  if (!options.skipWmWeeks && filters.wmWeeks.length > 0) {
    query = query.in('wm_week', filters.wmWeeks);
  }
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
  if (filters.tagClientSources.length > 0) {
    query = query.in('tag_clientsource', filters.tagClientSources);
  }
  if (filters.marketplacesSoldOn.length > 0) {
    query = query.in('marketplace_profile_sold_on', filters.marketplacesSoldOn);
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

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options-global'],
    queryFn: async () => {
      const [
        programs,
        masterPrograms,
        categories,
        facilities,
        locations,
        ownerships,
        clientSources,
        marketplaces,
        fileTypes,
      ] = await Promise.all([
        supabase.from('units_canonical').select('program_name').not('program_name', 'is', null),
        supabase.from('units_canonical').select('master_program_name').not('master_program_name', 'is', null),
        supabase.from('units_canonical').select('category_name').not('category_name', 'is', null),
        supabase.from('units_canonical').select('facility').not('facility', 'is', null),
        supabase.from('units_canonical').select('location_id').not('location_id', 'is', null),
        supabase.from('units_canonical').select('tag_client_ownership').not('tag_client_ownership', 'is', null),
        supabase.from('units_canonical').select('tag_clientsource').not('tag_clientsource', 'is', null),
        supabase.from('sales_metrics').select('marketplace_profile_sold_on').not('marketplace_profile_sold_on', 'is', null),
        supabase.from('file_uploads').select('file_type'),
      ]);

      return {
        programs: [...new Set(programs.data?.map(r => r.program_name).filter(Boolean) || [])] as string[],
        masterPrograms: [...new Set(masterPrograms.data?.map(r => r.master_program_name).filter(Boolean) || [])] as string[],
        categories: [...new Set(categories.data?.map(r => r.category_name).filter(Boolean) || [])] as string[],
        facilities: [...new Set(facilities.data?.map(r => r.facility).filter(Boolean) || [])] as string[],
        locations: [...new Set(locations.data?.map(r => r.location_id).filter(Boolean) || [])] as string[],
        ownerships: [...new Set(ownerships.data?.map(r => r.tag_client_ownership).filter(Boolean) || [])] as string[],
        clientSources: [...new Set(clientSources.data?.map(r => r.tag_clientsource).filter(Boolean) || [])] as string[],
        marketplaces: [...new Set(marketplaces.data?.map(r => r.marketplace_profile_sold_on).filter(Boolean) || [])] as string[],
        fileTypes: [...new Set(fileTypes.data?.map(r => r.file_type).filter(Boolean) || [])] as string[],
      };
    },
    staleTime: 60000,
  });
}

export function useFilteredLifecycle(tabName: TabName = 'inbound') {
  const { filters } = useTabFilters(tabName);

  return useQuery({
    queryKey: ['filtered-lifecycle-inbound-only', tabName, filters],
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
            .in('file_upload_id', activeInboundFileIds);
          
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
      
      // For each stage, dedupe by trgid and filter by WM week of that stage's date
      const selectedWeeks = filters.wmWeeks;
      const hasWeekFilter = selectedWeeks.length > 0;
      
      // Helper: check if a date matches the week filter
      const matchesWeekFilter = (dateStr: string | null): boolean => {
        if (!hasWeekFilter) return true; // No filter = include all
        if (!dateStr) return false; // No date = can't match
        const wmWeek = getWMWeekFromDateString(dateStr);
        return wmWeek !== null && selectedWeeks.includes(wmWeek);
      };
      
      // Deduplicate by trgid for each stage, filtered by that stage's date week
      const receivedTrgids = new Set<string>();
      const checkedInTrgids = new Set<string>();
      const testedTrgids = new Set<string>();
      const listedTrgids = new Set<string>();
      const soldTrgids = new Set<string>();
      
      filteredUnits.forEach(unit => {
        // Each stage checks if its own date matches the week filter
        if (unit.received_on && matchesWeekFilter(unit.received_on)) {
          receivedTrgids.add(unit.trgid);
        }
        if (unit.checked_in_on && matchesWeekFilter(unit.checked_in_on)) {
          checkedInTrgids.add(unit.trgid);
        }
        if (unit.tested_on && matchesWeekFilter(unit.tested_on)) {
          testedTrgids.add(unit.trgid);
        }
        if (unit.first_listed_date && matchesWeekFilter(unit.first_listed_date)) {
          listedTrgids.add(unit.trgid);
        }
        if (unit.order_closed_date && matchesWeekFilter(unit.order_closed_date)) {
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

export function useFilteredSales(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);

  return useQuery({
    queryKey: ['filtered-sales', tabName, filters],
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
        query = query.range(from, from + pageSize - 1);
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) break;
        allData.push(...data);
        
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      return filterExcludedFiles(allData, filters.excludedFileIds);
    },
  });
}

export function useFilteredFees(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);

  return useQuery({
    queryKey: ['filtered-fees', tabName, filters],
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
      
      const { data, error } = await query;
      if (error) throw error;
      
      return filterExcludedFiles(data, filters.excludedFileIds);
    },
  });
}

export function useFilteredLifecycleEvents(tabName: TabName = 'inbound') {
  const { filters } = useTabFilters(tabName);

  return useQuery({
    queryKey: ['filtered-lifecycle-events', tabName, filters],
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

  return useQuery({
    queryKey: ['filtered-weekly-trends', tabName, filters],
    queryFn: async () => {
      // Fetch all records using pagination
      type TrendRow = { wm_week: number | null; gross_sale: number; effective_retail: number | null; file_upload_id: string | null };
      const allData: TrendRow[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        let query = supabase
          .from('sales_metrics')
          .select('wm_week, gross_sale, effective_retail, file_upload_id')
          .not('wm_week', 'is', null);
        
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
      
      const weeklyData: Record<number, { grossSales: number; effectiveRetail: number; count: number }> = {};
      
      filtered.forEach(row => {
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
