import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTabFilters, TabName, TabFilters } from '@/contexts/FilterContext';
import { Database } from '@/integrations/supabase/types';

type SalesMetric = Database['public']['Tables']['sales_metrics']['Row'];
type FeeMetric = Database['public']['Tables']['fee_metrics']['Row'];
type LifecycleEvent = Database['public']['Tables']['lifecycle_events']['Row'];
type FileUpload = Database['public']['Tables']['file_uploads']['Row'];
type UnitCanonical = Database['public']['Tables']['units_canonical']['Row'];

// Helper to create a stable key for query invalidation
function createFilterKey(filters: TabFilters): string {
  return JSON.stringify({
    weeks: filters.wmWeeks.sort(),
    days: filters.wmDaysOfWeek.sort(),
    programs: filters.programNames.sort(),
    facilities: filters.facilities.sort(),
    marketplaces: filters.marketplacesSoldOn.sort(),
    clientSources: filters.tagClientSources.sort(),
    excludedFiles: filters.excludedFileIds.sort(),
    fileTypes: filters.fileTypes.sort(),
  });
}

// Apply common filters to a query
function applyFilters<T extends { wm_week?: number | null; program_name?: string | null; facility?: string | null; marketplace_profile_sold_on?: string | null; tag_clientsource?: string | null }>(
  query: any,
  filters: TabFilters
) {
  if (filters.wmWeeks.length > 0) {
    query = query.in('wm_week', filters.wmWeeks);
  }
  if (filters.programNames.length > 0) {
    query = query.in('program_name', filters.programNames);
  }
  if (filters.facilities.length > 0) {
    query = query.in('facility', filters.facilities);
  }
  if (filters.marketplacesSoldOn.length > 0) {
    query = query.in('marketplace_profile_sold_on', filters.marketplacesSoldOn);
  }
  if (filters.tagClientSources.length > 0) {
    query = query.in('tag_clientsource', filters.tagClientSources);
  }
  return query;
}

// Filter out excluded file IDs from results
function filterExcludedFiles<T extends { file_upload_id?: string | null }>(
  data: T[] | null,
  excludedFileIds: string[]
): T[] {
  if (!data) return [];
  if (excludedFileIds.length === 0) return data;
  return data.filter(item => !excludedFileIds.includes(item.file_upload_id || ''));
}

// Filter out "owned" programs (programs containing "owned" in the name)
function filterOwnedPrograms<T extends { program_name?: string | null }>(
  data: T[]
): T[] {
  return data.filter(item => {
    const programName = item.program_name?.toLowerCase() || '';
    return !programName.includes('owned');
  });
}

// ===================================
// FILTER OPTIONS HOOKS
// ===================================

export function useWMWeekOptions() {
  return useQuery({
    queryKey: ['wm-week-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('wm_week')
        .not('wm_week', 'is', null)
        .order('wm_week', { ascending: false });
      
      if (error) throw error;
      
      const uniqueWeeks = [...new Set(data?.map(r => r.wm_week).filter(Boolean) as number[])];
      return uniqueWeeks.sort((a, b) => b - a);
    },
  });
}

export function useProgramNameOptions() {
  return useQuery({
    queryKey: ['program-name-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('program_name')
        .not('program_name', 'is', null);
      
      if (error) throw error;
      
      const uniquePrograms = [...new Set(data?.map(r => r.program_name).filter(Boolean) as string[])];
      return uniquePrograms.sort();
    },
  });
}

export function useFacilityOptions() {
  return useQuery({
    queryKey: ['facility-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('facility')
        .not('facility', 'is', null);
      
      if (error) throw error;
      
      const uniqueFacilities = [...new Set(data?.map(r => r.facility).filter(Boolean) as string[])];
      return uniqueFacilities.sort();
    },
  });
}

