import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { LifecycleFunnel } from '@/components/dashboard/LifecycleFunnel';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
import { Package, CheckCircle, Clock, TrendingUp, DollarSign, ShoppingCart, Tag } from 'lucide-react';
import {
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { useFilterOptions, useFilteredLifecycle } from '@/hooks/useFilteredData';
import { useTabFilters } from '@/contexts/FilterContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
const TAB_NAME = 'inbound' as const;

export function InboundTab() {
  const queryClient = useQueryClient();
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: funnel, refetch: refetchFunnel } = useFilteredLifecycle(TAB_NAME);
  const { filters } = useTabFilters(TAB_NAME);
  
  // First get inbound file IDs
  const { data: inboundFileIds } = useQuery({
    queryKey: ['inbound-file-ids'],
    staleTime: 5 * 60 * 1000, // 5 minutes - prevents refetch on window focus
    refetchOnWindowFocus: false, // Don't refetch when user clicks back into browser
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('id')
        .eq('file_type', 'Inbound');
      if (error) throw error;
      return data?.map(f => f.id) || [];
    },
  });

  // Fetch inbound metrics using server-side aggregation for speed
  const { data: inboundMetrics, refetch: refetchData, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['inbound-metrics', TAB_NAME, filters, inboundFileIds],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!inboundFileIds || inboundFileIds.length === 0) return { 
        received: 0, 
        checkedIn: 0, 
        dailyData: [], 
        soldSameWeekSales: 0,
        soldSameWeekRetail: 0,
        avgSalePrice: 0,
        checkedInSameWeekRetail: 0,
        notCheckedInSameWeekRetail: 0,
      };
      
      const activeFileIds = inboundFileIds.filter(id => !filters.excludedFileIds.includes(id));
      if (activeFileIds.length === 0) return { 
        received: 0, checkedIn: 0, dailyData: [],
        soldSameWeekSales: 0, soldSameWeekRetail: 0, avgSalePrice: 0,
        checkedInSameWeekRetail: 0, notCheckedInSameWeekRetail: 0,
      };
      
      const wmWeeks = filters.wmWeeks.length > 0 ? filters.wmWeeks : null;
      const wmDays = filters.wmDaysOfWeek.length > 0 ? filters.wmDaysOfWeek : null;
      
      // Use server-side RPC for aggregation - much faster than client-side batching
      const [metricsResult, chartResult] = await Promise.all([
        supabase.rpc('get_inbound_metrics', {
          p_file_ids: activeFileIds,
          p_wm_weeks: wmWeeks,
          p_wm_days: wmDays,
        }),
        supabase.rpc('get_inbound_daily_chart', {
          p_file_ids: activeFileIds,
          p_wm_weeks: wmWeeks,
          p_wm_days: wmDays,
        }),
      ]);
      
      if (metricsResult.error) throw metricsResult.error;
      if (chartResult.error) throw chartResult.error;
      
      const metrics = metricsResult.data?.[0] || {
        received_count: 0,
        checked_in_count: 0,
        sold_same_week_sales: 0,
        sold_same_week_retail: 0,
        sold_count: 0,
        checked_in_same_week_retail: 0,
        not_checked_in_same_week_retail: 0,
      };
      
      const dailyData = (chartResult.data || []).map((row: { date: string; received: number; checked_in: number }) => ({
        date: row.date,
        Received: Number(row.received),
        CheckedIn: Number(row.checked_in),
      }));
      
      const soldCount = Number(metrics.sold_count) || 0;
      const soldSameWeekSales = Number(metrics.sold_same_week_sales) || 0;
      
      return { 
        received: Number(metrics.received_count) || 0, 
        checkedIn: Number(metrics.checked_in_count) || 0, 
        dailyData,
        soldSameWeekSales,
        soldSameWeekRetail: Number(metrics.sold_same_week_retail) || 0,
        avgSalePrice: soldCount > 0 ? soldSameWeekSales / soldCount : 0,
        checkedInSameWeekRetail: Number(metrics.checked_in_same_week_retail) || 0,
        notCheckedInSameWeekRetail: Number(metrics.not_checked_in_same_week_retail) || 0,
      };
    },
    enabled: !!inboundFileIds && inboundFileIds.length > 0,
  });

  const refetch = () => {
    refetchOptions();
    refetchFunnel();
    refetchData();
    queryClient.invalidateQueries({ queryKey: ['inbound-file-ids'] });
  };

  // Use pre-calculated metrics
  const receivedCount = inboundMetrics?.received || 0;
  const checkedInCount = inboundMetrics?.checkedIn || 0;
  const checkInRate = receivedCount > 0 ? (checkedInCount / receivedCount) * 100 : 0;
  const pendingCheckIn = receivedCount - checkedInCount;
  const soldSameWeekSales = inboundMetrics?.soldSameWeekSales || 0;
  const soldSameWeekRetail = inboundMetrics?.soldSameWeekRetail || 0;
  const avgSalePrice = inboundMetrics?.avgSalePrice || 0;
  const checkedInSameWeekRetail = inboundMetrics?.checkedInSameWeekRetail || 0;
  const notCheckedInSameWeekRetail = inboundMetrics?.notCheckedInSameWeekRetail || 0;

  // Chart data from metrics
  const chartData = inboundMetrics?.dailyData || [];

  const options = filterOptions || {
    programs: [],
    masterPrograms: [],
    categories: [],
    facilities: [],
    locations: [],
    ownerships: [],
    clientSources: [],
    marketplaces: [],
    fileTypes: [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Inbound Operations</h2>
        <p className="text-muted-foreground">Units received and checked in from Inbound files</p>
      </div>

      {/* Tab-Specific Filters */}
      <TabFilterBar
        tabName={TAB_NAME}
        programs={options.programs}
        masterPrograms={options.masterPrograms}
        categories={options.categories}
        facilities={options.facilities}
        locations={options.locations}
        ownerships={options.ownerships}
        clientSources={options.clientSources}
        marketplaces={options.marketplaces}
        fileTypes={options.fileTypes}
        onRefresh={refetch}
      />

      {/* KPI Cards - Row 1: Unit Counts */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Units Received"
          value={receivedCount.toLocaleString()}
          subtitle="Total received units"
          icon={<Package className="h-5 w-5" />}
          variant="info"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Units Checked In"
          value={checkedInCount.toLocaleString()}
          subtitle="Processed through check-in"
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Check-In Rate"
          value={`${checkInRate.toFixed(1)}%`}
          subtitle="Checked in / Received"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="primary"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Pending Check-In"
          value={pendingCheckIn.toLocaleString()}
          subtitle="Awaiting processing"
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
          isLoading={isMetricsLoading}
        />
      </div>

      {/* KPI Cards - Row 2: Financial Metrics */}
      <div className="grid gap-4 md:grid-cols-5">
        <KPICard
          title="Same Week Sales $"
          value={`$${soldSameWeekSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Received & sold same week"
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Same Week Retail $"
          value={`$${soldSameWeekRetail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Retail of same week sales"
          icon={<Tag className="h-5 w-5" />}
          variant="primary"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Avg Sale Price"
          value={`$${avgSalePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Same week avg sale"
          icon={<ShoppingCart className="h-5 w-5" />}
          variant="info"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Checked In Retail $"
          value={`$${checkedInSameWeekRetail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Checked in same week"
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Not Checked In Retail $"
          value={`$${notCheckedInSameWeekRetail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Not checked in same week"
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
          isLoading={isMetricsLoading}
        />
      </div>

      {/* Lifecycle Funnel */}
      <LifecycleFunnel data={funnel || []} />

      {/* Daily Inbound Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6">Daily Inbound Volume</h3>
        
        {chartData.length > 0 ? (
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => {
                    // Parse date string directly to avoid timezone issues
                    const [year, month, day] = d.split('-').map(Number);
                    return format(new Date(year, month - 1, day), 'MMM d');
                  }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(d) => {
                    const [year, month, day] = d.split('-').map(Number);
                    return format(new Date(year, month - 1, day), 'MMMM d, yyyy');
                  }}
                />
                <Legend />
                <Bar dataKey="Received" fill="hsl(var(--info))" name="Received" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CheckedIn" fill="hsl(var(--success))" name="Checked In" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No inbound data available. Upload Inbound files to see metrics.
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-info/10 border border-info/20 rounded-lg p-4">
        <h4 className="font-medium text-info">Accurate Unit Tracking</h4>
        <p className="text-sm text-muted-foreground mt-1">
          Inbound metrics are calculated from unique units, showing actual received vs checked-in status. 
          Pending check-in represents units that have been received but not yet processed.
        </p>
      </div>

      {/* File Manager */}
      <TabFileManager fileType="Inbound" onFilesChanged={refetch} />

      {/* Upload Section */}
      <FileUploadZone onUploadComplete={refetch} />
    </div>
  );
}
