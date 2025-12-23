// Fee Calculator - 3P Marketplace Fee + Check-In Fee
// All other fees return 0 until verified correct

import { getCheckInFeeFromLookup } from '@/data/checkinFeeLookup';

// ============================================================================
// TYPES
// ============================================================================

export interface SaleRecord {
  sale_price: number;
  category_name: string | null;
  program_name: string | null;
  marketplace_profile_sold_on: string | null;
  facility: string | null;
  effective_retail?: number | null;
  mr_lmr_upc_average_category_retail?: number | null;
  tag_clientsource?: string | null;
  refund_amount?: number | null;
  discount_amount?: number | null;
  // Invoiced fee columns
  invoiced_check_in_fee?: number | null;
  invoiced_refurb_fee?: number | null;
  invoiced_overbox_fee?: number | null;
  invoiced_packaging_fee?: number | null;
  invoiced_pps_fee?: number | null;
  invoiced_shipping_fee?: number | null;
  invoiced_merchant_fee?: number | null;
  invoiced_revshare_fee?: number | null;
  invoiced_3pmp_fee?: number | null;
  invoiced_marketing_fee?: number | null;
  invoiced_refund_fee?: number | null;
  // Calculated fee columns (from database)
  calculated_3pmp_fee?: number | null;
  calculated_check_in_fee?: number | null;
  // Other fields
  sorting_index?: string | null;
  vendor_invoice_total?: number | null;
  service_invoice_total?: number | null;
  expected_hv_as_is_refurb_fee?: number | null;
  tag_pricing_condition?: string | null;
  b2c_auction?: string | null;
  master_program_name?: string | null;
}

