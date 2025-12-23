// feeCalculator.ts
// Fee Calculator - 3P Marketplace Fee + Check-In Fee (+ pallet expected refurb fee)
// 3PMP stays as-is per your instruction
// Check-In updated to:
// - WMUS only
// - Pallet/vendor-invoiced rows get 0 check-in
// - ABS always for invoiced + calculated
// - Boxes programs have their own ($1.30)
// - Lookup fallback

import { getCheckInFeeFromLookup } from "@/data/checkinFeeLookup";

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

  // Calculated fee columns (from DB / CSV)
  calculated_3pmp_fee?: number | null;
  calculated_check_in_fee?: number | null;

  // Other fields
  sorting_index?: string | null; // Pallet identifier: if blank -> NOT pallet
  vendor_invoice_total?: number | null; // Pallet/vendor invoiced indicator
  service_invoice_total?: number | null;

  expected_hv_as_is_refurb_fee?: number | null; // Pallet expected refurb fee (pallets only)

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
// HELPERS
// ============================================================================

const toUpper = (v: unknown) => String(v ?? "").toUpperCase().trim();
const toLower = (v: unknown) => String(v ?? "").toLowerCase().trim();

const isNonZeroNumber = (v: unknown): v is number =>
  typeof v === "number" && !Number.isNaN(v) && v !== 0;

const absIfNumber = (v: unknown): number => {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.abs(v);
};

const isBlank = (v: unknown) => String(v ?? "").trim() === "";

// Pallet sale rule per your spec:
// - sorting_index blank => NOT pallet
// - sorting_index NOT blank => pallet
const isPalletSale = (sale: SaleRecord): boolean => {
  return !isBlank(sale.sorting_index);
};

// Vendor-invoiced indicator (these are pallet/vendor invoiced items)
// Your week-45 math only works when we exclude these from check-in.
const isVendorInvoiced = (sale: SaleRecord): boolean => {
  return isNonZeroNumber(sale.vendor_invoice_total);
};

// ============================================================================
// 3P MARKETPLACE FEE - FINAL RULESET (WMUS ONLY)  (UNCHANGED)
// ============================================================================

const calculate3PMPFee = (sale: SaleRecord): number => {
  // STEP 0: WMUS gate
  const clientSource = toUpper(sale.tag_clientsource);
  if (clientSource !== "WMUS") return 0;

  // STEP 1: Invoiced → Calculated → Fee Bible → 0
  if (sale.invoiced_3pmp_fee != null && sale.invoiced_3pmp_fee !== 0) {
    return Math.abs(sale.invoiced_3pmp_fee);
  }

  if (sale.calculated_3pmp_fee != null && sale.calculated_3pmp_fee !== 0) {
    return sale.calculated_3pmp_fee;
  }

  // STEP 2: Fee Bible
  const salePrice = Number(sale.sale_price) || 0;
  if (salePrice <= 0) return 0;

  const marketplace = toLower(sale.marketplace_profile_sold_on);
  const b2cAuction = toLower(sale.b2c_auction);

  // DSV / In Store => 0
  if (marketplace.includes("dsv") || marketplace.includes("in store") || marketplace.includes("instore")) {
    return 0;
  }

  const isB2CMarketplace = isB2C(marketplace, b2cAuction);
  if (!isB2CMarketplace) return 0;

  if (marketplace.includes("whatnot")) return salePrice * 0.17;
  if (marketplace.includes("wish")) return salePrice * 0.2;

  // eBay => 12%
  if (marketplace.includes("ebay")) return salePrice * 0.12;

  // Walmart Marketplace => 12%
  if (marketplace.includes("walmart") && marketplace.includes("marketplace")) return salePrice * 0.12;

  // Shopify / VIPOutlet => 12%
  if (marketplace.includes("shopify") || marketplace.includes("vipoutlet")) return salePrice * 0.12;

  return 0;
};

const isB2C = (marketplace: string, b2cAuction: string): boolean => {
  if (b2cAuction === "b2cmarketplace" || b2cAuction === "b2c") return true;

  if (!marketplace) return false;

  if (marketplace.includes("directliquidation") || marketplace === "dl") return false;
  if (marketplace.includes("dl2")) return false;
  if (marketplace.includes("gowholesale")) return false;
  if (marketplace.includes("manual") && !marketplace.includes("whatnot")) return false;
  if (marketplace.includes("dsv")) return false;
  if (marketplace.includes("transfer")) return false;
  if (marketplace.includes("in store")) return false;
  if (marketplace.includes("b2b")) return false;
  if (marketplace.includes("wholesale")) return false;
  if (marketplace.includes("pallet")) return false;
  if (marketplace.includes("truckload")) return false;

  if (marketplace.includes("ebay")) return true;
  if (marketplace.includes("amazon")) return true;
  if (marketplace.includes("whatnot")) return true;
  if (marketplace.includes("wish")) return true;
  if (marketplace.includes("shopify")) return true;
  if (marketplace.includes("vipoutlet")) return true;
  if (marketplace.includes("walmart") && marketplace.includes("marketplace")) return true;
  if (marketplace.includes("flashfindz")) return true;

  return false;
};

