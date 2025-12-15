import { DollarSign, Package, TrendingUp, Percent, AlertTriangle, ReceiptText } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { LifecycleFunnel } from '@/components/dashboard/LifecycleFunnel';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { WeeklyTrendChart } from '@/components/dashboard/WeeklyTrendChart';
import { RecentUploads } from '@/components/dashboard/RecentUploads';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { SalesBreakdown } from '@/components/dashboard/SalesBreakdown';
import { FeeBreakdown } from '@/components/dashboard/FeeBreakdown';
import { useDashboardData, DashboardFilters } from '@/hooks/useDashboardData';
import { useState } from 'react';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

export function OverviewTab() {
  const [filters, setFilters] = useState<DashboardFilters>({});
  
  const {
    lifecycleFunnel,
    salesMetrics,
    feeMetrics,
    fileUploads,
    filterOptions,
    weeklyTrends,
    currentWmWeek,
    refetch,
  } = useDashboardData(filters);

  const sales = salesMetrics.data;
  const fees = feeMetrics.data;
  const funnel = lifecycleFunnel.data || [];
  const uploads = fileUploads.data || [];
  const trends = weeklyTrends.data || [];
  const options = filterOptions.data || { programs: [], categories: [], facilities: [] };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <FilterBar
        wmWeek={filters.wmWeek}
        onWmWeekChange={(w) => setFilters(f => ({ ...f, wmWeek: w }))}
        programName={filters.programName}
        onProgramNameChange={(p) => setFilters(f => ({ ...f, programName: p }))}
        facility={filters.facility}
        onFacilityChange={(f) => setFilters(prev => ({ ...prev, facility: f }))}
        programs={options.programs}
        facilities={options.facilities}
        onRefresh={refetch}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Gross Sales"
          value={formatCurrency(sales?.grossSales || 0)}
          subtitle={`${sales?.unitsCount.toLocaleString() || 0} units sold`}
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Recovery Rate"
          value={`${(sales?.recoveryRate || 0).toFixed(1)}%`}
          subtitle="Gross Sales / Effective Retail"
          icon={<Percent className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Avg Sale Price"
          value={formatCurrency(sales?.avgSalePrice || 0)}
          subtitle="Per unit average"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Total Fees"
          value={formatCurrency(fees?.totalFees || 0)}
          subtitle="Processing & marketplace"
          icon={<ReceiptText className="h-5 w-5" />}
          variant="warning"
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Funnel & Upload */}
        <div className="space-y-6">
          <LifecycleFunnel data={funnel} />
          <FileUploadZone onUploadComplete={refetch} />
        </div>

        {/* Center Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          <WeeklyTrendChart data={trends} />
          
          <div className="grid gap-6 md:grid-cols-2">
            <SalesBreakdown wmWeek={filters.wmWeek} />
            <FeeBreakdown data={fees} />
          </div>
        </div>
      </div>

      {/* Recent Uploads */}
      <RecentUploads uploads={uploads} />

      {/* Refund Warning Card */}
      {sales && sales.refundTotal > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-warning">Refund Exposure</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(sales.refundTotal)} in refunds tracked separately. 
              This does NOT reduce Gross Sales as per operational reporting requirements.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}