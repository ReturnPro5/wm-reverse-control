import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { LifecycleFunnel } from '@/components/dashboard/LifecycleFunnel';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
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
import { useFilterOptions, useFilteredLifecycle } from '@/hooks/useFilteredData';
import { useTabFilters } from '@/contexts/FilterContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getWMWeekNumber } from '@/lib/wmWeek';

const TAB_NAME = 'inbound' as const;

// Calculate WM week from a date string (YYYY-MM-DD)
function getWMWeekFromDateString(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return getWMWeekNumber(date);
}

export function InboundTab() {
  const queryClient = useQueryClient();
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: funnel, refetch: refetchFunnel } = useFilteredLifecycle(TAB_NAME);
  const { filters } = useTabFilters(TAB_NAME);
  
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

  // Fetch inbound metrics with proper week filtering and deduplication
  const { data: inboundMetrics, refetch: refetchData } = useQuery({
    queryKey: ['inbound-metrics', TAB_NAME, filters, inboundFileIds],
    staleTime: 0, // Prevent stale data issues
    queryFn: async () => {
      if (!inboundFileIds || inboundFileIds.length === 0) return { received: 0, checkedIn: 0, dailyData: [] };
      
      // Filter out excluded file IDs
      const activeFileIds = inboundFileIds.filter(id => !filters.excludedFileIds.includes(id));
      if (activeFileIds.length === 0) return { received: 0, checkedIn: 0, dailyData: [] };
      
      // Fetch all data in batches to avoid limit issues - add ordering for consistency
      type UnitRow = { trgid: string; received_on: string | null; checked_in_on: string | null; tag_clientsource: string | null };
      const allData: UnitRow[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        let query = supabase
          .from('units_canonical')
          .select('trgid, received_on, checked_in_on, tag_clientsource')
          .not('received_on', 'is', null)
          .in('file_upload_id', activeFileIds)
          .order('trgid', { ascending: true }); // Consistent ordering
        
        // Apply client source filter
        if (filters.tagClientSources.length > 0) {
          query = query.in('tag_clientsource', filters.tagClientSources);
        }
        
        query = query.range(offset, offset + batchSize - 1);
        
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData.push(...data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      const selectedWeeks = filters.wmWeeks;
      const hasWeekFilter = selectedWeeks.length > 0;
      
      // Deduplicate by trgid - keep the most recent date record
      const trgidMap = new Map<string, UnitRow>();
      allData.forEach(unit => {
        const existing = trgidMap.get(unit.trgid);
        if (!existing) {
          trgidMap.set(unit.trgid, unit);
        } else {
          // Keep the one with the most recent received_on date
          const existingDate = existing.received_on || '';
          const newDate = unit.received_on || '';
          if (newDate > existingDate) {
            trgidMap.set(unit.trgid, unit);
          }
        }
      });
      
      // Filter by WM week if filter is active - use received_on date for week assignment
      let filteredUnits = Array.from(trgidMap.values());
      if (hasWeekFilter) {
        filteredUnits = filteredUnits.filter(unit => {
          const wmWeek = getWMWeekFromDateString(unit.received_on);
          return wmWeek !== null && selectedWeeks.includes(wmWeek);
        });
      }
      
      // Calculate metrics from deduplicated data
      const received = filteredUnits.length;
      const checkedIn = filteredUnits.filter(u => u.checked_in_on !== null).length;
      
      // Group by date for chart
      const dailyMap = filteredUnits.reduce((acc, unit) => {
        const date = unit.received_on;
        if (!date) return acc;
        if (!acc[date]) acc[date] = { date, Received: 0, CheckedIn: 0 };
        acc[date].Received++;
        if (unit.checked_in_on) acc[date].CheckedIn++;
        return acc;
      }, {} as Record<string, { date: string; Received: number; CheckedIn: number }>);
      
      const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      
      return { received, checkedIn, dailyData };
    },
    enabled: !!inboundFileIds && inboundFileIds.length > 0,
  });

  const refetch = () => {
    refetchOptions();
    refetchFunnel();
    refetchData();
    queryClient.invalidateQueries({ queryKey: ['inbound-file-ids'] });
  };

  // Use pre-calculated metrics
  const receivedCount = inboundMetrics?.received || 0;
  const checkedInCount = inboundMetrics?.checkedIn || 0;
  const checkInRate = receivedCount > 0 ? (checkedInCount / receivedCount) * 100 : 0;
  const pendingCheckIn = receivedCount - checkedInCount;

  // Chart data from metrics
  const chartData = inboundMetrics?.dailyData || [];

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Inbound Operations</h2>
        <p className="text-muted-foreground">Units received and checked in from Inbound files</p>
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

      {/* Lifecycle Funnel */}
      <LifecycleFunnel data={funnel || []} />

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

      {/* File Manager */}
      <TabFileManager fileType="Inbound" onFilesChanged={refetch} />

      {/* Upload Section */}
      <FileUploadZone onUploadComplete={refetch} />
    </div>
  );
}
