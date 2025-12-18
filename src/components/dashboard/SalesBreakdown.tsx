import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import { useFilteredSales } from '@/hooks/useFilteredData';
import { mapMarketplace, getMarketplaceColor } from '@/lib/marketplaceMapping';

interface SalesBreakdownProps {
  className?: string;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function SalesBreakdown({ className }: SalesBreakdownProps) {
  const { data: salesData } = useFilteredSales();

  // Group sales by mapped marketplace using global filters
  const marketplaceData = salesData?.reduce((grouped, row) => {
    const marketplace = mapMarketplace(row);
    grouped[marketplace] = (grouped[marketplace] || 0) + (Number(row.gross_sale) || 0);
    return grouped;
  }, {} as Record<string, number>);

  const chartData = Object.entries(marketplaceData || {})
    .map(([name, value]) => ({ name, fullName: name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map(item => ({
      ...item,
      name: item.name.length > 15 ? item.name.slice(0, 15) + '...' : item.name
    }));

  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      <h3 className="text-lg font-semibold mb-6">Sales by Marketplace</h3>
      
      {chartData.length > 0 ? (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                tickFormatter={formatCurrency}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Gross Sales']}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getMarketplaceColor(entry.fullName, index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
          No sales data available
        </div>
      )}
    </div>
  );
}
