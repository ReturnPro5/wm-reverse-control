// Fee Calculator - Calculates various fees for sales records

export interface SaleRecord {
  trgid?: string;
  sale_price: number;
  gross_sale?: number;
  effective_retail?: number | null;
  program_name?: string | null;
  master_program_name?: string | null;
  category_name?: string | null;
  marketplace_profile_sold_on?: string | null;
  facility?: string | null;
  tag_clientsource?: string | null;
  tag_pricing_condition?: string | null;
  sorting_index?: string | null;
  b2c_auction?: string | null;
  refund_amount?: number | null;
  discount_amount?: number | null;
  
  // Invoiced fees
  invoiced_check_in_fee?: number | null;
  invoiced_refurb_fee?: number | null;
  invoiced_overbox_fee?: number | null;
  invoiced_packaging_fee?: number | null;
  invoiced_pps_fee?: number | null;
  invoiced_shipping_fee?: number | null;
  invoiced_merchant_fee?: number | null;
  invoiced_3pmp_fee?: number | null;
  invoiced_revshare_fee?: number | null;
  invoiced_marketing_fee?: number | null;
  invoiced_refund_fee?: number | null;
  
  // Calculated fees
  calculated_check_in_fee?: number | null;
  
  // Invoice totals
  service_invoice_total?: number | null;
  vendor_invoice_total?: number | null;
  expected_hv_as_is_refurb_fee?: number | null;
}

export interface CalculatedFees {
  checkInFee: number;
  refurbFee: number;
  overboxFee: number;
  packagingFee: number;
  ppsFee: number;
  shippingFee: number;
  merchantFee: number;
  thirdPartyMPFee: number;
  revshareFee: number;
  marketingFee: number;
  refundFee: number;
  totalFees: number;
}

export interface FeeBreakdownAggregated {
  checkInFees: number;
  refurbFees: number;
  overboxFees: number;
  packagingFees: number;
  ppsFees: number;
  shippingFees: number;
  merchantFees: number;
  revshareFees: number;
  thirdPartyMPFees: number;
  marketingFees: number;
  refundFees: number;
}

// Helper functions
function isPalletSale(sale: SaleRecord): boolean {
  const programName = sale.program_name?.toLowerCase() || '';
  return programName.includes('pallet');
}

function isVendorInvoiced(sale: SaleRecord): boolean {
  return (sale.vendor_invoice_total ?? 0) > 0;
}

function isB2C(sale: SaleRecord): boolean {
  const marketplace = sale.marketplace_profile_sold_on?.toLowerCase() || '';
  return marketplace.includes('ebay') || marketplace.includes('amazon') || marketplace.includes('shopify');
}

function isWMUS(sale: SaleRecord): boolean {
  const clientSource = sale.tag_clientsource?.toLowerCase() || '';
  return clientSource.includes('wmus') || clientSource.includes('walmart');
}

// Fee calculation functions
function calculate3PMPFee(sale: SaleRecord): number {
  // Use invoiced fee if available
  if (sale.invoiced_3pmp_fee && sale.invoiced_3pmp_fee > 0) {
    return sale.invoiced_3pmp_fee;
  }
  
  // Otherwise calculate based on marketplace rules
  const marketplace = sale.marketplace_profile_sold_on?.toLowerCase() || '';
  const salePrice = sale.sale_price || 0;
  
  if (marketplace.includes('ebay')) {
    return salePrice * 0.13; // 13% eBay fee
  } else if (marketplace.includes('amazon')) {
    return salePrice * 0.15; // 15% Amazon fee
  }
  
  return 0;
}

function calculateCheckInFee(sale: SaleRecord): number {
  // Use calculated fee if available
  if (sale.calculated_check_in_fee && sale.calculated_check_in_fee > 0) {
    return sale.calculated_check_in_fee;
  }
  
  // Use invoiced fee if available
  if (sale.invoiced_check_in_fee && sale.invoiced_check_in_fee > 0) {
    return sale.invoiced_check_in_fee;
  }
  
  // Skip for pallet sales and vendor-invoiced items
  if (isPalletSale(sale) || isVendorInvoiced(sale)) {
    return 0;
  }
  
  // WMUS-only check-in fee calculation
  if (!isWMUS(sale)) {
    return 0;
  }
  
  return 0; // Default to 0 if no specific calculation applies
}

function calculateRefurbFee(sale: SaleRecord): number {
  // Use invoiced fee if available
  if (sale.invoiced_refurb_fee && sale.invoiced_refurb_fee > 0) {
    return sale.invoiced_refurb_fee;
  }
  
  // Use expected fee for pallet sales
  if (isPalletSale(sale) && sale.expected_hv_as_is_refurb_fee) {
    return sale.expected_hv_as_is_refurb_fee;
  }
  
  return 0;
}

