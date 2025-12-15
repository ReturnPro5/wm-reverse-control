import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { KPICard } from '@/components/dashboard/KPICard';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { DollarSign, Percent, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';
import { format } from 'date-fns';
import { getWMWeekNumber } from '@/lib/wmWeek';
import { DashboardFilters } from '@/hooks/useDashboardData';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function SalesTab() {
  const [filters, setFilters] = useState<DashboardFilters>({});
  const currentWmWeek = getWMWeekNumber(new Date());

  // Fetch sales data
  const { data: salesData, refetch } = useQuery({
    queryKey: ['sales-tab-metrics', filters],
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
      return data;
    },
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['sales-filter-options'],
    queryFn: async () => {
      const [programs, facilities] = await Promise.all([
        supabase.from('sales_metrics').select('program_name').not('program_name', 'is', null),
        supabase.from('sales_metrics').select('facility').not('facility', 'is', null),
      ]);

      return {
        programs: [...new Set(programs.data?.map(r => r.program_name) || [])],
        facilities: [...new Set(facilities.data?.map(r => r.facility) || [])],
      };
    },
  });

  // Calculate metrics
  const grossSales = salesData?.reduce((sum, r) => sum + (Number(r.gross_sale) || 0), 0) || 0;
  const effectiveRetail = salesData?.reduce((sum, r) => sum + (Number(r.effective_retail) || 0), 0) || 0;
  const unitsCount = salesData?.length || 0;
  const recoveryRate = effectiveRetail > 0 ? (grossSales / effectiveRetail) * 100 : 0;
  const refundTotal = salesData?.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0) || 0;

  // Group by date
  const dailyData = salesData?.reduce((acc, sale) => {
    const date = sale.order_closed_date;
    if (!acc[date]) {
      acc[date] = { date, grossSales: 0, units: 0, effectiveRetail: 0 };
    }
    acc[date].grossSales += Number(sale.gross_sale) || 0;
    acc[date].units++;
    acc[date].effectiveRetail += Number(sale.effective_retail) || 0;
    return acc;
  }, {} as Record<string, { date: string; grossSales: number; units: number; effectiveRetail: number }>);

  const chartData = Object.values(dailyData || {})
    .map(d => ({
      ...d,
      recoveryRate: d.effectiveRetail > 0 ? (d.grossSales / d.effectiveRetail) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Sales Performance</h2>
        <p className="text-muted-foreground">Gross sales metrics from Sales files only</p>
      </div>

      {/* Filters */}
      <FilterBar
        wmWeek={filters.wmWeek}
        onWmWeekChange={(w) => setFilters(f => ({ ...f, wmWeek: w }))}
        programName={filters.programName}
        onProgramNameChange={(p) => setFilters(f => ({ ...f, programName: p }))}
        facility={filters.facility}
        onFacilityChange={(f) => setFilters(prev => ({ ...prev, facility: f }))}
        programs={filterOptions?.programs || []}
        facilities={filterOptions?.facilities || []}
        onRefresh={refetch}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Gross Sales"
          value={formatCurrency(grossSales)}
          subtitle="Never reduced by fees or refunds"
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Recovery Rate"
          value={`${recoveryRate.toFixed(1)}%`}
          subtitle="Gross Sales / Effective Retail"
          icon={<Percent className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Units Sold"
          value={unitsCount.toLocaleString()}
          subtitle="Total units with OrderClosedDate"
          icon={<Package className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Avg Sale Price"
          value={formatCurrency(unitsCount > 0 ? grossSales / unitsCount : 0)}
          subtitle="Gross Sales / Units"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Warning about Gross Sales */}
      <div className="bg-success/10 border border-success/20 rounded-lg p-4">
        <h4 className="font-medium text-success flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Gross Sales Integrity
        </h4>
        <p className="text-sm text-muted-foreground mt-1">
          Gross Sales = SUM(Sale Price with Discount Applied). This value is never reduced by fees or refunds 
          to maintain operational reporting accuracy.
        </p>
      </div>

      {/* Daily Sales Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6">Daily Sales & Recovery</h3>
        
        {chartData.length > 0 ? (
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => format(new Date(d), 'MMM d')}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left"
                  tickFormatter={formatCurrency}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(d) => format(new Date(d), 'MMMM d, yyyy')}
                  formatter={(value: number, name: string) => {
                    if (name === 'grossSales') return [formatCurrency(value), 'Gross Sales'];
                    if (name === 'recoveryRate') return [`${value.toFixed(1)}%`, 'Recovery Rate'];
                    return [value, name];
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    if (value === 'grossSales') return 'Gross Sales';
                    if (value === 'recoveryRate') return 'Recovery Rate';
                    return value;
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="grossSales" 
                  fill="hsl(var(--success))" 
                  name="grossSales"
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="recoveryRate" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                  name="recoveryRate"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No sales data available. Upload Sales files to see metrics.
          </div>
        )}
      </div>

      {/* Refund Tracking */}
      {refundTotal > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-warning">Refund Exposure (Tracked Separately)</h4>
            <p className="text-2xl font-bold mt-1">{formatCurrency(refundTotal)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Refunds are tracked separately and never reduce the Gross Sales figures above.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}