// ============================================================================
// CHECK-IN FEE (UPDATED)
// ============================================================================

/**
 * Check-In Fee Calculation (WMUS ONLY)
 *
 * IMPORTANT UPDATES:
 * - WMUS only
 * - Pallet/vendor-invoiced rows get 0 check-in (this is what pulls Week 45 to ~15K)
 * - ABS always for invoiced + calculated
 * - "boxes" master program => $1.30
 *
 * Hierarchy:
 * 0. WMUS gate
 * 0b. If pallet/vendor-invoiced => 0
 * 1. Invoiced (ABS)
 * 2. "boxes" program => $1.30
 * 3. Calculated (ABS)
 * 4. Lookup (category + program)
 * 5. Else 0
 */
const calculateCheckInFee = (sale: SaleRecord): number => {
  // WMUS only
  const clientSource = toUpper(sale.tag_clientsource);
  if (clientSource !== "WMUS") return 0;

  // Pallets/vendor-invoiced should NOT get check-in fee
  // (this is the key fix that moved Week 45 from ~38K down to ~15K)
  if (isVendorInvoiced(sale) || isPalletSale(sale)) {
    return 0;
  }

  // 1) Invoiced fee (ABS)
  if (sale.invoiced_check_in_fee != null && sale.invoiced_check_in_fee !== 0) {
    return Math.abs(sale.invoiced_check_in_fee);
  }

  // 2) Boxes special rule
  const masterProgram = toLower(sale.master_program_name);
  if (masterProgram.includes("boxes")) {
    return 1.3;
  }

  // 3) Calculated fee (ABS)
  if (sale.calculated_check_in_fee != null && sale.calculated_check_in_fee !== 0) {
    return Math.abs(sale.calculated_check_in_fee);
  }

  // 4) Lookup fallback
  const lookupFee = getCheckInFeeFromLookup(sale.category_name, sale.program_name);
  if (lookupFee > 0) return lookupFee;

  return 0;
};

// ============================================================================
// PALLET EXPECTED FEE (REFURB) - PALLETS ONLY (sorting_index NOT blank)
// ============================================================================

/**
 * Expected HV AS-IS Refurb Fee
 * - ONLY apply for pallets (sorting_index NOT blank)
 * - ABS always
 * - Else 0
 */
const calculateRefurbFee = (sale: SaleRecord): number => {
  if (!isPalletSale(sale)) return 0;

  // Use expected pallet fee field if present
  if (sale.expected_hv_as_is_refurb_fee != null && sale.expected_hv_as_is_refurb_fee !== 0) {
    return Math.abs(sale.expected_hv_as_is_refurb_fee);
  }

  return 0;
};

// ============================================================================
// PLACEHOLDER FEES - Return 0 until implemented
// ============================================================================

const calculateOverboxFee = (_sale: SaleRecord): number => 0;
const calculatePackagingFee = (_sale: SaleRecord): number => 0;
const calculatePPSFee = (_sale: SaleRecord): number => 0;
const calculateShippingFee = (_sale: SaleRecord): number => 0;
const calculateMerchantFee = (_sale: SaleRecord): number => 0;
const calculateRevshareFee = (_sale: SaleRecord): number => 0;
const calculateMarketingFee = (_sale: SaleRecord): number => 0;
const calculateRefundFee = (_sale: SaleRecord): number => 0;

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

export const calculateFeesForSale = (sale: SaleRecord): CalculatedFees => {
  const thirdPartyMPFee = calculate3PMPFee(sale);
  const checkInFee = calculateCheckInFee(sale);

  // Pallet expected fee lives here for now (refurb bucket)
  const refurbFee = calculateRefurbFee(sale);

  const overboxFee = calculateOverboxFee(sale);
  const packagingFee = calculatePackagingFee(sale);
  const ppsFee = calculatePPSFee(sale);
  const shippingFee = calculateShippingFee(sale);
  const merchantFee = calculateMerchantFee(sale);
  const revshareFee = calculateRevshareFee(sale);
  const marketingFee = calculateMarketingFee(sale);
  const refundFee = calculateRefundFee(sale);

  const totalFees =
    checkInFee +
    refurbFee +
    overboxFee +
    packagingFee +
    ppsFee +
    shippingFee +
    merchantFee +
    revshareFee +
    thirdPartyMPFee +
    marketingFee +
    refundFee;

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
    totalFees,
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

// ✅ This export fixes your runtime error:
// "does not provide an export named 'calculateTotalFees'"
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
    refundFees: 0,
  };

  let totalFees = 0;
  let netDollars = 0;

  let wmusCount = 0;
  let nonWmusCount = 0;

  for (const sale of sales) {
    const fees = calculateFeesForSale(sale);

    const clientSource = toUpper(sale.tag_clientsource);
    if (clientSource === "WMUS") wmusCount++;
    else nonWmusCount++;

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

  console.log("Fee calculation summary:", {
    totalSales: sales.length,
    wmusCount,
    nonWmusCount,
    totalFees,
    netDollars,
    breakdown,
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
      marketingFees: result.breakdown.marketingFees,
    },
  };
};
