import { KPICard } from '@/components/dashboard/KPICard';
import { TabFilterBar } from '@/components/dashboard/TabFilterBar';
import { LifecycleFunnel } from '@/components/dashboard/LifecycleFunnel';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { TabFileManager } from '@/components/dashboard/TabFileManager';
import { Package, CheckCircle, Clock, TrendingUp, DollarSign, ShoppingCart, Tag } from 'lucide-react';
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
import { getWMWeekNumber, getWMDayOfWeek } from '@/lib/wmWeek';

const TAB_NAME = 'inbound' as const;

// Calculate WM week from a date string (YYYY-MM-DD)
function getWMWeekFromDateString(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return getWMWeekNumber(date);
}

// Calculate WM day of week from a date string (YYYY-MM-DD)
// Returns 1-7 (Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, Thu=6, Fri=7)
function getWMDayOfWeekFromDateString(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return getWMDayOfWeek(date);
}

export function InboundTab() {
  const queryClient = useQueryClient();
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: funnel, refetch: refetchFunnel } = useFilteredLifecycle(TAB_NAME);
  const { filters } = useTabFilters(TAB_NAME);
  
  // First get inbound file IDs
  const { data: inboundFileIds } = useQuery({
    queryKey: ['inbound-file-ids'],
    staleTime: 5 * 60 * 1000, // 5 minutes - prevents refetch on window focus
    refetchOnWindowFocus: false, // Don't refetch when user clicks back into browser
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
  const { data: inboundMetrics, refetch: refetchData, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['inbound-metrics', TAB_NAME, filters, inboundFileIds],
    staleTime: 5 * 60 * 1000, // 5 minutes - prevents constant refetching
    refetchOnWindowFocus: false, // Don't refetch when user clicks back into browser
    queryFn: async () => {
      if (!inboundFileIds || inboundFileIds.length === 0) return { 
        received: 0, 
        checkedIn: 0, 
        dailyData: [], 
        soldSameWeekSales: 0,
        soldSameWeekRetail: 0,
        avgSalePrice: 0,
        checkedInSameWeekRetail: 0,
        notCheckedInSameWeekRetail: 0,
      };
      
      // Filter out excluded file IDs
      const activeFileIds = inboundFileIds.filter(id => !filters.excludedFileIds.includes(id));
      if (activeFileIds.length === 0) return { received: 0, checkedIn: 0, dailyData: [] };
      
      // Fetch all data in batches to avoid limit issues - add ordering for consistency
      type UnitRow = { 
        trgid: string; 
        received_on: string | null; 
        checked_in_on: string | null; 
        tag_clientsource: string | null;
        effective_retail: number | null;
        sale_price: number | null;
        order_closed_date: string | null;
        master_program_name: string | null;
      };
      const allData: UnitRow[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        let query = supabase
          .from('units_canonical')
          .select('trgid, received_on, checked_in_on, tag_clientsource, effective_retail, sale_price, order_closed_date, master_program_name')
          .not('received_on', 'is', null)
          .in('file_upload_id', activeFileIds)
          .eq('tag_clientsource', 'WMUS') // WMUS exclusive
          .order('trgid', { ascending: true }); // Consistent ordering
        
        query = query.range(offset, offset + batchSize - 1);
        
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData.push(...data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      const selectedWeeks = filters.wmWeeks;
      const selectedDays = filters.wmDaysOfWeek;
      const hasWeekFilter = selectedWeeks.length > 0;
      const hasDayFilter = selectedDays.length > 0;
      
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
      
      // Start with all deduplicated units
      let filteredUnits = Array.from(trgidMap.values());
      
      // Only apply filters if they are active
      if (hasWeekFilter || hasDayFilter) {
        filteredUnits = filteredUnits.filter(unit => {
          const dateStr = unit.received_on;
          if (!dateStr) return false;
          
          if (hasWeekFilter) {
            const wmWeek = getWMWeekFromDateString(dateStr);
            if (wmWeek === null || !selectedWeeks.includes(wmWeek)) return false;
          }
          
          if (hasDayFilter) {
            const wmDay = getWMDayOfWeekFromDateString(dateStr);
            if (wmDay === null || !selectedDays.includes(wmDay)) return false;
          }
          
          return true;
        });
      }
      
      // Calculate metrics from deduplicated data
      const received = filteredUnits.length;
      const checkedIn = filteredUnits.filter(u => u.checked_in_on !== null).length;
      
      // Calculate sales metrics for items received AND sold in the same filtered week(s)
      let soldSameWeekSales = 0;
      let soldSameWeekRetail = 0;
      let soldCount = 0;
      let checkedInSameWeekRetail = 0;
      let notCheckedInSameWeekRetail = 0;
      
      filteredUnits.forEach(unit => {
        const receivedWeek = getWMWeekFromDateString(unit.received_on);
        const soldWeek = unit.order_closed_date ? getWMWeekFromDateString(unit.order_closed_date) : null;
        const checkedInWeek = unit.checked_in_on ? getWMWeekFromDateString(unit.checked_in_on) : null;
        
        // Exclude "owned" programs from sales calculations (consistent with sales logic)
        const isOwnedProgram = unit.master_program_name?.toLowerCase().includes('owned') ?? false;
        
        // Check if sold in same week as received (or within filtered weeks)
        // Exclude owned programs from sales metrics
        if (soldWeek !== null && unit.sale_price && !isOwnedProgram) {
          const isSoldInFilteredWeek = hasWeekFilter 
            ? selectedWeeks.includes(soldWeek) && selectedWeeks.includes(receivedWeek!)
            : soldWeek === receivedWeek;
          
          if (isSoldInFilteredWeek) {
            soldSameWeekSales += Number(unit.sale_price) || 0;
            soldSameWeekRetail += Number(unit.effective_retail) || 0;
            soldCount++;
          }
        }
        
        // Check if checked in same week as received (retail calculations include all programs)
        if (checkedInWeek !== null) {
          const isCheckedInSameWeek = hasWeekFilter
            ? selectedWeeks.includes(checkedInWeek) && selectedWeeks.includes(receivedWeek!)
            : checkedInWeek === receivedWeek;
          
          if (isCheckedInSameWeek) {
            checkedInSameWeekRetail += Number(unit.effective_retail) || 0;
          } else {
            notCheckedInSameWeekRetail += Number(unit.effective_retail) || 0;
          }
        } else {
          // Not checked in at all - counts as "not checked in same week"
          notCheckedInSameWeekRetail += Number(unit.effective_retail) || 0;
        }
      });
      
      const avgSalePrice = soldCount > 0 ? soldSameWeekSales / soldCount : 0;
      
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
      
      return { 
        received, 
        checkedIn, 
        dailyData,
        soldSameWeekSales,
        soldSameWeekRetail,
        avgSalePrice,
        checkedInSameWeekRetail,
        notCheckedInSameWeekRetail,
      };
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
  const soldSameWeekSales = inboundMetrics?.soldSameWeekSales || 0;
  const soldSameWeekRetail = inboundMetrics?.soldSameWeekRetail || 0;
  const avgSalePrice = inboundMetrics?.avgSalePrice || 0;
  const checkedInSameWeekRetail = inboundMetrics?.checkedInSameWeekRetail || 0;
  const notCheckedInSameWeekRetail = inboundMetrics?.notCheckedInSameWeekRetail || 0;

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

      {/* KPI Cards - Row 1: Unit Counts */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Units Received"
          value={receivedCount.toLocaleString()}
          subtitle="Total received units"
          icon={<Package className="h-5 w-5" />}
          variant="info"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Units Checked In"
          value={checkedInCount.toLocaleString()}
          subtitle="Processed through check-in"
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Check-In Rate"
          value={`${checkInRate.toFixed(1)}%`}
          subtitle="Checked in / Received"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="primary"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Pending Check-In"
          value={pendingCheckIn.toLocaleString()}
          subtitle="Awaiting processing"
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
          isLoading={isMetricsLoading}
        />
      </div>

      {/* KPI Cards - Row 2: Financial Metrics */}
      <div className="grid gap-4 md:grid-cols-5">
        <KPICard
          title="Same Week Sales $"
          value={`$${soldSameWeekSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Received & sold same week"
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Same Week Retail $"
          value={`$${soldSameWeekRetail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Retail of same week sales"
          icon={<Tag className="h-5 w-5" />}
          variant="primary"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Avg Sale Price"
          value={`$${avgSalePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Same week avg sale"
          icon={<ShoppingCart className="h-5 w-5" />}
          variant="info"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Checked In Retail $"
          value={`$${checkedInSameWeekRetail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Checked in same week"
          icon={<CheckCircle className="h-5 w-5" />}
          variant="success"
          isLoading={isMetricsLoading}
        />
        <KPICard
          title="Not Checked In Retail $"
          value={`$${notCheckedInSameWeekRetail.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Not checked in same week"
          icon={<Clock className="h-5 w-5" />}
          variant="warning"
          isLoading={isMetricsLoading}
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
