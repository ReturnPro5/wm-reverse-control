import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { Store, DollarSign, Percent, Package, TrendingUp, BarChart3 } from 'lucide-react';
import { 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
  ComposedChart,
  Line,
  Legend,
  AreaChart,
  Area,
  BarChart
} from 'recharts';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { useFilterOptions, useFilteredSales } from '@/hooks/useFilteredData';
import { mapMarketplace } from '@/lib/marketplaceMapping';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

const PROGRAM_COLORS = [
  'hsl(207, 90%, 54%)',
  'hsl(142, 76%, 36%)',
  'hsl(45, 93%, 47%)',
  'hsl(280, 70%, 50%)',
  'hsl(320, 70%, 50%)',
  'hsl(27, 98%, 54%)',
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
  const avgSalePrice = unitsCount > 0 ? grossSales / unitsCount : 0;

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
      acc[date] = { date, grossSales: 0, units: 0, effectiveRetail: 0 };
    }
    acc[date].grossSales += Number(sale.gross_sale) || 0;
    acc[date].effectiveRetail += Number(sale.effective_retail) || 0;
    acc[date].units++;
    return acc;
  }, {} as Record<string, { date: string; grossSales: number; units: number; effectiveRetail: number }>);

  const dailyChartData = Object.values(dailyData)
    .map(d => ({
      ...d,
      recoveryRate: d.effectiveRetail > 0 ? (d.grossSales / d.effectiveRetail) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  // Weekly trend data
  const weeklyData = marketplaceData.reduce((acc, sale) => {
    const date = new Date(sale.order_closed_date + 'T12:00:00');
    const weekStart = startOfWeek(date, { weekStartsOn: 6 }); // Walmart week starts Saturday
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    
    if (!acc[weekKey]) {
      acc[weekKey] = { 
        weekStart: weekKey, 
        weekLabel: format(weekStart, 'MMM d'),
        grossSales: 0, 
        units: 0, 
        effectiveRetail: 0 
      };
    }
    acc[weekKey].grossSales += Number(sale.gross_sale) || 0;
    acc[weekKey].effectiveRetail += Number(sale.effective_retail) || 0;
    acc[weekKey].units++;
    return acc;
  }, {} as Record<string, { weekStart: string; weekLabel: string; grossSales: number; units: number; effectiveRetail: number }>);

  const weeklyChartData = Object.values(weeklyData)
    .map(w => ({
      ...w,
      avgASP: w.units > 0 ? w.grossSales / w.units : 0,
      recoveryRate: w.effectiveRetail > 0 ? (w.grossSales / w.effectiveRetail) * 100 : 0,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-8);

  // Program breakdown
  const programData = marketplaceData.reduce((acc, sale) => {
    const program = sale.program_name || 'Unknown';
    if (!acc[program]) {
      acc[program] = { name: program, value: 0, units: 0 };
    }
    acc[program].value += Number(sale.gross_sale) || 0;
    acc[program].units++;
    return acc;
  }, {} as Record<string, { name: string; value: number; units: number }>);

  const programChartData = Object.values(programData)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map(p => ({
      ...p,
      displayName: p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name
    }));

  // ASP Distribution (price buckets)
  const aspBuckets = [
    { min: 0, max: 25, label: '$0-25' },
    { min: 25, max: 50, label: '$25-50' },
    { min: 50, max: 100, label: '$50-100' },
    { min: 100, max: 200, label: '$100-200' },
    { min: 200, max: 500, label: '$200-500' },
    { min: 500, max: Infinity, label: '$500+' },
  ];

  const aspDistribution = aspBuckets.map(bucket => {
    const bucketItems = marketplaceData.filter(s => {
      const price = Number(s.sale_price) || 0;
      return price >= bucket.min && price < bucket.max;
    });
    return {
      label: bucket.label,
      units: bucketItems.length,
      grossSales: bucketItems.reduce((sum, s) => sum + (Number(s.gross_sale) || 0), 0),
    };
  });

  // Top categories table data
  const topCategoriesTable = Object.values(categoryData)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map(cat => ({
      ...cat,
      avgPrice: cat.count > 0 ? cat.value / cat.count : 0,
      pctOfTotal: grossSales > 0 ? (cat.value / grossSales) * 100 : 0,
    }));

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
    orderTypes: [],
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
        orderTypes={options.orderTypes}
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
          value={formatCurrency(avgSalePrice)}
          subtitle="Per marketplace unit"
          icon={<DollarSign className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Row 1: Daily Sales & Weekly Trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Sales Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Daily Marketplace Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyChartData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(d) => format(new Date(d + 'T12:00:00'), 'MMM d')}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      yAxisId="left"
                      tickFormatter={formatCurrency}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
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
                        if (name === 'recoveryRate') return [`${value.toFixed(1)}%`, 'Recovery Rate'];
                        return [value, name];
                      }}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="grossSales" 
                      fill="hsl(var(--primary))" 
                      name="grossSales"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList 
                        dataKey="grossSales" 
                        position="top" 
                        formatter={(value: number) => formatCurrency(value)}
                        fill="hsl(var(--foreground))"
                        fontSize={10}
                        fontWeight={600}
                      />
                    </Bar>
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="recoveryRate" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--success))', strokeWidth: 2, r: 3 }}
                      name="recoveryRate"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No Walmart Marketplace sales data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weekly Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyChartData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="wmmpGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="weekLabel" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      tickFormatter={formatCurrency}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'grossSales') return [formatCurrency(value), 'Gross Sales'];
                        if (name === 'units') return [value.toLocaleString(), 'Units'];
                        return [value, name];
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="grossSales" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill="url(#wmmpGradient)"
                      name="grossSales"
                    >
                      <LabelList 
                        dataKey="grossSales" 
                        position="top" 
                        formatter={(value: number) => formatCurrency(value)}
                        fill="hsl(var(--foreground))"
                        fontSize={10}
                        fontWeight={600}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No weekly data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Category Pie & Program Bar */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryChartData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      dataKey="value"
                      paddingAngle={2}
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
                      formatter={(value: number, name: string, props: any) => [
                        `${formatCurrency(value)} (${props.payload.count} units)`, 
                        props.payload.name
                      ]}
                    />
                    <Legend 
                      layout="vertical" 
                      align="right" 
                      verticalAlign="middle"
                      formatter={(value, entry: any) => (
                        <span className="text-xs text-foreground">
                          {entry.payload.name.length > 15 ? entry.payload.name.slice(0, 15) + '...' : entry.payload.name}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Program Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-info" />
              Sales by Program
            </CardTitle>
          </CardHeader>
          <CardContent>
            {programChartData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={programChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      tickFormatter={formatCurrency}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="displayName" 
                      width={90}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${formatCurrency(value)} (${props.payload.units} units)`,
                        props.payload.name
                      ]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {programChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PROGRAM_COLORS[index % PROGRAM_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No program data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: ASP Distribution & Top Categories Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ASP Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Price Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {unitsCount > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aspDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'units') return [value.toLocaleString(), 'Units'];
                        if (name === 'grossSales') return [formatCurrency(value), 'Gross Sales'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="units" 
                      fill="hsl(var(--info))" 
                      name="units"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList 
                        dataKey="units" 
                        position="top" 
                        formatter={(value: number) => value > 0 ? value.toLocaleString() : ''}
                        fill="hsl(var(--foreground))"
                        fontSize={10}
                        fontWeight={600}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No price distribution data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Categories Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {topCategoriesTable.length > 0 ? (
              <div className="overflow-auto max-h-[280px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs text-right">Units</TableHead>
                      <TableHead className="text-xs text-right">Gross Sales</TableHead>
                      <TableHead className="text-xs text-right">Avg Price</TableHead>
                      <TableHead className="text-xs text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCategoriesTable.map((cat, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">
                          {cat.name.length > 20 ? cat.name.slice(0, 20) + '...' : cat.name}
                        </TableCell>
                        <TableCell className="text-xs text-right">{cat.count.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{formatCurrency(cat.value)}</TableCell>
                        <TableCell className="text-xs text-right">{formatCurrency(cat.avgPrice)}</TableCell>
                        <TableCell className="text-xs text-right">{cat.pctOfTotal.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}