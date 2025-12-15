import { KPICard } from '@/components/dashboard/KPICard';
import { GlobalFilterBar } from '@/components/dashboard/GlobalFilterBar';
import { TestTube, Tag, Clock, Activity } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { useFilterOptions, useFilteredLifecycleEvents, useFilteredLifecycle } from '@/hooks/useFilteredData';

export function ProcessingTab() {
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: processingData, refetch: refetchData } = useFilteredLifecycleEvents();
  const { data: funnelData, refetch: refetchFunnel } = useFilteredLifecycle();

  const refetch = () => {
    refetchOptions();
    refetchData();
    refetchFunnel();
  };

  // Filter to processing stages only
  const processingEvents = processingData?.filter(e => e.stage === 'Tested' || e.stage === 'Listed') || [];

  // Calculate metrics from events
  const testedCount = processingEvents.filter(e => e.stage === 'Tested').length;
  const listedCount = processingEvents.filter(e => e.stage === 'Listed').length;
  const listingRate = testedCount > 0 ? (listedCount / testedCount) * 100 : 0;

  // Get WIP count from funnel data (current state, not events)
  const wipStages = ['Received', 'CheckedIn', 'Tested', 'Listed'];
  const wipCount = funnelData?.filter(f => wipStages.includes(f.stage)).reduce((sum, f) => sum + f.count, 0) || 0;
  const wipByStage = wipStages.reduce((acc, stage) => {
    acc[stage] = funnelData?.find(f => f.stage === stage)?.count || 0;
    return acc;
  }, {} as Record<string, number>);

  // Group by date for chart
  const dailyData = processingEvents.reduce((acc, event) => {
    const date = event.event_date;
    if (!acc[date]) {
      acc[date] = { date, Tested: 0, Listed: 0 };
    }
    if (event.stage === 'Tested') acc[date].Tested++;
    if (event.stage === 'Listed') acc[date].Listed++;
    return acc;
  }, {} as Record<string, { date: string; Tested: number; Listed: number }>);

  const chartData = Object.values(dailyData)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const options = filterOptions || {
    programs: [],
    masterPrograms: [],
    categories: [],
    facilities: [],
    locations: [],
    ownerships: [],
    marketplaces: [],
    fileTypes: [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Processing & Inventory</h2>
        <p className="text-muted-foreground">Testing and listing throughput metrics</p>
      </div>

      {/* Global Filters */}
      <GlobalFilterBar
        programs={options.programs}
        masterPrograms={options.masterPrograms}
        categories={options.categories}
        facilities={options.facilities}
        locations={options.locations}
        ownerships={options.ownerships}
        marketplaces={options.marketplaces}
        fileTypes={options.fileTypes}
        onRefresh={refetch}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Units Tested"
          value={testedCount.toLocaleString()}
          subtitle="Completed testing"
          icon={<TestTube className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Units Listed"
          value={listedCount.toLocaleString()}
          subtitle="Active on marketplaces"
          icon={<Tag className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Listing Rate"
          value={`${listingRate.toFixed(1)}%`}
          subtitle="Listed / Tested"
          icon={<Activity className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Work In Progress"
          value={wipCount.toLocaleString()}
          subtitle="Units not yet sold"
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
        />
      </div>

      {/* Processing Throughput Chart */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-6">Processing Throughput</h3>
        
        {chartData.length > 0 ? (
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorTested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorListed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                <Area 
                  type="monotone" 
                  dataKey="Tested" 
                  stroke="hsl(var(--primary))" 
                  fill="url(#colorTested)"
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="Listed" 
                  stroke="hsl(var(--success))" 
                  fill="url(#colorListed)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No processing data available. Upload files to see throughput metrics.
          </div>
        )}
      </div>

      {/* WIP Breakdown */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Work In Progress Breakdown</h3>
        <div className="grid gap-4 md:grid-cols-4">
          {wipStages.map(stage => (
            <div key={stage} className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{stage}</p>
              <p className="text-2xl font-bold">{wipByStage[stage].toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
