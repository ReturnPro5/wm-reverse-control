import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWMWeekNumber, getWMWeekRange } from '@/lib/wmWeek';

export interface DashboardFilters {
  wmWeek?: number;
  programName?: string;
  categoryName?: string;
  facility?: string;
  dateRange?: { start: Date; end: Date };
}

export interface LifecycleFunnelData {
  stage: string;
  count: number;
  percentage: number;
}

export interface SalesMetrics {
  grossSales: number;
  unitsCount: number;
  effectiveRetail: number;
  recoveryRate: number;
  avgSalePrice: number;
  refundTotal: number;
}

export interface FeeMetrics {
  totalFees: number;
  checkInFees: number;
  packagingFees: number;
  pickPackShipFees: number;
  refurbishingFees: number;
  marketplaceFees: number;
}

export function useDashboardData(filters: DashboardFilters = {}) {
  const currentWmWeek = getWMWeekNumber(new Date());

  // Fetch lifecycle funnel data
  const lifecycleFunnel = useQuery({
    queryKey: ['lifecycle-funnel', filters],
    queryFn: async () => {
      let query = supabase
        .from('units_canonical')
        .select('current_stage');

      if (filters.wmWeek) {
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

      const counts: Record<string, number> = {
        Received: 0,
        CheckedIn: 0,
        Tested: 0,
        Listed: 0,
        Sold: 0,
      };

      data?.forEach((row) => {
        if (row.current_stage && counts[row.current_stage] !== undefined) {
          counts[row.current_stage]++;
        }
      });

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      
      const funnel: LifecycleFunnelData[] = Object.entries(counts).map(([stage, count]) => ({
        stage,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));

      return funnel;
    },
  });

  // Fetch sales metrics
  const salesMetrics = useQuery({
    queryKey: ['sales-metrics', filters],
    queryFn: async () => {
      let query = supabase
        .from('sales_metrics')
        .select('*');

      if (filters.wmWeek) {
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

      const metrics: SalesMetrics = {
        grossSales: 0,
        unitsCount: 0,
        effectiveRetail: 0,
        recoveryRate: 0,
        avgSalePrice: 0,
        refundTotal: 0,
      };

      if (data && data.length > 0) {
        metrics.unitsCount = data.length;
        metrics.grossSales = data.reduce((sum, row) => sum + (Number(row.gross_sale) || 0), 0);
        metrics.effectiveRetail = data.reduce((sum, row) => sum + (Number(row.effective_retail) || 0), 0);
        metrics.refundTotal = data.reduce((sum, row) => sum + (Number(row.refund_amount) || 0), 0);
        metrics.recoveryRate = metrics.effectiveRetail > 0 ? (metrics.grossSales / metrics.effectiveRetail) * 100 : 0;
        metrics.avgSalePrice = metrics.unitsCount > 0 ? metrics.grossSales / metrics.unitsCount : 0;
      }

      return metrics;
    },
  });

  // Fetch fee metrics
  const feeMetrics = useQuery({
    queryKey: ['fee-metrics', filters],
    queryFn: async () => {
      let query = supabase
        .from('fee_metrics')
        .select('*');

      if (filters.wmWeek) {
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

      const metrics: FeeMetrics = {
        totalFees: 0,
        checkInFees: 0,
        packagingFees: 0,
        pickPackShipFees: 0,
        refurbishingFees: 0,
        marketplaceFees: 0,
      };

      if (data && data.length > 0) {
        metrics.totalFees = data.reduce((sum, row) => sum + (Number(row.total_fees) || 0), 0);
        metrics.checkInFees = data.reduce((sum, row) => sum + (Number(row.check_in_fee) || 0), 0);
        metrics.packagingFees = data.reduce((sum, row) => sum + (Number(row.packaging_fee) || 0), 0);
        metrics.pickPackShipFees = data.reduce((sum, row) => sum + (Number(row.pick_pack_ship_fee) || 0), 0);
        metrics.refurbishingFees = data.reduce((sum, row) => sum + (Number(row.refurbishing_fee) || 0), 0);
        metrics.marketplaceFees = data.reduce((sum, row) => sum + (Number(row.marketplace_fee) || 0), 0);
      }

      return metrics;
    },
  });

  // Fetch file uploads
  const fileUploads = useQuery({
    queryKey: ['file-uploads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('*')
        .order('upload_timestamp', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  // Fetch filter options
  const filterOptions = useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      const [programs, categories, facilities] = await Promise.all([
        supabase.from('units_canonical').select('program_name').not('program_name', 'is', null),
        supabase.from('units_canonical').select('category_name').not('category_name', 'is', null),
        supabase.from('units_canonical').select('facility').not('facility', 'is', null),
      ]);

      return {
        programs: [...new Set(programs.data?.map(r => r.program_name) || [])],
        categories: [...new Set(categories.data?.map(r => r.category_name) || [])],
        facilities: [...new Set(facilities.data?.map(r => r.facility) || [])],
      };
    },
  });

  // Fetch weekly trends
  const weeklyTrends = useQuery({
    queryKey: ['weekly-trends', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('wm_week, gross_sale, effective_retail')
        .not('wm_week', 'is', null)
        .order('wm_week', { ascending: true });

      if (error) throw error;

      const weeklyData: Record<number, { grossSales: number; effectiveRetail: number; count: number }> = {};
      
      data?.forEach(row => {
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
        .slice(-8);
    },
  });

  return {
    lifecycleFunnel,
    salesMetrics,
    feeMetrics,
    fileUploads,
    filterOptions,
    weeklyTrends,
    currentWmWeek,
    isLoading: lifecycleFunnel.isLoading || salesMetrics.isLoading,
    refetch: () => {
      lifecycleFunnel.refetch();
      salesMetrics.refetch();
      feeMetrics.refetch();
      fileUploads.refetch();
      weeklyTrends.refetch();
    },
  };
}