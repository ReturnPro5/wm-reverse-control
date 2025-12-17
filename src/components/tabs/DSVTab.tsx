import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { ShoppingCart, DollarSign, Percent, Package } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { useFilterOptions, useFilteredSales } from '@/hooks/useFilteredData';

const TAB_NAME = 'dsv' as const;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function DSVTab() {
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: allSalesData, refetch: refetchData } = useFilteredSales(TAB_NAME);

  const refetch = () => {
    refetchOptions();
    refetchData();
  };

  // Filter to Walmart DSV sales only (by marketplace)
  const dsvData = allSalesData?.filter(
    sale => sale.marketplace_profile_sold_on === 'Walmart DSV'
  ) || [];

  // Calculate metrics
  const grossSales = dsvData.reduce((sum, r) => sum + (Number(r.gross_sale) || 0), 0);
  const effectiveRetail = dsvData.reduce((sum, r) => sum + (Number(r.effective_retail) || 0), 0);
  const unitsCount = dsvData.length;
  const recoveryRate = effectiveRetail > 0 ? (grossSales / effectiveRetail) * 100 : 0;

  // Weekly trend data
  const weeklyData = dsvData.reduce((acc, sale) => {
    const week = sale.wm_week;
    if (!week) return acc;
    if (!acc[week]) {
      acc[week] = { week, grossSales: 0, units: 0, effectiveRetail: 0 };
    }
    acc[week].grossSales += Number(sale.gross_sale) || 0;
    acc[week].units++;
    acc[week].effectiveRetail += Number(sale.effective_retail) || 0;
    return acc;
  }, {} as Record<number, { week: number; grossSales: number; units: number; effectiveRetail: number }>);

  const weeklyChartData = Object.values(weeklyData)
    .map(w => ({
      ...w,
      recoveryRate: w.effectiveRetail > 0 ? (w.grossSales / w.effectiveRetail) * 100 : 0,
    }))
    .sort((a, b) => a.week - b.week)
    .slice(-8);

  // Daily data
  const dailyData = dsvData.reduce((acc, sale) => {
    const date = sale.order_closed_date;
    if (!acc[date]) {
      acc[date] = { date, grossSales: 0, units: 0 };
    }
    acc[date].grossSales += Number(sale.gross_sale) || 0;
    acc[date].units++;
    return acc;
  }, {} as Record<string, { date: string; grossSales: number; units: number }>);

  const dailyChartData = Object.values(dailyData)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

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
        <h2 className="text-2xl font-bold">Walmart DSV</h2>
        <p className="text-muted-foreground">Drop Ship Vendor program sales metrics</p>
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="DSV Gross Sales"
          value={formatCurrency(grossSales)}
          subtitle="Drop Ship Vendor program"
          icon={<ShoppingCart className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Recovery Rate"
          value={`${recoveryRate.toFixed(1)}%`}
          subtitle="Gross Sales / Effective Retail"
          icon={<Percent className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Units Sold"
          value={unitsCount.toLocaleString()}
          subtitle="Via DSV program"
          icon={<Package className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Avg Sale Price"
          value={formatCurrency(unitsCount > 0 ? grossSales / unitsCount : 0)}
          subtitle="Per DSV unit"
          icon={<DollarSign className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Weekly Trend Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6">Weekly DSV Performance</h3>
        
        {weeklyChartData.length > 0 ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="week" 
                  tickFormatter={(w) => `WK${w}`}
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
                  labelFormatter={(w) => `Week ${w}`}
                  formatter={(value: number, name: string) => {
                    if (name === 'grossSales') return [formatCurrency(value), 'Gross Sales'];
                    if (name === 'recoveryRate') return [`${value.toFixed(1)}%`, 'Recovery Rate'];
                    if (name === 'units') return [value, 'Units'];
                    return [value, name];
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    if (value === 'grossSales') return 'Gross Sales';
                    if (value === 'recoveryRate') return 'Recovery Rate';
                    if (value === 'units') return 'Units';
                    return value;
                  }}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="grossSales" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="recoveryRate" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No DSV sales data available
          </div>
        )}
      </div>

      {/* Daily Sales Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6">Daily DSV Sales</h3>
        
        {dailyChartData.length > 0 ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => format(new Date(d), 'MMM d')}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
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
                    return [value, name];
                  }}
                />
                <Bar 
                  dataKey="grossSales" 
                  fill="hsl(var(--info))" 
                  name="grossSales"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            No daily DSV data available
          </div>
        )}
      </div>
    </div>
  );
}
