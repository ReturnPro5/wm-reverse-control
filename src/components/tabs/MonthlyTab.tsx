import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { MonthlyFileUploadZone } from '@/components/dashboard/MonthlyFileUploadZone';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
import { DollarSign, Percent, Package, TrendingUp, AlertTriangle, Receipt, Calendar } from 'lucide-react';
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

import { useFilterOptions } from '@/hooks/useFilteredData';
import { useMonthlyKPIs, useMonthlyChartData } from '@/hooks/useMonthlyData';
import { mapMarketplace, getMarketplaceColor } from '@/lib/marketplaceMapping';

const TAB_NAME = 'monthly' as const;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function MonthlyTab() {
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKPIs } = useMonthlyKPIs();
  const { data: rawChartData, isLoading: chartLoading, refetch: refetchChart } = useMonthlyChartData();

  const refetch = () => {
    refetchOptions();
    refetchKPIs();
    refetchChart();
  };

  // KPI values from server
  const grossSales = kpis?.gross_sales || 0;
  const effectiveRetail = kpis?.effective_retail || 0;
  const unitsCount = kpis?.units_count || 0;
  const recoveryRate = effectiveRetail > 0 ? (grossSales / effectiveRetail) * 100 : 0;
  const refundTotal = kpis?.refund_total || 0;

  // Fee totals from server
  const checkInFeeTotal = kpis?.invoiced_check_in_fee || 0;
  const refurbFeeTotal = kpis?.invoiced_refurb_fee || 0;
  const overboxFeeTotal = kpis?.invoiced_overbox_fee || 0;
  const packagingFeeTotal = kpis?.invoiced_packaging_fee || 0;
  const ppsFeeTotal = kpis?.invoiced_pps_fee || 0;
  const shippingFeeTotal = kpis?.invoiced_shipping_fee || 0;
  const merchantFeeTotal = kpis?.invoiced_merchant_fee || 0;
  const revshareFeeTotal = kpis?.invoiced_revshare_fee || 0;
  const threePMPFeeTotal = kpis?.invoiced_3pmp_fee || 0;
  const marketingFeeTotal = kpis?.invoiced_marketing_fee || 0;
  const refundFeeTotal = kpis?.invoiced_refund_fee || 0;

  // Process chart data from server aggregation (grouped by WM Week)
  const weeklyData: Record<number, { wmWeek: number; grossSales: number; effectiveRetail: number; marketplaces: Record<string, number>; sortDate: string }> = {};
  (rawChartData || []).forEach(row => {
    const marketplace = row.marketplace || 'Unknown';
    const wk = row.wm_week;
    if (!weeklyData[wk]) {
      weeklyData[wk] = { wmWeek: wk, grossSales: 0, effectiveRetail: 0, marketplaces: {}, sortDate: row.sort_date || '' };
    }
    weeklyData[wk].grossSales += Number(row.gross_sales) || 0;
    weeklyData[wk].effectiveRetail += Number(row.effective_retail) || 0;
    weeklyData[wk].marketplaces[marketplace] = (weeklyData[wk].marketplaces[marketplace] || 0) + (Number(row.gross_sales) || 0);
    if (row.sort_date && row.sort_date < weeklyData[wk].sortDate) {
      weeklyData[wk].sortDate = row.sort_date;
    }
  });

  const allMarketplaces = new Set<string>();
  Object.values(weeklyData).forEach(d => {
    Object.keys(d.marketplaces).forEach(m => allMarketplaces.add(m));
  });
  const marketplaceList = Array.from(allMarketplaces).sort();

  const chartData = Object.values(weeklyData)
    .map(d => {
      const result: Record<string, any> = {
        wmWeek: d.wmWeek,
        grossSales: d.grossSales,
        recoveryRate: d.effectiveRetail > 0 ? (d.grossSales / d.effectiveRetail) * 100 : 0,
        sortDate: d.sortDate,
      };
      marketplaceList.forEach(m => {
        result[m] = d.marketplaces[m] || 0;
        result[`${m}_pct`] = d.grossSales > 0 ? ((d.marketplaces[m] || 0) / d.grossSales) * 100 : 0;
      });
      return result;
    })
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  const options = filterOptions || {
    programs: [], masterPrograms: [], categories: [], facilities: [],
    locations: [], ownerships: [], clientSources: [], marketplaces: [],
    fileTypes: [], orderTypes: [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Monthly Sales Performance
        </h2>
        <p className="text-muted-foreground">Gross sales metrics aggregated by calendar month</p>
      </div>

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
        showWalmartChannel={true}
        onRefresh={refetch}
      />

      {/* Main KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard title="Gross Sales" value={formatCurrency(grossSales)} subtitle="Never reduced by fees or refunds" icon={<DollarSign className="h-5 w-5" />} variant="success" isLoading={kpisLoading} />
        <KPICard title="Recovery Rate" value={`${recoveryRate.toFixed(1)}%`} subtitle="Gross Sales / Effective Retail" icon={<Percent className="h-5 w-5" />} variant="info" isLoading={kpisLoading} />
        <KPICard title="Units Sold" value={unitsCount.toLocaleString()} subtitle="Excludes Transfers & $0 sales" icon={<Package className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
        <KPICard title="Avg Sale Price" value={formatCurrency(unitsCount > 0 ? grossSales / unitsCount : 0)} subtitle="Gross Sales / Units" icon={<TrendingUp className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
      </div>

      {/* Gross Sales Integrity Info */}
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

      {/* Monthly Sales Chart with Marketplace Breakdown */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6">Weekly Sales & Recovery by Marketplace (WM Fiscal Week)</h3>
        
        {chartLoading ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart data...</div>
        ) : chartData.length > 0 ? (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="wmWeek" 
                  tickFormatter={(wk) => `WK ${wk}`}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis yAxisId="left" tickFormatter={formatCurrency} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  labelFormatter={(wk) => `WM Fiscal Week ${wk}`}
                  formatter={(value: number, name: string, props: any) => {
                    if (name === 'recoveryRate') return [`${value.toFixed(1)}%`, 'Recovery Rate'];
                    const pct = props.payload[`${name}_pct`];
                    return [`${formatCurrency(value)} (${pct?.toFixed(1) || 0}%)`, name];
                  }}
                />
                <Legend formatter={(value) => value === 'recoveryRate' ? 'Recovery Rate' : value} />
                {marketplaceList.map((marketplace, index) => (
                  <Bar 
                    key={marketplace} yAxisId="left" dataKey={marketplace} stackId="sales"
                    fill={getMarketplaceColor(marketplace, index)} name={marketplace}
                    radius={index === marketplaceList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  >
                    {index === marketplaceList.length - 1 && (
                      <LabelList dataKey="grossSales" position="top" 
                        formatter={(value: number) => { if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`; if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`; return `$${value.toFixed(0)}`; }}
                        fill="hsl(var(--foreground))" fontSize={11} fontWeight={600}
                      />
                    )}
                  </Bar>
                ))}
                <Line yAxisId="right" type="monotone" dataKey="recoveryRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }} name="recoveryRate">
                  <LabelList dataKey="recoveryRate" position="top" formatter={(value: number) => `${value.toFixed(0)}%`} fill="hsl(var(--primary))" fontSize={10} fontWeight={500} offset={8} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No sales data available. Upload Monthly files to see metrics.
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
            <p className="text-sm text-muted-foreground mt-1">Refunds are tracked separately and never reduce the Gross Sales figures above.</p>
          </div>
        </div>
      )}

      {/* Fee Components Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Fee Components (Invoiced Values)</h3>
        </div>
        <p className="text-sm text-muted-foreground">Individual fee totals from invoiced values in the sales data.</p>
        
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          <KPICard title="Check-In Fee" value={formatCurrency(checkInFeeTotal)} subtitle="invoiced_check_in_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="Refurb Fee" value={formatCurrency(refurbFeeTotal)} subtitle="invoiced_refurb_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="Overbox Fee" value={formatCurrency(overboxFeeTotal)} subtitle="invoiced_overbox_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="Packaging Fee" value={formatCurrency(packagingFeeTotal)} subtitle="invoiced_packaging_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="PPS Fee" value={formatCurrency(ppsFeeTotal)} subtitle="invoiced_pps_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="Shipping Fee" value={formatCurrency(shippingFeeTotal)} subtitle="invoiced_shipping_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="Merchant Fee" value={formatCurrency(merchantFeeTotal)} subtitle="invoiced_merchant_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="Revshare Fee" value={formatCurrency(revshareFeeTotal)} subtitle="invoiced_revshare_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="3PMP Fee" value={formatCurrency(threePMPFeeTotal)} subtitle="invoiced_3pmp_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="Marketing Fee" value={formatCurrency(marketingFeeTotal)} subtitle="invoiced_marketing_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
          <KPICard title="Refund Fee" value={formatCurrency(refundFeeTotal)} subtitle="invoiced_refund_fee" icon={<Receipt className="h-5 w-5" />} variant="default" isLoading={kpisLoading} />
        </div>
      </div>

      <TabFileManager fileType="Monthly" onFilesChanged={refetch} />
      <MonthlyFileUploadZone onUploadComplete={refetch} />
    </div>
  );
}
