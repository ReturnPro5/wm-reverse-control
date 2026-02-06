import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { MonthlyFileUploadZone } from '@/components/dashboard/MonthlyFileUploadZone';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
import { MonthlySalesPieChart } from '@/components/dashboard/MonthlySalesPieChart';
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

import { useFilterOptions, useFilteredSales } from '@/hooks/useFilteredData';
import { mapMarketplace, getMarketplaceColor } from '@/lib/marketplaceMapping';

const TAB_NAME = 'monthly' as const;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function MonthlyTab() {
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useFilteredSales(TAB_NAME);

  const refetch = () => {
    refetchOptions();
    refetchSales();
  };

  // Derive KPIs from filtered sales data
  const grossSales = salesData?.reduce((sum, r) => sum + (r.gross_sale || 0), 0) ?? 0;
  const effectiveRetail = salesData?.reduce((sum, r) => sum + (r.effective_retail || 0), 0) ?? 0;
  const unitsCount = salesData?.length ?? 0;
  const recoveryRate = effectiveRetail > 0 ? (grossSales / effectiveRetail) * 100 : 0;
  const refundTotal = salesData?.reduce((sum, r) => sum + (r.refund_amount || 0), 0) ?? 0;

  // Fee totals from filtered data
  const checkInFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_check_in_fee || 0), 0) ?? 0;
  const refurbFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_refurb_fee || 0), 0) ?? 0;
  const overboxFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_overbox_fee || 0), 0) ?? 0;
  const packagingFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_packaging_fee || 0), 0) ?? 0;
  const ppsFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_pps_fee || 0), 0) ?? 0;
  const shippingFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_shipping_fee || 0), 0) ?? 0;
  const merchantFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_merchant_fee || 0), 0) ?? 0;
  const revshareFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_revshare_fee || 0), 0) ?? 0;
  const threePMPFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_3pmp_fee || 0), 0) ?? 0;
  const marketingFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_marketing_fee || 0), 0) ?? 0;
  const refundFeeTotal = salesData?.reduce((sum, r) => sum + (r.invoiced_refund_fee || 0), 0) ?? 0;

  const kpisLoading = salesLoading;
  const chartLoading = salesLoading;

  // Process chart data from filtered sales (grouped by WM Week + marketplace)
  const weeklyData: Record<number, { wmWeek: number; grossSales: number; effectiveRetail: number; marketplaces: Record<string, number>; sortDate: string }> = {};
  (salesData || []).forEach(row => {
    const marketplace = mapMarketplace({ marketplace_profile_sold_on: row.marketplace_profile_sold_on ?? null });
    const wk = row.wm_week ?? 0;
    if (!weeklyData[wk]) {
      weeklyData[wk] = { wmWeek: wk, grossSales: 0, effectiveRetail: 0, marketplaces: {}, sortDate: row.order_closed_date || '' };
    }
    weeklyData[wk].grossSales += row.gross_sale || 0;
    weeklyData[wk].effectiveRetail += (row.effective_retail || 0);
    weeklyData[wk].marketplaces[marketplace] = (weeklyData[wk].marketplaces[marketplace] || 0) + (row.gross_sale || 0);
    if (row.order_closed_date && row.order_closed_date < weeklyData[wk].sortDate) {
      weeklyData[wk].sortDate = row.order_closed_date;
    }
  });

  const marketplaceTotals: Record<string, number> = {};
  Object.values(weeklyData).forEach(d => {
    Object.entries(d.marketplaces).forEach(([m, val]) => {
      marketplaceTotals[m] = (marketplaceTotals[m] || 0) + val;
    });
  });
  const marketplaceList = Object.entries(marketplaceTotals)
    .filter(([, total]) => total > 0)
    .map(([m]) => m)
    .sort();

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

  // Derive dynamic month/year from order_closed_date for chart title
  const allDates = (salesData || []).map(r => r.order_closed_date).filter(Boolean).sort();
  const chartMonthLabel = allDates.length > 0
    ? (() => {
        const d = new Date(allDates[allDates.length - 1] + 'T12:00:00');
        return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
      })()
    : '';

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
        <h3 className="text-lg font-semibold mb-6">{chartMonthLabel ? `${chartMonthLabel} Sales (WM Fiscal Week)` : 'Sales by Marketplace (WM Fiscal Week)'}</h3>
        
        {chartLoading ? (
          <div className="h-[450px] flex items-center justify-center text-muted-foreground">Loading chart data...</div>
        ) : chartData.length > 0 ? (
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
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
                {marketplaceList.map((marketplace, index) => {
                  const showInlineLabel = ['Walmart Marketplace', 'eBay', 'Walmart DSV'].includes(marketplace);
                  return (
                    <Bar 
                      key={marketplace} yAxisId="left" dataKey={marketplace} stackId="sales"
                      fill={getMarketplaceColor(marketplace, index)} name={marketplace}
                      radius={index === marketplaceList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    >
                      {showInlineLabel && (
                        <LabelList 
                          dataKey={marketplace} 
                          position="inside"
                          content={(props: any) => {
                            const { x, y, width, height, value } = props;
                            if (!value || value < 50000 || !height || height < 16 || !width || width < 30) return null;
                            let label = '';
                            if (value >= 1000000) label = `$${(value / 1000000).toFixed(2)}M`;
                            else if (value >= 1000) label = `$${(value / 1000).toFixed(2)}K`;
                            else label = `$${value.toFixed(2)}`;
                            return (
                              <text
                                x={x + width / 2}
                                y={y + height / 2}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#ffffff"
                                fontSize={height < 22 ? 9 : 10}
                                fontWeight={700}
                                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', pointerEvents: 'none' }}
                              >
                                {label}
                              </text>
                            );
                          }}
                        />
                      )}
                      {index === marketplaceList.length - 1 && (
                        <LabelList dataKey="grossSales" position="top" 
                          formatter={(value: number) => { if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`; if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`; return `$${value.toFixed(2)}`; }}
                          fill="hsl(var(--foreground))" fontSize={12} fontWeight={700}
                        />
                      )}
                    </Bar>
                  );
                })}
                <Line yAxisId="right" type="monotone" dataKey="recoveryRate" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 5 }} activeDot={{ r: 7, strokeWidth: 2 }} name="recoveryRate" isAnimationActive={false}>
                  <LabelList 
                    dataKey="recoveryRate" 
                    position="top" 
                    content={(props: any) => {
                      const { x, y, value } = props;
                      if (value == null) return null;
                      return (
                        <text
                          x={x}
                          y={y - 14}
                          textAnchor="middle"
                          fill="hsl(var(--primary))"
                          fontSize={11}
                          fontWeight={700}
                          style={{ textShadow: '0 0 4px hsl(var(--background)), 0 0 4px hsl(var(--background))' }}
                        >
                          {`${Number(value).toFixed(1)}%`}
                        </text>
                      );
                    }}
                  />
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

      {/* Monthly Sales by Channel Pie Chart */}
      <MonthlySalesPieChart salesData={salesData} isLoading={chartLoading} />

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
