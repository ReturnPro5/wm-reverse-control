import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { FeeMetrics } from '@/hooks/useDashboardData';

interface FeeBreakdownProps {
  data: FeeMetrics | undefined;
  className?: string;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--accent))',
  'hsl(var(--destructive))',
  'hsl(var(--secondary))',
  'hsl(var(--muted-foreground))',
];

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function FeeBreakdown({ data, className }: FeeBreakdownProps) {
  if (!data || data.totalFees === 0) {
    return (
      <div className={cn('bg-card rounded-lg border p-6', className)}>
        <h3 className="text-lg font-semibold mb-6">Fee Breakdown</h3>
        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
          No fee data available
        </div>
      </div>
    );
  }

  // All 11 fee components (excluding merchantFees to avoid double-counting with thirdPartyMPFees)
  const chartData = [
    { name: 'Check-In', value: data.checkInFees },
    { name: 'Refurb', value: data.refurbFees },
    { name: 'Overbox', value: data.overboxFees },
    { name: 'Packaging', value: data.packagingFees },
    { name: 'PPS', value: data.ppsFees },
    { name: 'Shipping', value: data.shippingFees },
    { name: '3PMP', value: data.thirdPartyMPFees },
    { name: 'Revshare', value: data.revshareFees },
    { name: 'Marketing', value: data.marketingFees },
    { name: 'Refund', value: data.refundFees },
  ].filter(item => item.value > 0);

  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      <h3 className="text-lg font-semibold mb-2">Fee Breakdown</h3>
      <p className="text-2xl font-bold text-warning mb-4">{formatCurrency(data.totalFees)}</p>
      
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [formatCurrency(value), 'Amount']}
            />
            <Legend 
              layout="horizontal" 
              verticalAlign="bottom" 
              align="center"
              formatter={(value) => <span className="text-xs">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}