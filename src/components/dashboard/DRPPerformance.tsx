import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis } from 'recharts';
import { mapMarketplace, getMarketplaceColor } from '@/lib/marketplaceMapping';

const DRP_PROGRAMS = [
  'DS-WM-DRP-WACO-9153',
  'DS-WM-DRP-SC-8092',
  'DS-WM-DRP-IN-9193',
  'DS-WM-DRP-LV-9195',
  'DS-WM-DRP-NY-9196-NORTH',
  'DS-WM-DRP- NY-9196-NORTH', // alternate spacing variant
];

// Map program names to short facility labels
const FACILITY_MAP: Record<string, string> = {
  'DS-WM-DRP-WACO-9153': '9153-TX',
  'DS-WM-DRP-SC-8092': '8092-SC',
  'DS-WM-DRP-IN-9193': '9193-IN',
  'DS-WM-DRP-LV-9195': '9195-LV',
  'DS-WM-DRP-NY-9196-NORTH': '9196-NY',
  'DS-WM-DRP- NY-9196-NORTH': '9196-NY',
};

interface SalesRow {
  gross_sale: number;
  effective_retail?: number | null;
  marketplace_profile_sold_on: string | null;
  program_name?: string | null;
  facility?: string | null;
  order_closed_date: string;
  tag_ebay_auction_sale?: boolean | null;
  b2c_auction?: string | null;
  order_type_sold_on?: string | null;
}

interface DRPPerformanceProps {
  salesData: SalesRow[] | undefined;
  isLoading: boolean;
}

const formatFullDollar = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};
const formatPct = (v: number) => `${Math.round(v)}%`;

