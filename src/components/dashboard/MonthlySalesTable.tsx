import { useMemo } from 'react';
import { mapMarketplace, getMarketplaceColor } from '@/lib/marketplaceMapping';

interface SalesRow {
  gross_sale: number;
  marketplace_profile_sold_on: string | null;
  order_closed_date: string;
  wm_week?: number | null;
  tag_ebay_auction_sale?: boolean | null;
  b2c_auction?: string | null;
}

interface MonthlySalesTableProps {
  salesData: SalesRow[] | undefined;
  isLoading: boolean;
}

const formatFullDollar = (value: number) =>
  `$${Math.round(value).toLocaleString('en-US')}`;

export function MonthlySalesTable({ salesData, isLoading }: MonthlySalesTableProps) {
  const { weeks, channels, weekChannelMap, channelTotals, weekTotals, grandTotal, dynamicTitle } = useMemo(() => {
    if (!salesData?.length)
      return { weeks: [], channels: [], weekChannelMap: {}, channelTotals: {}, weekTotals: {}, grandTotal: 0, dynamicTitle: 'Sales by Channel' };

    // Dynamic title from dates
    const dates = salesData.map(r => r.order_closed_date).filter(Boolean).sort();
    const latestDate = dates.length > 0 ? new Date(dates[dates.length - 1] + 'T12:00:00') : null;
    const dynamicTitle = latestDate
      ? `${latestDate.toLocaleString('en-US', { month: 'long' })} ${latestDate.getFullYear()} Sales by Channel`
      : 'Sales by Channel';

    // Build week -> channel -> sales map
    const map: Record<number, Record<string, number>> = {};
    const chSet = new Set<string>();
    const wkTotals: Record<number, number> = {};

    salesData.forEach(row => {
      const wk = row.wm_week ?? 0;
      const channel = mapMarketplace({
        marketplace_profile_sold_on: row.marketplace_profile_sold_on ?? null,
        tag_ebay_auction_sale: row.tag_ebay_auction_sale,
        b2c_auction: row.b2c_auction,
      });
      chSet.add(channel);
      if (!map[wk]) map[wk] = {};
      map[wk][channel] = (map[wk][channel] || 0) + (row.gross_sale || 0);
      wkTotals[wk] = (wkTotals[wk] || 0) + (row.gross_sale || 0);
    });

    // Column totals
    const chTotals: Record<string, number> = {};
    Object.values(map).forEach(chMap => {
      Object.entries(chMap).forEach(([ch, val]) => {
        chTotals[ch] = (chTotals[ch] || 0) + val;
      });
    });

    // Sort channels by total descending, weeks ascending
    const channels = Object.entries(chTotals)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([ch]) => ch);
    const weeks = Object.keys(map).map(Number).sort((a, b) => a - b);
    const grandTotal = Object.values(wkTotals).reduce((s, v) => s + v, 0);

    return { weeks, channels, weekChannelMap: map, channelTotals: chTotals, weekTotals: wkTotals, grandTotal, dynamicTitle };
  }, [salesData]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">Loading table data...</div>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Sales by Channel</h3>
        <div className="h-[100px] flex items-center justify-center text-muted-foreground">No sales data available.</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-6">{dynamicTitle}</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-primary/30">
              <th className="text-left py-3 px-3 font-semibold text-muted-foreground whitespace-nowrap">WM Fiscal Week</th>
              {channels.map(ch => (
                <th key={ch} className="text-right py-3 px-3 font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: getMarketplaceColor(ch, 0) }}
                    />
                    {ch}
                  </span>
                </th>
              ))}
              <th className="text-right py-3 px-3 font-bold whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((wk, idx) => (
              <tr
                key={wk}
                className={`border-b border-border/50 transition-colors hover:bg-muted/40 ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}
              >
                <td className="py-2.5 px-3 font-medium tabular-nums">{wk}</td>
                {channels.map(ch => {
                  const val = weekChannelMap[wk]?.[ch] || 0;
                  return (
                    <td key={ch} className="py-2.5 px-3 text-right tabular-nums">
                      {val > 0 ? formatFullDollar(val) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                  {formatFullDollar(weekTotals[wk] || 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/30 bg-muted/20">
              <td className="py-3 px-3 font-bold">Total</td>
              {channels.map(ch => (
                <td key={ch} className="py-3 px-3 text-right font-bold tabular-nums">
                  {formatFullDollar(channelTotals[ch] || 0)}
                </td>
              ))}
              <td className="py-3 px-3 text-right font-bold tabular-nums text-primary">
                {formatFullDollar(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
