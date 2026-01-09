import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
import { DollarSign, Percent, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
  Bar,
  LabelList
} from 'recharts';
import { format } from 'date-fns';
import { useFilterOptions, useFilteredSales, useFilteredFees } from '@/hooks/useFilteredData';
import { mapMarketplace, marketplaceColors, getMarketplaceColor } from '@/lib/marketplaceMapping';
import { calculateTotalFees } from '@/lib/feeCalculator';

const TAB_NAME = 'sales' as const;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function SalesTab() {
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: salesData, refetch: refetchData } = useFilteredSales(TAB_NAME);
  const { data: feeData, refetch: refetchFees } = useFilteredFees(TAB_NAME);

  const refetch = () => {
    refetchOptions();
    refetchData();
    refetchFees();
  };

  // Calculate metrics
  const grossSales = salesData?.reduce((sum, r) => sum + (Number(r.gross_sale) || 0), 0) || 0;
  const effectiveRetail = salesData?.reduce((sum, r) => sum + (Number(r.effective_retail) || 0), 0) || 0;
  const unitsCount = salesData?.length || 0;
  const recoveryRate = effectiveRetail > 0 ? (grossSales / effectiveRetail) * 100 : 0;
  const refundTotal = salesData?.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0) || 0;
  
  // Calculate fees using lookup tables (for Net Sales KPI)
  const calculatedFees = salesData ? calculateTotalFees(salesData.map(s => ({
    sale_price: Number(s.sale_price) || 0,
    category_name: s.category_name,
    program_name: s.program_name,
    marketplace_profile_sold_on: s.marketplace_profile_sold_on,
    facility: s.facility,
    effective_retail: Number(s.effective_retail) || 0,
    tag_clientsource: s.tag_clientsource
  }))) : { totalFees: 0, breakdown: { checkInFees: 0, ppsFees: 0, refurbFees: 0, marketplaceFees: 0, revshareFees: 0, marketingFees: 0 } };
  
  const netSales = grossSales - calculatedFees.totalFees;

  // Group by date with marketplace breakdown
  const dailyData = salesData?.reduce((acc, sale) => {
    const date = sale.order_closed_date;
    const marketplace = mapMarketplace(sale);
    
    if (!acc[date]) {
      acc[date] = { date, grossSales: 0, units: 0, effectiveRetail: 0, marketplaces: {} as Record<string, number> };
    }
    acc[date].grossSales += Number(sale.gross_sale) || 0;
    acc[date].units++;
    acc[date].effectiveRetail += Number(sale.effective_retail) || 0;
    
    // Track marketplace sales
    if (!acc[date].marketplaces[marketplace]) {
      acc[date].marketplaces[marketplace] = 0;
    }
    acc[date].marketplaces[marketplace] += Number(sale.gross_sale) || 0;
    
    return acc;
  }, {} as Record<string, { date: string; grossSales: number; units: number; effectiveRetail: number; marketplaces: Record<string, number> }>);

  // Get all unique marketplaces across all dates
  const allMarketplaces = new Set<string>();
  Object.values(dailyData || {}).forEach(d => {
    Object.keys(d.marketplaces).forEach(m => allMarketplaces.add(m));
  });
  const marketplaceList = Array.from(allMarketplaces).sort();

  // Marketplace display name mapping (for legend/tooltip)
  const getMarketplaceLabel = (m: string) => m;
  const getColor = (marketplace: string, index: number) => getMarketplaceColor(marketplace, index);

  const chartData = Object.values(dailyData || {})
    .map(d => {
      const result: Record<string, any> = {
        date: d.date,
        grossSales: d.grossSales,
        recoveryRate: d.effectiveRetail > 0 ? (d.grossSales / d.effectiveRetail) * 100 : 0,
      };
      // Add each marketplace as its own field with percentage
      marketplaceList.forEach(m => {
        result[m] = d.marketplaces[m] || 0;
        result[`${m}_pct`] = d.grossSales > 0 ? ((d.marketplaces[m] || 0) / d.grossSales) * 100 : 0;
      });
      return result;
    })
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
        <h2 className="text-2xl font-bold">Sales Performance</h2>
        <p className="text-muted-foreground">Gross sales metrics from Sales files only</p>
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
      <div className="grid gap-4 md:grid-cols-5">
        <KPICard
          title="Gross Sales"
          value={formatCurrency(grossSales)}
          subtitle="Never reduced by fees or refunds"
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Net Sales"
          value={formatCurrency(netSales)}
          subtitle="Gross - Calculated Fees"
          icon={<DollarSign className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Recovery Rate"
          value={`${recoveryRate.toFixed(1)}%`}
          subtitle="Gross Sales / Effective Retail"
          icon={<Percent className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Units Sold"
          value={unitsCount.toLocaleString()}
          subtitle="Excludes Transfers & $0 sales"
          icon={<Package className="h-5 w-5" />}
          variant="default"
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

      {/* Daily Sales Chart with Marketplace Breakdown */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6">Daily Sales & Recovery by Marketplace</h3>
        
        {chartData.length > 0 ? (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => format(new Date(d + 'T12:00:00'), 'MMM d')}
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
                  labelFormatter={(d) => format(new Date(d + 'T12:00:00'), 'MMMM d, yyyy')}
                  formatter={(value: number, name: string, props: any) => {
                    if (name === 'recoveryRate') return [`${value.toFixed(1)}%`, 'Recovery Rate'];
                    // For marketplace bars, show value and percentage
                    const pctKey = `${name}_pct`;
                    const pct = props.payload[pctKey];
                    const label = getMarketplaceLabel(name);
                    return [`${formatCurrency(value)} (${pct?.toFixed(1) || 0}%)`, label];
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    if (value === 'recoveryRate') return 'Recovery Rate';
                    return getMarketplaceLabel(value);
                  }}
                />
                {/* Stacked bars for each marketplace */}
                {marketplaceList.map((marketplace, index) => (
                  <Bar 
                    key={marketplace}
                    yAxisId="left"
                    dataKey={marketplace} 
                    stackId="sales"
                    fill={getColor(marketplace, index)} 
                    name={marketplace}
                    radius={index === marketplaceList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  >
                    {index === marketplaceList.length - 1 && (
                      <LabelList 
                        dataKey="grossSales" 
                        position="top" 
                        formatter={(value: number) => {
                          if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                          if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                          return `$${value.toFixed(0)}`;
                        }}
                        fill="hsl(var(--foreground))"
                        fontSize={11}
                        fontWeight={600}
                      />
                    )}
                  </Bar>
                ))}
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="recoveryRate" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                  name="recoveryRate"
                >
                  <LabelList 
                    dataKey="recoveryRate" 
                    position="top" 
                    formatter={(value: number) => `${value.toFixed(0)}%`}
                    fill="hsl(var(--primary))"
                    fontSize={10}
                    fontWeight={500}
                    offset={8}
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
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

      {/* File Manager */}
      <TabFileManager fileType="Sales" onFilesChanged={refetch} />

      {/* Upload Section */}
      <FileUploadZone onUploadComplete={refetch} />
    </div>
  );
}
