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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SalesBreakdownProps {
  wmWeek?: number;
  className?: string;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
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

export function SalesBreakdown({ wmWeek, className }: SalesBreakdownProps) {
  const { data: marketplaceData } = useQuery({
    queryKey: ['sales-by-marketplace', wmWeek],
    queryFn: async () => {
      let query = supabase
        .from('sales_metrics')
        .select('marketplace_profile_sold_on, gross_sale');

      if (wmWeek) {
        query = query.eq('wm_week', wmWeek);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped: Record<string, number> = {};
      data?.forEach(row => {
        const marketplace = row.marketplace_profile_sold_on || 'Other';
        grouped[marketplace] = (grouped[marketplace] || 0) + (Number(row.gross_sale) || 0);
      });

      return Object.entries(grouped)
        .map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    },
  });

  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      <h3 className="text-lg font-semibold mb-6">Sales by Marketplace</h3>
      
      {marketplaceData && marketplaceData.length > 0 ? (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={marketplaceData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                {marketplaceData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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