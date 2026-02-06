import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyKPIs {
  gross_sales: number;
  effective_retail: number;
  units_count: number;
  refund_total: number;
  invoiced_check_in_fee: number;
  invoiced_refurb_fee: number;
  invoiced_overbox_fee: number;
  invoiced_packaging_fee: number;
  invoiced_pps_fee: number;
  invoiced_shipping_fee: number;
  invoiced_merchant_fee: number;
  invoiced_revshare_fee: number;
  invoiced_3pmp_fee: number;
  invoiced_marketing_fee: number;
  invoiced_refund_fee: number;
}

interface MonthlyChartRow {
  wm_week: number;
  marketplace: string;
  gross_sales: number;
  effective_retail: number;
  units: number;
}

async function getMonthlyFileIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('file_uploads')
    .select('id')
    .eq('file_type', 'Monthly');
  if (error) throw error;
  return data?.map(f => f.id) || [];
}

export function useMonthlyKPIs() {
  return useQuery({
    queryKey: ['monthly-kpis'],
    staleTime: 0,
    queryFn: async () => {
      const fileIds = await getMonthlyFileIds();
      if (fileIds.length === 0) return null;

      const { data, error } = await supabase.rpc('get_monthly_kpis', {
        p_file_ids: fileIds,
      });
      if (error) throw error;
      return data as unknown as MonthlyKPIs;
    },
  });
}

export function useMonthlyChartData() {
  return useQuery({
    queryKey: ['monthly-chart-data'],
    staleTime: 0,
    queryFn: async () => {
      const fileIds = await getMonthlyFileIds();
      if (fileIds.length === 0) return [];

      const { data, error } = await supabase.rpc('get_monthly_chart_data', {
        p_file_ids: fileIds,
      });
      if (error) throw error;
      return (data as unknown as MonthlyChartRow[]) || [];
    },
  });
}
