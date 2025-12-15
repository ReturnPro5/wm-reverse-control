import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { cn } from '@/lib/utils';

interface WeeklyTrendData {
  week: number;
  grossSales: number;
  recoveryRate: number;
  unitsCount: number;
}

interface WeeklyTrendChartProps {
  data: WeeklyTrendData[];
  className?: string;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export function WeeklyTrendChart({ data, className }: WeeklyTrendChartProps) {
  return (
    <div className={cn('bg-card rounded-lg border p-6', className)}>
      <h3 className="text-lg font-semibold mb-6">Weekly Sales Trend</h3>
      
      {data.length > 0 ? (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="week" 
                tickFormatter={(w) => `WK${w}`}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                yAxisId="left"
                tickFormatter={formatCurrency}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelFormatter={(w) => `Week ${w}`}
                formatter={(value: number, name: string) => {
                  if (name === 'grossSales') return [formatCurrency(value), 'Gross Sales'];
                  if (name === 'recoveryRate') return [`${value.toFixed(1)}%`, 'Recovery Rate'];
                  return [value, name];
                }}
              />
              <Legend 
                formatter={(value) => {
                  if (value === 'grossSales') return 'Gross Sales';
                  if (value === 'recoveryRate') return 'Recovery Rate';
                  return value;
                }}
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="grossSales" 
                stroke="hsl(var(--primary))" 
                fill="url(#colorSales)"
                strokeWidth={2}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="recoveryRate" 
                stroke="hsl(var(--success))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--success))', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          No trend data available. Upload sales files to see trends.
        </div>
      )}
    </div>
  );
}