export interface CalculatedFees {
  checkInFee: number;
  refurbFee: number;
  overboxFee: number;
  packagingFee: number;
  ppsFee: number;
  shippingFee: number;
  merchantFee: number;
  revshareFee: number;
  thirdPartyMPFee: number;
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

// ============================================================================
// 3P MARKETPLACE FEE - FINAL RULESET (WMUS ONLY)
// ============================================================================

/**
 * Step 0: Client Gate - WMUS only
 * Step 1: Hierarchy - Invoiced → Calculated → Fee Bible → 0
 * Step 2: Fee Bible Rules (only if steps 1 & 2 are blank)
 */
const calculate3PMPFee = (sale: SaleRecord): number => {
  // -------------------------------------------------------------------------
  // STEP 0: CLIENT GATE - Only WMUS gets 3PMP fees
  // -------------------------------------------------------------------------
  const clientSource = (sale.tag_clientsource || '').toUpperCase().trim();
  if (clientSource !== 'WMUS') {
    return 0;
  }

  // -------------------------------------------------------------------------
  // STEP 1: UNIVERSAL FEE HIERARCHY
  // -------------------------------------------------------------------------
  
  // 1a. If ServiceThirdPartyMarketplaceFeeInvoiced is not blank → ABS(value)
  if (sale.invoiced_3pmp_fee != null && sale.invoiced_3pmp_fee !== 0) {
    return Math.abs(sale.invoiced_3pmp_fee);
  }
  
  // 1b. If ServiceThirdPartyMarketplaceFeeCalculated is not blank → value
  if (sale.calculated_3pmp_fee != null && sale.calculated_3pmp_fee !== 0) {
    return sale.calculated_3pmp_fee;
  }

  // -------------------------------------------------------------------------
  // STEP 2: EXPLICIT FEE BIBLE RULES (only if invoiced & calculated are blank)
  // -------------------------------------------------------------------------
  
  const salePrice = Number(sale.sale_price) || 0;
  if (salePrice <= 0) return 0;
  
  const marketplace = (sale.marketplace_profile_sold_on || '').toLowerCase().trim();
  const category = (sale.category_name || '').toLowerCase().trim();
  const b2cAuction = (sale.b2c_auction || '').toLowerCase().trim();
  
  // Rule: If Marketplace contains DSV OR in store → 0
  if (marketplace.includes('dsv') || marketplace.includes('in store') || marketplace.includes('instore')) {
    return 0;
  }
  
  // Rule: If Order Type Sold On <> "B2CMarketplace" → 0
  // We check if b2c_auction indicates B2C, or if marketplace indicates non-B2C
  const isB2CMarketplace = isB2C(marketplace, b2cAuction);
  if (!isB2CMarketplace) {
    return 0;
  }
  
  // Rule: If Marketplace = WhatNot → 17%
  if (marketplace.includes('whatnot')) {
    return salePrice * 0.17;
  }
  
  // Rule: If Marketplace = Wish → 20%
  if (marketplace.includes('wish')) {
    return salePrice * 0.20;
  }
  
  // Rule: If Marketplace = eBay → 12% (flat rate, no Electronics discount)
  if (marketplace.includes('ebay')) {
    return salePrice * 0.12;
  }
  
  // Rule: If Marketplace = Walmart Marketplace → 12% (flat rate, no Electronics discount)
  if (marketplace.includes('walmart') && marketplace.includes('marketplace')) {
    return salePrice * 0.12;
  }
  
  // Rule: If Marketplace = Shopify/VipOutlet → 12%
  if (marketplace.includes('shopify') || marketplace.includes('vipoutlet')) {
    return salePrice * 0.12;
  }
  
  // No fallback - only explicitly matched B2C marketplaces get fees
  return 0;
};

/**
 * Helper: Determine if sale is B2C Marketplace
 */
const isB2C = (marketplace: string, b2cAuction: string): boolean => {
  // If b2c_auction explicitly indicates B2C
  if (b2cAuction === 'b2cmarketplace' || b2cAuction === 'b2c') {
    return true;
  }
  
  // BLANK or empty marketplace = NOT B2C (no 12% fallback)
  if (!marketplace || marketplace.length === 0) {
    return false;
  }
  
  // Exclusions - these are NOT B2C
  if (marketplace.includes('directliquidation') || marketplace === 'dl') return false;
  if (marketplace.includes('dl2')) return false;  // Added DL2
  if (marketplace.includes('gowholesale')) return false;
  if (marketplace.includes('manual') && !marketplace.includes('whatnot')) return false;  // Manual but not WhatNot
  if (marketplace.includes('dsv')) return false;
  if (marketplace.includes('transfer')) return false;
  if (marketplace.includes('in store')) return false;
  if (marketplace.includes('b2b')) return false;
  if (marketplace.includes('wholesale')) return false;
  if (marketplace.includes('pallet')) return false;
  if (marketplace.includes('truckload')) return false;
  
  // Known B2C marketplaces - ONLY these get fees
  if (marketplace.includes('ebay')) return true;
  if (marketplace.includes('amazon')) return true;
  if (marketplace.includes('whatnot')) return true;
  if (marketplace.includes('wish')) return true;
  if (marketplace.includes('shopify')) return true;
  if (marketplace.includes('vipoutlet')) return true;
  if (marketplace.includes('walmart') && marketplace.includes('marketplace')) return true;
  if (marketplace.includes('flashfindz')) return true;
  
  // Unknown marketplace = NOT B2C (no fee)
  return false;
};

// ============================================================================
// PLACEHOLDER FEES - Return 0 until implemented
// ============================================================================

/**
 * Check-In Fee Calculation
 * Hierarchy:
 * 1. If invoiced_check_in_fee is not blank → ABS(value)
 * 2. If master_program_name CONTAINS "boxes" (case-insensitive) → $1.30
 * 3. If calculated_check_in_fee is not blank → use it
 * 4. Key lookup from CSV using category_name + program_name → Price
 * 5. Else → $0
 */
const calculateCheckInFee = (sale: SaleRecord): number => {
  // Step 1: Invoiced fee takes priority
  if (sale.invoiced_check_in_fee != null && sale.invoiced_check_in_fee !== 0) {
    return Math.abs(sale.invoiced_check_in_fee);
  }
  
  // Step 2: Master program contains "boxes" → $1.30
  const masterProgram = (sale.master_program_name || '').toLowerCase();
  if (masterProgram.includes('boxes')) {
    return 1.30;
  }
  
  // Step 3: Calculated fee from database (CheckInFeeCalculated)
  if (sale.calculated_check_in_fee != null && sale.calculated_check_in_fee !== 0) {
    return sale.calculated_check_in_fee;
  }
  
  // Step 4: Key lookup from CSV
  const lookupFee = getCheckInFeeFromLookup(sale.category_name, sale.program_name);
  if (lookupFee > 0) {
    return lookupFee;
  }
  
  // Step 5: Default
  return 0;
};

const calculateRefurbFee = (_sale: SaleRecord): number => {
  // TODO: Implement after Check-In is verified correct
  return 0;
};

const calculateOverboxFee = (_sale: SaleRecord): number => {
  // TODO: Implement
  return 0;
};

const calculatePackagingFee = (_sale: SaleRecord): number => {
  // TODO: Implement
  return 0;
};

const calculatePPSFee = (_sale: SaleRecord): number => {
  // TODO: Implement
  return 0;
};

const calculateShippingFee = (_sale: SaleRecord): number => {
  // TODO: Implement
  return 0;
};

const calculateMerchantFee = (_sale: SaleRecord): number => {
  // TODO: Implement
  return 0;
};

const calculateRevshareFee = (_sale: SaleRecord): number => {
  // TODO: Implement
  return 0;
};

const calculateMarketingFee = (_sale: SaleRecord): number => {
  // TODO: Implement
  return 0;
};

const calculateRefundFee = (_sale: SaleRecord): number => {
  // TODO: Implement
  return 0;
};

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

export const calculateFeesForSale = (sale: SaleRecord): CalculatedFees => {
  // Only 3PMP is active - all others return 0
  const thirdPartyMPFee = calculate3PMPFee(sale);
  
  const checkInFee = calculateCheckInFee(sale);
  const refurbFee = calculateRefurbFee(sale);
  const overboxFee = calculateOverboxFee(sale);
  const packagingFee = calculatePackagingFee(sale);
  const ppsFee = calculatePPSFee(sale);
  const shippingFee = calculateShippingFee(sale);
  const merchantFee = calculateMerchantFee(sale);
  const revshareFee = calculateRevshareFee(sale);
  const marketingFee = calculateMarketingFee(sale);
  const refundFee = calculateRefundFee(sale);
  
  const totalFees = checkInFee + refurbFee + overboxFee + packagingFee + ppsFee + 
                    shippingFee + merchantFee + revshareFee + thirdPartyMPFee + 
                    marketingFee + refundFee;
  
  return {
    checkInFee,
    refurbFee,
    overboxFee,
    packagingFee,
    ppsFee,
    shippingFee,
    merchantFee,
    revshareFee,
    thirdPartyMPFee,
    marketingFee,
    refundFee,
    totalFees
  };
};

export const calculateNetDollarsForSale = (sale: SaleRecord, fees: CalculatedFees): number => {
  const salePrice = Number(sale.sale_price) || 0;
  
  // Vendor-Invoiced Items
  if (sale.vendor_invoice_total != null && sale.vendor_invoice_total !== 0) {
    const vendorTotal = Number(sale.vendor_invoice_total) || 0;
    const serviceTotal = Number(sale.service_invoice_total) || 0;
    return vendorTotal + serviceTotal;
  }
  
  // Standard: Sale Price - Fees
  return salePrice - fees.totalFees;
};

export const calculateTotalFees = (sales: SaleRecord[]): {
  totalFees: number;
  netDollars: number;
  breakdown: FeeBreakdownAggregated;
} => {
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
    refundFees: 0
  };
  
