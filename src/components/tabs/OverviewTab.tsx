import { DollarSign, Package, TrendingUp, Percent, AlertTriangle, ReceiptText } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { LifecycleFunnel } from '@/components/dashboard/LifecycleFunnel';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { WeeklyTrendChart } from '@/components/dashboard/WeeklyTrendChart';
import { RecentUploads } from '@/components/dashboard/RecentUploads';
import { GlobalFilterBar } from '@/components/dashboard/GlobalFilterBar';
import { SalesBreakdown } from '@/components/dashboard/SalesBreakdown';
import { FeeBreakdown } from '@/components/dashboard/FeeBreakdown';
import { useFilters } from '@/contexts/FilterContext';
import { 
  useFilterOptions, 
  useFilteredLifecycle, 
  useFilteredSales, 
  useFilteredFees,
  useFileUploads,
  useFilteredWeeklyTrends
} from '@/hooks/useFilteredData';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
};

export function OverviewTab() {
  const { filters } = useFilters();
  
  const { data: filterOptions, refetch: refetchOptions } = useFilterOptions();
  const { data: funnel, refetch: refetchFunnel } = useFilteredLifecycle();
  const { data: salesData, refetch: refetchSales } = useFilteredSales();
  const { data: feeData, refetch: refetchFees } = useFilteredFees();
  const { data: uploads, refetch: refetchUploads } = useFileUploads();
  const { data: trends, refetch: refetchTrends } = useFilteredWeeklyTrends();

  const refetch = () => {
    refetchOptions();
    refetchFunnel();
    refetchSales();
    refetchFees();
    refetchUploads();
    refetchTrends();
  };

  // Calculate sales metrics
  const grossSales = salesData?.reduce((sum, r) => sum + (Number(r.gross_sale) || 0), 0) || 0;
  const effectiveRetail = salesData?.reduce((sum, r) => sum + (Number(r.effective_retail) || 0), 0) || 0;
  const unitsCount = salesData?.length || 0;
  const recoveryRate = effectiveRetail > 0 ? (grossSales / effectiveRetail) * 100 : 0;
  const avgSalePrice = unitsCount > 0 ? grossSales / unitsCount : 0;
  const refundTotal = salesData?.reduce((sum, r) => sum + (Number(r.refund_amount) || 0), 0) || 0;

  // Calculate fee metrics
  const totalFees = feeData?.reduce((sum, r) => sum + (Number(r.total_fees) || 0), 0) || 0;
  const feeMetrics = {
    totalFees,
    checkInFees: feeData?.reduce((sum, r) => sum + (Number(r.check_in_fee) || 0), 0) || 0,
    packagingFees: feeData?.reduce((sum, r) => sum + (Number(r.packaging_fee) || 0), 0) || 0,
    pickPackShipFees: feeData?.reduce((sum, r) => sum + (Number(r.pick_pack_ship_fee) || 0), 0) || 0,
    refurbishingFees: feeData?.reduce((sum, r) => sum + (Number(r.refurbishing_fee) || 0), 0) || 0,
    marketplaceFees: feeData?.reduce((sum, r) => sum + (Number(r.marketplace_fee) || 0), 0) || 0,
  };

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Gross Sales"
          value={formatCurrency(grossSales)}
          subtitle={`${unitsCount.toLocaleString()} units sold`}
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Recovery Rate"
          value={`${recoveryRate.toFixed(1)}%`}
          subtitle="Gross Sales / Effective Retail"
          icon={<Percent className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Avg Sale Price"
          value={formatCurrency(avgSalePrice)}
          subtitle="Per unit average"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Total Fees"
          value={formatCurrency(totalFees)}
          subtitle="Processing & marketplace"
          icon={<ReceiptText className="h-5 w-5" />}
          variant="warning"
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Funnel & Upload */}
        <div className="space-y-6">
          <LifecycleFunnel data={funnel || []} />
          <FileUploadZone onUploadComplete={refetch} />
        </div>

        {/* Center Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          <WeeklyTrendChart data={trends || []} />
          
          <div className="grid gap-6 md:grid-cols-2">
            <SalesBreakdown />
            <FeeBreakdown data={feeMetrics} />
          </div>
        </div>
      </div>

      {/* Recent Uploads */}
      <RecentUploads uploads={uploads || []} />

      {/* Refund Warning Card */}
      {refundTotal > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-warning">Refund Exposure</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(refundTotal)} in refunds tracked separately. 
              This does NOT reduce Gross Sales as per operational reporting requirements.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