export function useMarketplaceOptions() {
  return useQuery({
    queryKey: ['marketplace-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('marketplace_profile_sold_on')
        .not('marketplace_profile_sold_on', 'is', null);
      
      if (error) throw error;
      
      const uniqueMarketplaces = [...new Set(data?.map(r => r.marketplace_profile_sold_on).filter(Boolean) as string[])];
      return uniqueMarketplaces.sort();
    },
  });
}

export function useClientSourceOptions() {
  return useQuery({
    queryKey: ['client-source-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('tag_clientsource')
        .not('tag_clientsource', 'is', null);
      
      if (error) throw error;
      
      const uniqueSources = [...new Set(data?.map(r => r.tag_clientsource).filter(Boolean) as string[])];
      return uniqueSources.sort();
    },
  });
}

// ===================================
// DATA HOOKS
// ===================================

export function useFilteredUnits(tabName: TabName = 'inbound') {
  const { filters } = useTabFilters(tabName);
  const filterKey = useMemo(() => createFilterKey(filters), [filters]);

  return useQuery({
    queryKey: ['filtered-units', tabName, filterKey],
    queryFn: async () => {
      let query = supabase.from('units_canonical').select('*');
      query = applyFilters(query, filters);
      
      if (filters.wmDaysOfWeek.length > 0) {
        query = query.in('wm_day_of_week', filters.wmDaysOfWeek);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      
      const filteredByFiles = filterExcludedFiles(data, filters.excludedFileIds);
      return filterOwnedPrograms(filteredByFiles);
    },
  });
}

export function useFilteredSales(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);
  const filterKey = useMemo(() => createFilterKey(filters), [filters]);

  return useQuery({
    queryKey: ['filtered-sales', tabName, filterKey],
    queryFn: async () => {
      // Paginate to handle large datasets
      const pageSize = 1000;
      let from = 0;
      const allData: SalesMetric[] = [];
      
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
      
      // Filter out excluded files and "owned" programs
      const filteredByFiles = filterExcludedFiles(allData, filters.excludedFileIds);
      const result = filterOwnedPrograms(filteredByFiles);
      
      return result;
    },
  });
}

