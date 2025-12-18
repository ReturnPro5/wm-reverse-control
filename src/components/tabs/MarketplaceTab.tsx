import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { Store, DollarSign, Percent, Package } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { useFilterOptions, useFilteredSales } from '@/hooks/useFilteredData';
import { mapMarketplace } from '@/lib/marketplaceMapping';

const TAB_NAME = 'marketplace' as const;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--accent))',
];

export function MarketplaceTab() {
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: allSalesData, refetch: refetchData } = useFilteredSales(TAB_NAME);

  const refetch = () => {
    refetchOptions();
    refetchData();
  };

  // Filter to Walmart Marketplace sales only (using mapped marketplace)
  const marketplaceData = allSalesData?.filter(
    sale => mapMarketplace(sale) === 'Walmart Marketplace'
  ) || [];

  // Calculate metrics
  const grossSales = marketplaceData.reduce((sum, r) => sum + (Number(r.gross_sale) || 0), 0);
  const effectiveRetail = marketplaceData.reduce((sum, r) => sum + (Number(r.effective_retail) || 0), 0);
  const unitsCount = marketplaceData.length;
  const recoveryRate = effectiveRetail > 0 ? (grossSales / effectiveRetail) * 100 : 0;

  // Group by category
  const categoryData = marketplaceData.reduce((acc, sale) => {
    const category = sale.category_name?.split(' -> ')[0] || 'Other';
    if (!acc[category]) {
      acc[category] = { name: category, value: 0, count: 0 };
    }
    acc[category].value += Number(sale.gross_sale) || 0;
    acc[category].count++;
    return acc;
  }, {} as Record<string, { name: string; value: number; count: number }>);

  const categoryChartData = Object.values(categoryData)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Daily data
  const dailyData = marketplaceData.reduce((acc, sale) => {
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
        <h2 className="text-2xl font-bold">Walmart Marketplace</h2>
        <p className="text-muted-foreground">Sales through Walmart Marketplace channel</p>
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
          title="Marketplace Gross Sales"
          value={formatCurrency(grossSales)}
          subtitle="Walmart Marketplace only"
          icon={<Store className="h-5 w-5" />}
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
          subtitle="Via Walmart Marketplace"
          icon={<Package className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Avg Sale Price"
          value={formatCurrency(unitsCount > 0 ? grossSales / unitsCount : 0)}
          subtitle="Per marketplace unit"
          icon={<DollarSign className="h-5 w-5" />}
          variant="default"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Sales Chart */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-6">Daily Marketplace Sales</h3>
          
          {dailyChartData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(d) => format(new Date(d + 'T12:00:00'), 'MMM d')}
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
                    labelFormatter={(d) => format(new Date(d + 'T12:00:00'), 'MMMM d, yyyy')}
                    formatter={(value: number, name: string) => {
                      if (name === 'grossSales') return [formatCurrency(value), 'Gross Sales'];
                      return [value, name];
                    }}
                  />
                  <Bar 
                    dataKey="grossSales" 
                    fill="hsl(var(--primary))" 
                    name="grossSales"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              No Walmart Marketplace sales data
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-6">Sales by Category</h3>
          
          {categoryChartData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name.slice(0, 15)}... (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categoryChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Gross Sales']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              No category data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
