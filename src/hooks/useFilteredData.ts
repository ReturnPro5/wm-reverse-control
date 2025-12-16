import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFilters, GlobalFilters } from '@/contexts/FilterContext';
import { Tables } from '@/integrations/supabase/types';

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
  if (filters.tagClientSource) {
    query = query.eq('tag_clientsource', filters.tagClientSource);
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

export function useFilteredLifecycle() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['filtered-lifecycle', filters],
    queryFn: async () => {
      // Fetch units_canonical for Received, CheckedIn, Tested, Listed (with pagination)
      const unitsData: { trgid: string; received_on: string | null; checked_in_on: string | null; tested_on: string | null; first_listed_date: string | null; file_upload_id: string | null }[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        let query = supabase
          .from('units_canonical')
          .select('trgid, received_on, checked_in_on, tested_on, first_listed_date, file_upload_id');
        query = applyFilters(query, filters);
        query = query.range(offset, offset + batchSize - 1);
        
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        unitsData.push(...data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      const filteredUnits = filterExcludedFiles(unitsData, filters.excludedFileIds);
      
      // Deduplicate by trgid for each stage (a unit can only be received/checked-in/listed once)
      const receivedTrgids = new Set<string>();
      const checkedInTrgids = new Set<string>();
      const testedTrgids = new Set<string>();
      const listedTrgids = new Set<string>();
      
      filteredUnits.forEach(unit => {
        if (unit.received_on) receivedTrgids.add(unit.trgid);
        if (unit.checked_in_on) checkedInTrgids.add(unit.trgid);
        if (unit.tested_on) testedTrgids.add(unit.trgid);
        if (unit.first_listed_date) listedTrgids.add(unit.trgid);
      });
      
      // Fetch sales_metrics for Sold count (with pagination)
      const salesData: { trgid: string; file_upload_id: string | null }[] = [];
      offset = 0;
      
      while (true) {
        let query = supabase
          .from('sales_metrics')
          .select('trgid, file_upload_id')
          .neq('marketplace_profile_sold_on', 'Transfer')
          .gt('sale_price', 0);
        query = applyFilters(query, filters);
        query = query.range(offset, offset + batchSize - 1);
        
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        salesData.push(...data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      const filteredSales = filterExcludedFiles(salesData, filters.excludedFileIds);
      
      // Deduplicate sold trgids
      const soldTrgids = new Set<string>();
      filteredSales.forEach(sale => soldTrgids.add(sale.trgid));
      
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

export function useFilteredSales() {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['filtered-sales', filters],
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
        
        if (filters.programName) {
          query = query.eq('program_name', filters.programName);
        }
        if (filters.facility) {
          query = query.eq('facility', filters.facility);
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