const RADIAN = Math.PI / 180;
function renderCustomLabel({ cx, cy, midAngle, outerRadius, percent, name, value }: any) {
  // Only label slices >= 5% to prevent overlap
  if (percent < 0.05) return null;
  const r = outerRadius + 24;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const anchor = x > cx ? 'start' : 'end';
  return (
    <g>
      <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fill="hsl(var(--foreground))" fontSize={11} fontWeight={600}>{name}</text>
      <text x={x} y={y + 14} textAnchor={anchor} dominantBaseline="central" fill="hsl(var(--muted-foreground))" fontSize={10}>
        {`${formatCurrency(value)} · ${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
}

export function DRPPerformance({ salesData, isLoading }: DRPPerformanceProps) {
  const drpData = useMemo(() => {
    if (!salesData?.length) return [];
    return salesData.filter(r =>
      r.program_name && DRP_PROGRAMS.some(p => r.program_name!.trim() === p.trim())
      && r.order_type_sold_on === 'B2CMarketplace'
    );
  }, [salesData]);

  const dynamicTitle = useMemo(() => {
    const dates = drpData.map(r => r.order_closed_date).filter(Boolean).sort();
    if (dates.length === 0) return 'DRP RC';
    const d = new Date(dates[dates.length - 1] + 'T12:00:00');
    return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  }, [drpData]);

  // Channel breakdown
  const channelStats = useMemo(() => {
    const map: Record<string, { sales: number; retail: number; units: number }> = {};
    drpData.forEach(r => {
      const ch = mapMarketplace({
        marketplace_profile_sold_on: r.marketplace_profile_sold_on ?? null,
        tag_ebay_auction_sale: r.tag_ebay_auction_sale,
        b2c_auction: r.b2c_auction,
      });
      if (!map[ch]) map[ch] = { sales: 0, retail: 0, units: 0 };
      map[ch].sales += r.gross_sale || 0;
      map[ch].retail += r.effective_retail || 0;
      map[ch].units += 1;
    });
    return Object.entries(map)
      .map(([channel, { sales, retail, units }]) => ({
        channel,
        units,
        sales,
        avgSalePrice: units > 0 ? sales / units : 0,
        grossRoR: retail > 0 ? (sales / retail) * 100 : 0,
        netRoR: null as number | null, // placeholder
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [drpData]);

  // Facility breakdown
  const facilityStats = useMemo(() => {
    const map: Record<string, { units: number; sales: number; retail: number }> = {};
    drpData.forEach(r => {
      const prog = r.program_name?.trim() || '';
      const fac = FACILITY_MAP[prog] || r.facility || 'Unknown';
      if (!map[fac]) map[fac] = { units: 0, sales: 0, retail: 0 };
      map[fac].units += 1;
      map[fac].sales += r.gross_sale || 0;
      map[fac].retail += r.effective_retail || 0;
    });
    return Object.entries(map)
      .map(([facility, { units, sales, retail }]) => ({
        facility,
        units,
        sales,
        avgSalePrice: units > 0 ? sales / units : 0,
        grossRoR: retail > 0 ? (sales / retail) * 100 : 0,
        netRoR: null as number | null,
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [drpData]);

  const totalSales = channelStats.reduce((s, r) => s + r.sales, 0);
  const totalRetail = channelStats.reduce((s, r) => s + r.grossRoR, 0); // just for totals row
  const totalRetailActual = drpData.reduce((s, r) => s + (r.effective_retail || 0), 0);
  const totalGrossRoR = totalRetailActual > 0 ? (totalSales / totalRetailActual) * 100 : 0;
  const totalUnits = drpData.length;

  // Pie data
  const pieData = channelStats.filter(c => c.sales > 0).map(c => ({ name: c.channel, value: c.sales }));

  if (isLoading) {
    return <div className="h-[200px] flex items-center justify-center text-muted-foreground">Loading DRP data...</div>;
  }

  if (drpData.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
        No DRP RC data found. Ensure Monthly files contain records with DRP program names.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Two tables side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LM Marketplace Sales and Recovery */}
        <div className="bg-card rounded-lg border p-5">
          <h3 className="text-base font-semibold mb-4 tracking-tight">
            {dynamicTitle} Marketplace Sales & Recovery
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/30">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Channel</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Units</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Sales</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Avg Price</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Gross RoR</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Net RoR</th>
                </tr>
              </thead>
              <tbody>
                {channelStats.map((row, idx) => (
                  <tr key={row.channel} className={`border-b border-border/50 transition-colors hover:bg-muted/40 ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}>
                    <td className="py-2 px-3 font-medium flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: getMarketplaceColor(row.channel, idx) }} />
                      {row.channel}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{row.units.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatFullDollar(row.sales)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatFullDollar(row.avgSalePrice)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatPct(row.grossRoR)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground/50">—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary/30 bg-muted/20">
                  <td className="py-2.5 px-3 font-bold">Total</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums">{totalUnits.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums text-primary">{formatFullDollar(totalSales)}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums">{totalUnits > 0 ? formatFullDollar(totalSales / totalUnits) : '$0'}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums">{formatPct(totalGrossRoR)}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums text-muted-foreground/50">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* LM Stats by Facility */}
        <div className="bg-card rounded-lg border p-5">
          <h3 className="text-base font-semibold mb-4 tracking-tight">
            {dynamicTitle} Stats by Facility
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/30">
                  <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">Facility</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Units</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Sales</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Avg Price</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Gross RoR</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">Net RoR</th>
                </tr>
              </thead>
              <tbody>
                {facilityStats.map((row, idx) => (
                  <tr key={row.facility} className={`border-b border-border/50 transition-colors hover:bg-muted/40 ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}>
                    <td className="py-2 px-3 font-medium">{row.facility}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{row.units.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatFullDollar(row.sales)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatFullDollar(row.avgSalePrice)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatPct(row.grossRoR)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground/50">—</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary/30 bg-muted/20">
                  <td className="py-2.5 px-3 font-bold">Total</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums">{totalUnits.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums text-primary">{formatFullDollar(totalSales)}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums">{totalUnits > 0 ? formatFullDollar(totalSales / totalUnits) : '$0'}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums">{formatPct(totalGrossRoR)}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums text-muted-foreground/50">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Pie Chart + Tradeoff Chart side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart */}
        <div className="bg-card rounded-lg border p-5">
          <h3 className="text-base font-semibold mb-4 tracking-tight">{dynamicTitle} DRP Sales by Channel</h3>
          {pieData.length > 0 ? (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    innerRadius={35}
                    dataKey="value"
                    label={renderCustomLabel}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                    isAnimationActive={false}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={getMarketplaceColor(entry.name, index)} stroke="hsl(var(--background))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <text x="50%" y="43%" textAnchor="middle" dominantBaseline="central" fill="hsl(var(--muted-foreground))" fontSize={10}>Total</text>
                  <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" fill="hsl(var(--foreground))" fontSize={14} fontWeight={700}>
                    {formatCurrency(totalSales)}
                  </text>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 13 }}
                    formatter={(value: number, name: string) => {
                      const pct = totalSales > 0 ? ((value / totalSales) * 100).toFixed(1) : '0.0';
                      return [`${formatCurrency(value)} (${pct}%)`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground">No channel data available.</div>
          )}
        </div>

        {/* Avg Sale Price vs Units Tradeoff */}
        <div className="bg-card rounded-lg border p-5">
          <h3 className="text-base font-semibold mb-4 tracking-tight">{dynamicTitle} Avg Sale Price vs Units</h3>
          {channelStats.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    dataKey="units"
                    name="Units"
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                    label={{ value: 'Units Sold', position: 'bottom', offset: 20, fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="avgSalePrice"
                    name="Avg Price"
                    tickFormatter={(v: number) => `$${v}`}
                    label={{ value: 'Avg Sale Price', angle: -90, position: 'insideLeft', offset: -5, fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <ZAxis type="number" dataKey="sales" range={[200, 2000]} name="Sales" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 13 }}
                    formatter={(value: number, name: string) => {
                      if (name === 'Units') return [value.toLocaleString(), name];
                      if (name === 'Avg Price') return [formatFullDollar(value), name];
                      if (name === 'Sales') return [formatCurrency(value), 'Total Sales'];
                      return [value, name];
                    }}
                    labelFormatter={(_, payload) => {
                      if (payload?.[0]?.payload?.channel) return payload[0].payload.channel;
                      return '';
                    }}
                  />
                  <Scatter data={channelStats} isAnimationActive={false}>
                    {channelStats.map((entry, index) => (
                      <Cell key={entry.channel} fill={getMarketplaceColor(entry.channel, index)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-muted-foreground">No data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
