import { useMemo } from 'react';
import { useFilterOptions, useFilteredSales } from '@/hooks/useFilteredData';
import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  TrendingUp, 
  BarChart3, 
  Calendar,
  Target,
  Percent,
  Upload
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  ComposedChart,
  Area
} from 'recharts';
import { mapMarketplace } from '@/lib/marketplaceMapping';
import { useQueryClient } from '@tanstack/react-query';

const TAB_NAME = 'quarterly-review';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
};

// Helper to get quarter from WM week (WM weeks 1-13 = Q1, 14-26 = Q2, etc.)
const getQuarterFromWmWeek = (wmWeek: number): string => {
  if (wmWeek <= 13) return 'Q1';
  if (wmWeek <= 26) return 'Q2';
  if (wmWeek <= 39) return 'Q3';
  return 'Q4';
};

// Helper to get fiscal year from date (Walmart fiscal year starts in Feb)
const getFiscalYear = (dateStr: string): number => {
  const date = new Date(dateStr);
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  // If month is January (0), it belongs to the previous fiscal year
  return month === 0 ? year : year + 1;
};

export function QuarterlyReviewTab() {
  const queryClient = useQueryClient();
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: salesData, refetch: refetchData } = useFilteredSales(TAB_NAME);

  const refetch = () => {
    refetchOptions();
    refetchData();
  };

  const handleFilesChanged = () => {
    queryClient.invalidateQueries({ queryKey: ['file-uploads'] });
    refetch();
  };

  // Aggregate data by quarter
  const quarterlyData = useMemo(() => {
    if (!salesData?.length) return [];

    const quarterMap = new Map<string, {
      quarter: string;
      grossSales: number;
      effectiveRetail: number;
      units: number;
      refunds: number;
      refundUnits: number;
      marketplaceBreakdown: Record<string, number>;
    }>();

    salesData.forEach(sale => {
      const wmWeek = sale.wm_week || 1;
      const quarter = getQuarterFromWmWeek(wmWeek);
      const fiscalYear = sale.order_closed_date ? getFiscalYear(sale.order_closed_date) : 2025;
      const key = `FY${fiscalYear} ${quarter}`;

      if (!quarterMap.has(key)) {
        quarterMap.set(key, {
          quarter: key,
          grossSales: 0,
          effectiveRetail: 0,
          units: 0,
          refunds: 0,
          refundUnits: 0,
          marketplaceBreakdown: {}
        });
      }

      const data = quarterMap.get(key)!;
      data.grossSales += sale.gross_sale || 0;
      data.effectiveRetail += sale.effective_retail || 0;
      data.units += 1;
      
      if (sale.is_refunded) {
        data.refunds += sale.refund_amount || 0;
        data.refundUnits += 1;
      }

      // Marketplace breakdown
      const marketplace = mapMarketplace(sale);
      data.marketplaceBreakdown[marketplace] = (data.marketplaceBreakdown[marketplace] || 0) + (sale.gross_sale || 0);
    });

    return Array.from(quarterMap.values())
      .sort((a, b) => a.quarter.localeCompare(b.quarter));
  }, [salesData]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalGrossSales = salesData?.reduce((sum, s) => sum + (s.gross_sale || 0), 0) || 0;
    const totalEffectiveRetail = salesData?.reduce((sum, s) => sum + (s.effective_retail || 0), 0) || 0;
    const totalUnits = salesData?.length || 0;
    const totalRefunds = salesData?.reduce((sum, s) => sum + (s.is_refunded ? (s.refund_amount || 0) : 0), 0) || 0;
    const recoveryRate = totalEffectiveRetail > 0 ? totalGrossSales / totalEffectiveRetail : 0;
    const avgSalePrice = totalUnits > 0 ? totalGrossSales / totalUnits : 0;

    return {
      totalGrossSales,
      totalEffectiveRetail,
      totalUnits,
      totalRefunds,
      recoveryRate,
      avgSalePrice
    };
  }, [salesData]);

  // Prepare chart data with recovery rate
  const chartData = useMemo(() => {
    return quarterlyData.map(q => ({
      ...q,
      recoveryRate: q.effectiveRetail > 0 ? (q.grossSales / q.effectiveRetail) * 100 : 0,
      avgPrice: q.units > 0 ? q.grossSales / q.units : 0,
      refundRate: q.units > 0 ? (q.refundUnits / q.units) * 100 : 0
    }));
  }, [quarterlyData]);

  // Marketplace comparison across quarters
  const marketplaceQuarterlyData = useMemo(() => {
    const allMarketplaces = new Set<string>();
    quarterlyData.forEach(q => {
      Object.keys(q.marketplaceBreakdown).forEach(m => allMarketplaces.add(m));
    });

    return quarterlyData.map(q => {
      const entry: Record<string, any> = { quarter: q.quarter };
      allMarketplaces.forEach(m => {
        entry[m] = q.marketplaceBreakdown[m] || 0;
      });
      return entry;
    });
  }, [quarterlyData]);

  const marketplaceColors: Record<string, string> = {
    'eBay BIN': 'hsl(var(--chart-1))',
    'eBay Auction': 'hsl(var(--chart-2))',
    'WM Marketplace': 'hsl(var(--chart-3))',
    'WM DSV': 'hsl(var(--chart-4))',
    'Amazon': 'hsl(var(--chart-5))',
    'Other': 'hsl(var(--muted-foreground))'
  };

  const allMarketplaces = useMemo(() => {
    const set = new Set<string>();
    quarterlyData.forEach(q => {
      Object.keys(q.marketplaceBreakdown).forEach(m => set.add(m));
    });
    return Array.from(set);
  }, [quarterlyData]);

  return (
    <div className="space-y-6">
      <TabFilterBar
        tabName={TAB_NAME}
        programs={filterOptions?.programs || []}
        categories={filterOptions?.categories || []}
        facilities={filterOptions?.facilities || []}
        masterPrograms={filterOptions?.masterPrograms || []}
        locations={filterOptions?.locations || []}
        ownerships={filterOptions?.ownerships || []}
        clientSources={filterOptions?.clientSources || []}
        marketplaces={filterOptions?.marketplaces || []}
        fileTypes={filterOptions?.fileTypes || []}
        onRefresh={refetch}
      />

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPICard
          title="Total Gross Sales"
          value={formatCurrency(totals.totalGrossSales)}
          subtitle="All quarters combined"
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Effective Retail"
          value={formatCurrency(totals.totalEffectiveRetail)}
          subtitle="Total retail value"
          icon={<Target className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Recovery Rate"
          value={formatPercent(totals.recoveryRate)}
          subtitle="Gross / Eff Retail"
          icon={<Percent className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Units Sold"
          value={totals.totalUnits.toLocaleString()}
          subtitle="Total transactions"
          icon={<BarChart3 className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Avg Sale Price"
          value={formatCurrency(totals.avgSalePrice)}
          subtitle="Per unit"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Total Refunds"
          value={formatCurrency(totals.totalRefunds)}
          subtitle="Tracked separately"
          icon={<DollarSign className="h-5 w-5" />}
          variant="warning"
        />
      </div>

      {/* Quarterly Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quarterly Sales Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="quarter" className="text-xs" />
                <YAxis 
                  yAxisId="left" 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  className="text-xs"
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  className="text-xs"
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'Recovery Rate') return [`${value.toFixed(1)}%`, name];
                    return [formatCurrency(value), name];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Legend />
                <Bar 
                  yAxisId="left" 
                  dataKey="grossSales" 
                  name="Gross Sales" 
                  fill="hsl(var(--chart-1))" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  yAxisId="left" 
                  dataKey="effectiveRetail" 
                  name="Effective Retail" 
                  fill="hsl(var(--chart-2))" 
                  radius={[4, 4, 0, 0]}
                  opacity={0.7}
                />
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="recoveryRate" 
                  name="Recovery Rate" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--chart-3))', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Marketplace Breakdown by Quarter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Marketplace Performance by Quarter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketplaceQuarterlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="quarter" className="text-xs" />
                <YAxis 
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  className="text-xs"
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Legend />
                {allMarketplaces.map((marketplace, index) => (
                  <Bar 
                    key={marketplace}
                    dataKey={marketplace} 
                    stackId="a"
                    fill={marketplaceColors[marketplace] || `hsl(var(--chart-${(index % 5) + 1}))`}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quarter-over-Quarter Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quarter Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Quarter</th>
                  <th className="text-right p-3 font-medium">Gross Sales</th>
                  <th className="text-right p-3 font-medium">Eff. Retail</th>
                  <th className="text-right p-3 font-medium">Recovery %</th>
                  <th className="text-right p-3 font-medium">Units</th>
                  <th className="text-right p-3 font-medium">Avg Price</th>
                  <th className="text-right p-3 font-medium">Refunds</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((q, index) => (
                  <tr key={q.quarter} className={index % 2 === 0 ? 'bg-muted/50' : ''}>
                    <td className="p-3 font-medium">{q.quarter}</td>
                    <td className="text-right p-3">{formatCurrency(q.grossSales)}</td>
                    <td className="text-right p-3">{formatCurrency(q.effectiveRetail)}</td>
                    <td className="text-right p-3">{q.recoveryRate.toFixed(1)}%</td>
                    <td className="text-right p-3">{q.units.toLocaleString()}</td>
                    <td className="text-right p-3">{formatCurrency(q.avgPrice)}</td>
                    <td className="text-right p-3 text-destructive">{formatCurrency(q.refunds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Monthly Data Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Upload monthly CSV files for quarterly review analysis. Use naming convention: <code className="bg-muted px-1 rounded">Monthly_YYYY-MM.csv</code>
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <FileUploadZone onUploadComplete={handleFilesChanged} />
            <TabFileManager fileType="Monthly" onFilesChanged={handleFilesChanged} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
