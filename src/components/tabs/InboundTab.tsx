import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { KPICard } from '@/components/dashboard/KPICard';
import { Package, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format, subDays } from 'date-fns';

export function InboundTab() {
  // Fetch inbound lifecycle events
  const { data: inboundData } = useQuery({
    queryKey: ['inbound-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lifecycle_events')
        .select('*')
        .in('stage', ['Received', 'CheckedIn'])
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const receivedCount = inboundData?.filter(e => e.stage === 'Received').length || 0;
  const checkedInCount = inboundData?.filter(e => e.stage === 'CheckedIn').length || 0;
  const checkInRate = receivedCount > 0 ? (checkedInCount / receivedCount) * 100 : 0;

  // Group by date for chart
  const dailyData = inboundData?.reduce((acc, event) => {
    const date = event.event_date;
    if (!acc[date]) {
      acc[date] = { date, Received: 0, CheckedIn: 0 };
    }
    if (event.stage === 'Received') acc[date].Received++;
    if (event.stage === 'CheckedIn') acc[date].CheckedIn++;
    return acc;
  }, {} as Record<string, { date: string; Received: number; CheckedIn: number }>);

  const chartData = Object.values(dailyData || {})
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Inbound Operations</h2>
        <p className="text-muted-foreground">Units received and checked in from Inbound files</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Units Received"
          value={receivedCount.toLocaleString()}
          subtitle="Total received units"
          icon={<Package className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Units Checked In"
          value={checkedInCount.toLocaleString()}
          subtitle="Processed through check-in"
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Check-In Rate"
          value={`${checkInRate.toFixed(1)}%`}
          subtitle="Checked in / Received"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Pending Check-In"
          value={(receivedCount - checkedInCount).toLocaleString()}
          subtitle="Awaiting processing"
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
        />
      </div>

      {/* Daily Inbound Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6">Daily Inbound Volume</h3>
        
        {chartData.length > 0 ? (
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => format(new Date(d), 'MMM d')}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(d) => format(new Date(d), 'MMMM d, yyyy')}
                />
                <Legend />
                <Bar dataKey="Received" fill="hsl(var(--info))" name="Received" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CheckedIn" fill="hsl(var(--success))" name="Checked In" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No inbound data available. Upload Inbound files to see metrics.
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-info/10 border border-info/20 rounded-lg p-4">
        <h4 className="font-medium text-info">Lifecycle Event Preservation</h4>
        <p className="text-sm text-muted-foreground mt-1">
          Inbound metrics count lifecycle events, not current unit states. A unit that was received and later sold 
          will still count toward Received if the receive date falls within the selected range.
        </p>
      </div>
    </div>
  );
}