  let totalFees = 0;
  let netDollars = 0;
  let wmusCount = 0;
  let nonWmusCount = 0;
  
  for (const sale of sales) {
    const fees = calculateFeesForSale(sale);
    
    // Track WMUS vs non-WMUS
    const clientSource = (sale.tag_clientsource || '').toUpperCase().trim();
    if (clientSource === 'WMUS') {
      wmusCount++;
    } else {
      nonWmusCount++;
    }
    
    // Aggregate fees
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
    
    netDollars += calculateNetDollarsForSale(sale, fees);
  }
  
  console.log('Fee calculation summary:', {
    totalSales: sales.length,
    wmusCount,
    nonWmusCount,
    totalFees,
    netDollars,
    breakdown
  });
  
  return { totalFees, netDollars, breakdown };
};

// Legacy interface for backward compatibility
export interface LegacyFeeBreakdown {
  checkInFees: number;
  ppsFees: number;
  refurbFees: number;
  marketplaceFees: number;
  revshareFees: number;
  marketingFees: number;
}

export const calculateTotalFeesLegacy = (sales: SaleRecord[]): {
  totalFees: number;
  breakdown: LegacyFeeBreakdown;
} => {
  const result = calculateTotalFees(sales);
  return {
    totalFees: result.totalFees,
    breakdown: {
      checkInFees: result.breakdown.checkInFees,
      ppsFees: result.breakdown.ppsFees,
      refurbFees: result.breakdown.refurbFees,
      marketplaceFees: result.breakdown.thirdPartyMPFees,
      revshareFees: result.breakdown.revshareFees,
      marketingFees: result.breakdown.marketingFees
    }
  };
};
