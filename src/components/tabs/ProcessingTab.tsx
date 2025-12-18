import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
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
import { useFilterOptions } from '@/hooks/useFilteredData';
import { useTabFilters } from '@/contexts/FilterContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const TAB_NAME = 'processing' as const;

export function ProcessingTab() {
  const queryClient = useQueryClient();
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { filters } = useTabFilters(TAB_NAME);

  // First get production file IDs
  const { data: productionFileIds } = useQuery({
    queryKey: ['production-file-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('id')
        .eq('file_type', 'Production');
      
      if (error) throw error;
      return data?.map(f => f.id) || [];
    },
  });

  // Fetch units from Production files only
  const { data: productionUnits, refetch: refetchData } = useQuery({
    queryKey: ['production-units', TAB_NAME, productionFileIds, filters],
    queryFn: async () => {
      if (!productionFileIds || productionFileIds.length === 0) return [];
      
      let query = supabase
        .from('units_canonical')
        .select('*')
        .in('file_upload_id', productionFileIds)
        .eq('tag_clientsource', 'WMUS'); // WMUS exclusive
      
      // Apply filters
      if (filters.programNames.length > 0) {
        query = query.in('program_name', filters.programNames);
      }
      if (filters.facilities.length > 0) {
        query = query.in('facility', filters.facilities);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!productionFileIds && productionFileIds.length > 0,
  });

  const refetch = () => {
    refetchOptions();
    refetchData();
    queryClient.invalidateQueries({ queryKey: ['production-file-ids'] });
    queryClient.invalidateQueries({ queryKey: ['file-uploads', 'Production'] });
  };

  // Calculate metrics from production units
  const testedCount = productionUnits?.filter(u => u.tested_on).length || 0;
  const listedCount = productionUnits?.filter(u => u.first_listed_date).length || 0;
  const listingRate = testedCount > 0 ? (listedCount / testedCount) * 100 : 0;

  // WIP = units that are not yet sold
  const wipCount = productionUnits?.filter(u => !u.order_closed_date).length || 0;
  
  // WIP breakdown by stage
  const wipByStage = {
    Received: productionUnits?.filter(u => u.received_on && !u.checked_in_on && !u.order_closed_date).length || 0,
    CheckedIn: productionUnits?.filter(u => u.checked_in_on && !u.tested_on && !u.order_closed_date).length || 0,
    Tested: productionUnits?.filter(u => u.tested_on && !u.first_listed_date && !u.order_closed_date).length || 0,
    Listed: productionUnits?.filter(u => u.first_listed_date && !u.order_closed_date).length || 0,
  };

  // Group by tested_on date for chart
  const dailyData = productionUnits?.reduce((acc, unit) => {
    if (unit.tested_on) {
      const date = unit.tested_on;
      if (!acc[date]) {
        acc[date] = { date, Tested: 0, Listed: 0 };
      }
      acc[date].Tested++;
    }
    if (unit.first_listed_date) {
      const date = unit.first_listed_date;
      if (!acc[date]) {
        acc[date] = { date, Tested: 0, Listed: 0 };
      }
      acc[date].Listed++;
    }
    return acc;
  }, {} as Record<string, { date: string; Tested: number; Listed: number }>) || {};

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
    clientSources: [],
    marketplaces: [],
    fileTypes: [],
  };

  const wipStages = ['Received', 'CheckedIn', 'Tested', 'Listed'] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Processing & Inventory</h2>
        <p className="text-muted-foreground">Testing and listing throughput from Production files</p>
      </div>

      {/* Tab-Specific Filters */}
      <TabFilterBar
        tabName={TAB_NAME}
        programs={options.programs}
        masterPrograms={options.masterPrograms}
        categories={options.categories}
        facilities={options.facilities}
        locations={options.locations}
        ownerships={options.ownerships}
        clientSources={options.clientSources}
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
                  tickFormatter={(d) => format(new Date(d + 'T12:00:00'), 'MMM d')}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(d) => format(new Date(d + 'T12:00:00'), 'MMMM d, yyyy')}
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
            No processing data available. Upload Production files to see throughput metrics.
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

      {/* File Manager */}
      <TabFileManager fileType="Production" onFilesChanged={refetch} />

      {/* Upload Section */}
      <FileUploadZone onUploadComplete={refetch} />
    </div>
  );
}