function calculateOverboxFee(sale: SaleRecord): number {
  return sale.invoiced_overbox_fee || 0;
}

function calculatePackagingFee(sale: SaleRecord): number {
  return sale.invoiced_packaging_fee || 0;
}

function calculatePPSFee(sale: SaleRecord): number {
  return sale.invoiced_pps_fee || 0;
}

function calculateShippingFee(sale: SaleRecord): number {
  return sale.invoiced_shipping_fee || 0;
}

function calculateMerchantFee(sale: SaleRecord): number {
  return sale.invoiced_merchant_fee || 0;
}

function calculateRevshareFee(sale: SaleRecord): number {
  return sale.invoiced_revshare_fee || 0;
}

function calculateMarketingFee(sale: SaleRecord): number {
  return sale.invoiced_marketing_fee || 0;
}

function calculateRefundFee(sale: SaleRecord): number {
  return sale.invoiced_refund_fee || 0;
}

// Main fee calculation function
export function calculateFeesForSale(sale: SaleRecord): CalculatedFees {
  const checkInFee = calculateCheckInFee(sale);
  const refurbFee = calculateRefurbFee(sale);
  const overboxFee = calculateOverboxFee(sale);
  const packagingFee = calculatePackagingFee(sale);
  const ppsFee = calculatePPSFee(sale);
  const shippingFee = calculateShippingFee(sale);
  const merchantFee = calculateMerchantFee(sale);
  const thirdPartyMPFee = calculate3PMPFee(sale);
  const revshareFee = calculateRevshareFee(sale);
  const marketingFee = calculateMarketingFee(sale);
  const refundFee = calculateRefundFee(sale);
  
  const totalFees = 
    checkInFee + refurbFee + overboxFee + packagingFee + ppsFee +
    shippingFee + merchantFee + thirdPartyMPFee + revshareFee +
    marketingFee + refundFee;
  
  return {
    checkInFee,
    refurbFee,
    overboxFee,
    packagingFee,
    ppsFee,
    shippingFee,
    merchantFee,
    thirdPartyMPFee,
    revshareFee,
    marketingFee,
    refundFee,
    totalFees,
  };
}

export function calculateNetDollarsForSale(sale: SaleRecord, fees: CalculatedFees): number {
  const grossSale = sale.gross_sale || 0;
  
  // For vendor-invoiced items, use vendor invoice total
  if (isVendorInvoiced(sale)) {
    return (sale.vendor_invoice_total || 0) - fees.totalFees;
  }
  
  return grossSale - fees.totalFees;
}

export function calculateTotalFees(sales: SaleRecord[]): {
  totalFees: number;
  netDollars: number;
  breakdown: FeeBreakdownAggregated;
} {
  const breakdown: FeeBreakdownAggregated = {
    checkInFees: 0,
    refurbFees: 0,
    overboxFees: 0,
    packagingFees: 0,
    ppsFees: 0,
    shippingFees: 0,
    merchantFees: 0,
    revshareFees: 0,
    thirdPartyMPFees: 0,
    marketingFees: 0,
    refundFees: 0,
  };
  
  let totalFees = 0;
  let netDollars = 0;
  let wmusCount = 0;
  let nonWmusCount = 0;
  
  for (const sale of sales) {
    const fees = calculateFeesForSale(sale);
    const netForSale = calculateNetDollarsForSale(sale, fees);
    
    breakdown.checkInFees += fees.checkInFee;
    breakdown.refurbFees += fees.refurbFee;
    breakdown.overboxFees += fees.overboxFee;
    breakdown.packagingFees += fees.packagingFee;
    breakdown.ppsFees += fees.ppsFee;
    breakdown.shippingFees += fees.shippingFee;
    breakdown.merchantFees += fees.merchantFee;
    breakdown.revshareFees += fees.revshareFee;
    breakdown.thirdPartyMPFees += fees.thirdPartyMPFee;
    breakdown.marketingFees += fees.marketingFee;
    breakdown.refundFees += fees.refundFee;
    
    totalFees += fees.totalFees;
    netDollars += netForSale;
    
    if (isWMUS(sale)) {
      wmusCount++;
    } else {
      nonWmusCount++;
    }
  }
  
  return { totalFees, netDollars, breakdown };
}

// Legacy interface for backwards compatibility
export function calculateTotalFeesLegacy(sales: SaleRecord[]): {
  totalFees: number;
  breakdown: FeeBreakdownAggregated;
} {
  const result = calculateTotalFees(sales);
  return {
    totalFees: result.totalFees,
    breakdown: result.breakdown,
  };
}
