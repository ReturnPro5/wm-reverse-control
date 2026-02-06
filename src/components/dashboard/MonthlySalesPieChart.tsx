import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { mapMarketplace, getMarketplaceColor } from '@/lib/marketplaceMapping';

interface SalesRow {
  gross_sale: number;
  marketplace_profile_sold_on: string | null;
  order_closed_date: string;
  tag_ebay_auction_sale?: boolean | null;
  b2c_auction?: string | null;
}

interface MonthlySalesPieChartProps {
  salesData: SalesRow[] | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const RADIAN = Math.PI / 180;

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }: any) {
  if (percent < 0.03) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

export function MonthlySalesPieChart({ salesData, isLoading }: MonthlySalesPieChartProps) {
  const { pieData, dynamicTitle } = useMemo(() => {
    if (!salesData?.length) return { pieData: [], dynamicTitle: 'Sales by Channel' };

    // Derive month/year from order_closed_date range
    const dates = salesData
      .map(r => r.order_closed_date)
      .filter(Boolean)
      .sort();
    
    let titleMonth = '';
    if (dates.length > 0) {
      // Use the most common month, or just the latest date's month
      const latestDate = new Date(dates[dates.length - 1] + 'T12:00:00');
      titleMonth = `${latestDate.toLocaleString('en-US', { month: 'long' })} ${latestDate.getFullYear()}`;
    }

    // Group by mapped marketplace
    const channelTotals: Record<string, number> = {};
    salesData.forEach(row => {
      const marketplace = mapMarketplace({
        marketplace_profile_sold_on: row.marketplace_profile_sold_on ?? null,
        tag_ebay_auction_sale: row.tag_ebay_auction_sale,
        b2c_auction: row.b2c_auction,
      });
      channelTotals[marketplace] = (channelTotals[marketplace] || 0) + (row.gross_sale || 0);
    });

    const data = Object.entries(channelTotals)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      pieData: data,
      dynamicTitle: titleMonth ? `${titleMonth} Sales by Channel` : 'Sales by Channel',
    };
  }, [salesData]);

  const grandTotal = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-6">{dynamicTitle}</h3>

      {isLoading ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart data...</div>
      ) : pieData.length > 0 ? (
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={140}
                dataKey="value"
                label={renderCustomLabel}
                labelLine={false}
                isAnimationActive={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={entry.name} fill={getMarketplaceColor(entry.name, index)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => {
                  const pct = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(1) : '0.0';
                  return [`${formatCurrency(value)} (${pct}%)`, name];
                }}
              />
              <Legend
                formatter={(value: string) => value}
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          No sales data available.
        </div>
      )}
    </div>
  );
}
