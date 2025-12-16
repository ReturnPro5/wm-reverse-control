import { KPICard } from '@/components/dashboard/KPICard';
import { GlobalFilterBar } from '@/components/dashboard/GlobalFilterBar';
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
import { format } from 'date-fns';
import { useFilterOptions } from '@/hooks/useFilteredData';
import { useFilters } from '@/contexts/FilterContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function InboundTab() {
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { filters } = useFilters();
  
  // First get inbound file IDs
  const { data: inboundFileIds } = useQuery({
    queryKey: ['inbound-file-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('id')
        .eq('file_type', 'Inbound');
      if (error) throw error;
      return data?.map(f => f.id) || [];
    },
  });

  // Fetch inbound data from units_canonical - only for Inbound file uploads
  const { data: inboundData, refetch: refetchData } = useQuery({
    queryKey: ['inbound-units', filters.excludedFileIds, inboundFileIds],
    queryFn: async () => {
      if (!inboundFileIds || inboundFileIds.length === 0) return [];
      
      // Fetch units only from Inbound file uploads - use limit to bypass default 1000 row limit
      const { data, error } = await supabase
        .from('units_canonical')
        .select('trgid, received_on, checked_in_on, file_upload_id')
        .not('received_on', 'is', null)
        .in('file_upload_id', inboundFileIds)
        .limit(10000);
      
      if (error) throw error;
      
      // Filter out excluded files if needed
      return data?.filter(d => !filters.excludedFileIds.includes(d.file_upload_id || '')) || [];
    },
    enabled: !!inboundFileIds && inboundFileIds.length > 0,
  });

  const refetch = () => {
    refetchOptions();
    refetchData();
  };

  // Calculate metrics from units_canonical
  const units = inboundData || [];
  const receivedCount = units.length;
  const checkedInCount = units.filter(u => u.checked_in_on !== null).length;
  const checkInRate = receivedCount > 0 ? (checkedInCount / receivedCount) * 100 : 0;
  const pendingCheckIn = receivedCount - checkedInCount;

  // Group by received_on date for chart
  const dailyData = units.reduce((acc, unit) => {
    const date = unit.received_on;
    if (!date) return acc;
    
    if (!acc[date]) {
      acc[date] = { date, Received: 0, CheckedIn: 0 };
    }
    acc[date].Received++;
    if (unit.checked_in_on) acc[date].CheckedIn++;
    return acc;
  }, {} as Record<string, { date: string; Received: number; CheckedIn: number }>);

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
        <h2 className="text-2xl font-bold">Inbound Operations</h2>
        <p className="text-muted-foreground">Units received and checked in from Inbound files</p>
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
          value={pendingCheckIn.toLocaleString()}
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
                  tickFormatter={(d) => {
                    // Parse date string directly to avoid timezone issues
                    const [year, month, day] = d.split('-').map(Number);
                    return format(new Date(year, month - 1, day), 'MMM d');
                  }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(d) => {
                    const [year, month, day] = d.split('-').map(Number);
                    return format(new Date(year, month - 1, day), 'MMMM d, yyyy');
                  }}
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
        <h4 className="font-medium text-info">Accurate Unit Tracking</h4>
        <p className="text-sm text-muted-foreground mt-1">
          Inbound metrics are calculated from unique units, showing actual received vs checked-in status. 
          Pending check-in represents units that have been received but not yet processed.
        </p>
      </div>
    </div>
  );
}