export function useFilteredFees(tabName: TabName = 'sales') {
  const { filters } = useTabFilters(tabName);
  const filterKey = useMemo(() => createFilterKey(filters), [filters]);

  return useQuery({
    queryKey: ['filtered-fees', tabName, filterKey],
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
  const filterKey = useMemo(() => createFilterKey(filters), [filters]);

  return useQuery({
    queryKey: ['filtered-lifecycle-events', tabName, filterKey],
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
      return data || [];
    },
  });
}

// ===================================
// SUMMARY HOOKS
// ===================================

export function useSalesSummary(tabName: TabName = 'sales') {
  const { data: sales, isLoading } = useFilteredSales(tabName);

  return useMemo(() => {
    if (!sales || isLoading) {
      return {
        totalUnits: 0,
        totalGrossSales: 0,
        averageSalePrice: 0,
        isLoading,
      };
    }

    const totalUnits = sales.length;
    const totalGrossSales = sales.reduce((sum, s) => sum + (Number(s.gross_sale) || 0), 0);
    const averageSalePrice = totalUnits > 0 ? totalGrossSales / totalUnits : 0;

    return {
      totalUnits,
      totalGrossSales,
      averageSalePrice,
      isLoading,
    };
  }, [sales, isLoading]);
}

export function useLifecycleSummary(tabName: TabName = 'inbound') {
  const { data: events, isLoading } = useFilteredLifecycleEvents(tabName);

  return useMemo(() => {
    if (!events || isLoading) {
      return {
        received: 0,
        checkedIn: 0,
        tested: 0,
        listed: 0,
        sold: 0,
        isLoading,
      };
    }

    const counts = {
      received: 0,
      checkedIn: 0,
      tested: 0,
      listed: 0,
      sold: 0,
    };

    for (const event of events) {
      switch (event.stage) {
        case 'Received':
          counts.received++;
          break;
        case 'CheckedIn':
          counts.checkedIn++;
          break;
        case 'Tested':
          counts.tested++;
          break;
        case 'Listed':
          counts.listed++;
          break;
        case 'Sold':
          counts.sold++;
          break;
      }
    }

    return { ...counts, isLoading };
  }, [events, isLoading]);
}

// ===================================
// LEGACY ALIAS EXPORTS FOR BACKWARDS COMPATIBILITY
// ===================================

// useFilterOptions - aggregates all filter options into a single object
export function useFilterOptions() {
  const { data: programs } = useProgramNameOptions();
  const { data: facilities } = useFacilityOptions();
  const { data: marketplaces } = useMarketplaceOptions();
  const { data: clientSources } = useClientSourceOptions();
  const { data: wmWeeks } = useWMWeekOptions();

  return useQuery({
    queryKey: ['filter-options-combined', programs, facilities, marketplaces, clientSources, wmWeeks],
    queryFn: async () => ({
      programs: programs || [],
      masterPrograms: [],
      categories: [],
      facilities: facilities || [],
      locations: [],
      ownerships: [],
      clientSources: clientSources || [],
      marketplaces: marketplaces || [],
      fileTypes: ['Sales', 'Inbound', 'Outbound', 'Production', 'Inventory'],
    }),
    enabled: true,
  });
}

// useFilteredLifecycle - alias for useFilteredLifecycleEvents
export function useFilteredLifecycle(tabName: TabName = 'inbound') {
  const { data, ...rest } = useFilteredLifecycleEvents(tabName);
  
  // Transform lifecycle events into funnel format with percentage
  const funnelData = useMemo(() => {
    if (!data) return [];
    
    const counts: Record<string, number> = {
      Received: 0,
      CheckedIn: 0,
      Tested: 0,
      Listed: 0,
      Sold: 0,
    };
    
    for (const event of data) {
      if (counts[event.stage] !== undefined) {
        counts[event.stage]++;
      }
    }
    
    const receivedCount = counts.Received || 1;
    
    return [
      { stage: 'Received', count: counts.Received, percentage: 100 },
      { stage: 'Checked In', count: counts.CheckedIn, percentage: (counts.CheckedIn / receivedCount) * 100 },
      { stage: 'Tested', count: counts.Tested, percentage: (counts.Tested / receivedCount) * 100 },
      { stage: 'Listed', count: counts.Listed, percentage: (counts.Listed / receivedCount) * 100 },
      { stage: 'Sold', count: counts.Sold, percentage: (counts.Sold / receivedCount) * 100 },
    ];
  }, [data]);
  
  return { data: funnelData, ...rest };
}

// useFilteredWeeklyTrends - aggregates sales by week for trend charts
export function useFilteredWeeklyTrends(tabName: TabName = 'sales') {
  const { data: sales, ...rest } = useFilteredSales(tabName);
  
  const trendData = useMemo(() => {
    if (!sales) return [];
    
    const weeklyMap: Record<number, { week: number; grossSales: number; units: number; effectiveRetail: number }> = {};
    
    for (const sale of sales) {
      const week = sale.wm_week;
      if (!week) continue;
      
      if (!weeklyMap[week]) {
        weeklyMap[week] = { week, grossSales: 0, units: 0, effectiveRetail: 0 };
      }
      
      weeklyMap[week].grossSales += Number(sale.gross_sale) || 0;
      weeklyMap[week].units++;
      weeklyMap[week].effectiveRetail += Number(sale.effective_retail) || 0;
    }
    
    return Object.values(weeklyMap)
      .map(w => ({
        week: w.week,
        grossSales: w.grossSales,
        recoveryRate: w.effectiveRetail > 0 ? (w.grossSales / w.effectiveRetail) * 100 : 0,
        unitsCount: w.units,
      }))
      .sort((a, b) => a.week - b.week)
      .slice(-8);
  }, [sales]);
  
  return { data: trendData, ...rest };
}
