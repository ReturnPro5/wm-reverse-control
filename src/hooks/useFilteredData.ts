import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFilters, GlobalFilters } from '@/contexts/FilterContext';

// Build a Supabase query with all global filters applied
function applyFilters<T extends { eq: any; not: any }>(
  query: T,
  filters: GlobalFilters,
  tablePrefix: string = ''
): T {
  const prefix = tablePrefix ? `${tablePrefix}.` : '';
  
  // Exclude files
  if (filters.excludedFileIds.length > 0) {
    // Can't easily do NOT IN with supabase-js, so we'll filter client-side for excluded files
  }
  
  // File type filter
  if (filters.fileType) {
    // This would apply to file_uploads table
  }
  
  // Data filters
  if (filters.wmWeek !== undefined) {
    query = query.eq('wm_week', filters.wmWeek);
  }
  if (filters.wmDayOfWeek !== undefined) {
    query = query.eq('wm_day_of_week', filters.wmDayOfWeek);
  }
  if (filters.programName) {
    query = query.eq('program_name', filters.programName);
  }
  if (filters.facility) {
    query = query.eq('facility', filters.facility);
  }
  if (filters.categoryName) {
    query = query.eq('category_name', filters.categoryName);
  }
  if (filters.tagClientOwnership) {
    query = query.eq('tag_client_ownership', filters.tagClientOwnership);
  }
  if (filters.marketplaceProfileSoldOn) {
    query = query.eq('marketplace_profile_sold_on', filters.marketplaceProfileSoldOn);
  }
  if (filters.locationId) {
    query = query.eq('location_id', filters.locationId);
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
  const { filters } = useFilters();

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
        marketplaces,
        fileTypes,
      ] = await Promise.all([
        supabase.from('units_canonical').select('program_name').not('program_name', 'is', null),
        supabase.from('units_canonical').select('master_program_name').not('master_program_name', 'is', null),
        supabase.from('units_canonical').select('category_name').not('category_name', 'is', null),
        supabase.from('units_canonical').select('facility').not('facility', 'is', null),
        supabase.from('units_canonical').select('location_id').not('location_id', 'is', null),
        supabase.from('units_canonical').select('tag_client_ownership').not('tag_client_ownership', 'is', null),
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
        marketplaces: [...new Set(marketplaces.data?.map(r => r.marketplace_profile_sold_on).filter(Boolean) || [])] as string[],
        fileTypes: [...new Set(fileTypes.data?.map(r => r.file_type).filter(Boolean) || [])] as string[],
      };
    },
    staleTime: 60000,
  });
}

export function useFilteredLifecycle() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['filtered-lifecycle', filters],
    queryFn: async () => {
      let query = supabase.from('units_canonical').select('current_stage, file_upload_id');
      query = applyFilters(query, filters);
      
      const { data, error } = await query;
      if (error) throw error;
      
      const filtered = filterExcludedFiles(data, filters.excludedFileIds);
      
      const counts: Record<string, number> = {
        Received: 0,
        CheckedIn: 0,
        Tested: 0,
        Listed: 0,
        Sold: 0,
      };

      filtered.forEach((row) => {
        if (row.current_stage && counts[row.current_stage] !== undefined) {
          counts[row.current_stage]++;
        }
      });

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      
      return Object.entries(counts).map(([stage, count]) => ({
        stage,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));
    },
  });
}

export function useFilteredSales() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['filtered-sales', filters],
    queryFn: async () => {
      let query = supabase.from('sales_metrics').select('*');
      query = applyFilters(query, filters);
      
      const { data, error } = await query;
      if (error) throw error;
      
      return filterExcludedFiles(data, filters.excludedFileIds);
    },
  });
}

export function useFilteredFees() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['filtered-fees', filters],
    queryFn: async () => {
      let query = supabase.from('fee_metrics').select('*');
      
      if (filters.wmWeek !== undefined) {
        query = query.eq('wm_week', filters.wmWeek);
      }
      if (filters.programName) {
        query = query.eq('program_name', filters.programName);
      }
      if (filters.facility) {
        query = query.eq('facility', filters.facility);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return filterExcludedFiles(data, filters.excludedFileIds);
    },
  });
}

export function useFilteredLifecycleEvents() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['filtered-lifecycle-events', filters],
    queryFn: async () => {
      let query = supabase.from('lifecycle_events').select('*');
      
      if (filters.wmWeek !== undefined) {
        query = query.eq('wm_week', filters.wmWeek);
      }
      if (filters.wmDayOfWeek !== undefined) {
        query = query.eq('wm_day_of_week', filters.wmDayOfWeek);
      }
      
      const { data, error } = await query.order('event_date', { ascending: false });
      if (error) throw error;
      
      return filterExcludedFiles(data, filters.excludedFileIds);
    },
  });
}

export function useFileUploads() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['file-uploads-all', filters.fileType],
    queryFn: async () => {
      let query = supabase
        .from('file_uploads')
        .select('*')
        .order('upload_timestamp', { ascending: false });

      if (filters.fileType) {
        query = query.eq('file_type', filters.fileType as 'Sales' | 'Inbound' | 'Outbound' | 'Inventory' | 'Unknown');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useFilteredWeeklyTrends() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['filtered-weekly-trends', filters],
    queryFn: async () => {
      let query = supabase
        .from('sales_metrics')
        .select('wm_week, gross_sale, effective_retail, file_upload_id')
        .not('wm_week', 'is', null);
      
      if (filters.programName) {
        query = query.eq('program_name', filters.programName);
      }
      if (filters.facility) {
        query = query.eq('facility', filters.facility);
      }
      
      const { data, error } = await query.order('wm_week', { ascending: true });
      if (error) throw error;

      const filtered = filterExcludedFiles(data, filters.excludedFileIds);
      
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
