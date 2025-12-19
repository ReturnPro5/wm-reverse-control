import { DollarSign, Package, TrendingUp, Percent, AlertTriangle, ReceiptText } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { LifecycleFunnel } from '@/components/dashboard/LifecycleFunnel';
import { FileUploadZone } from '@/components/dashboard/FileUploadZone';
import { WeeklyTrendChart } from '@/components/dashboard/WeeklyTrendChart';
import { FileManager } from '@/components/dashboard/FileManager';
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
import { calculateTotalFees } from '@/lib/feeCalculator';

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

  // Calculate fees using the new fee calculator (line-item based)
  // Map all fields including invoiced fee columns for hierarchy precedence
  const calculatedFees = salesData ? calculateTotalFees(salesData.map(s => {
    const sale = s as Record<string, unknown>;
    return {
      sale_price: Number(s.sale_price) || 0,
      category_name: s.category_name,
      program_name: s.program_name,
      marketplace_profile_sold_on: s.marketplace_profile_sold_on,
      facility: s.facility,
      effective_retail: Number(s.effective_retail) || 0,
      tag_clientsource: s.tag_clientsource,
      refund_amount: Number(s.refund_amount) || 0,
      discount_amount: Number(s.discount_amount) || 0,
      // Vendor pallet/invoice fields
      sorting_index: sale.sorting_index as string | null,
      vendor_invoice_total: Number(sale.vendor_invoice_total) || null,
      service_invoice_total: Number(sale.service_invoice_total) || null,
      expected_hv_as_is_refurb_fee: Number(sale.expected_hv_as_is_refurb_fee) || null,
      // Invoiced fee columns (hierarchy: invoiced > calculated > rule-based)
      invoiced_check_in_fee: Number(sale.invoiced_check_in_fee) || null,
      invoiced_refurb_fee: Number(sale.invoiced_refurb_fee) || null,
      invoiced_overbox_fee: Number(sale.invoiced_overbox_fee) || null,
      invoiced_packaging_fee: Number(sale.invoiced_packaging_fee) || null,
      invoiced_pps_fee: Number(sale.invoiced_pps_fee) || null,
      invoiced_shipping_fee: Number(sale.invoiced_shipping_fee) || null,
      invoiced_merchant_fee: Number(sale.invoiced_merchant_fee) || null,
      invoiced_revshare_fee: Number(sale.invoiced_revshare_fee) || null,
      invoiced_3pmp_fee: Number(sale.invoiced_3pmp_fee) || null,
      invoiced_marketing_fee: Number(sale.invoiced_marketing_fee) || null,
      invoiced_refund_fee: Number(sale.invoiced_refund_fee) || null,
    };
  })) : { 
    totalFees: 0, 
    netDollars: 0,
    breakdown: { 
      checkInFees: 0, refurbFees: 0, overboxFees: 0, packagingFees: 0, 
      ppsFees: 0, shippingFees: 0, merchantFees: 0, revshareFees: 0, 
      thirdPartyMPFees: 0, marketingFees: 0, refundFees: 0 
    } 
  };
  
  // Net Dollars = Gross Sales - Total Fees (calculated per line item then aggregated)
  const netSales = calculatedFees.netDollars;

  // Build fee metrics for display using calculated fees (not database fees)
  const feeMetrics = {
    totalFees: calculatedFees.totalFees,
    netDollars: calculatedFees.netDollars,
    checkInFees: calculatedFees.breakdown.checkInFees,
    refurbFees: calculatedFees.breakdown.refurbFees,
    overboxFees: calculatedFees.breakdown.overboxFees,
    packagingFees: calculatedFees.breakdown.packagingFees,
    ppsFees: calculatedFees.breakdown.ppsFees,
    shippingFees: calculatedFees.breakdown.shippingFees,
    merchantFees: calculatedFees.breakdown.merchantFees,
    revshareFees: calculatedFees.breakdown.revshareFees,
    thirdPartyMPFees: calculatedFees.breakdown.thirdPartyMPFees,
    marketingFees: calculatedFees.breakdown.marketingFees,
    refundFees: calculatedFees.breakdown.refundFees,
  };

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
      {/* Global Filters */}
      <GlobalFilterBar
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Gross Sales"
          value={formatCurrency(grossSales)}
          subtitle={`${unitsCount.toLocaleString()} units sold`}
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
        />
        <KPICard
          title="Net Sales"
          value={formatCurrency(netSales)}
          subtitle="Gross - Calculated Fees"
          icon={<DollarSign className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Recovery Rate"
          value={`${recoveryRate.toFixed(1)}%`}
          subtitle="Gross Sales / Effective Retail"
          icon={<Percent className="h-5 w-5" />}
          variant="info"
        />
        <KPICard
          title="Avg Sale Price"
          value={formatCurrency(avgSalePrice)}
          subtitle="Per unit average"
          icon={<TrendingUp className="h-5 w-5" />}
          variant="default"
        />
        <KPICard
          title="Total Fees"
          value={formatCurrency(feeMetrics.totalFees)}
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

      {/* File Management */}
      <FileManager uploads={uploads || []} onRefresh={refetch} />

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
