// Fee Calculator - NO recomputation, passthrough only
// 3P Marketplace Fee remains unchanged
// All other fees follow: Invoiced → Calculated → 0

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

  // Invoiced fees
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

  // Calculated fees (from file)
  calculated_check_in_fee?: number | null;
  calculated_refurb_fee?: number | null;
  calculated_overbox_fee?: number | null;
  calculated_packaging_fee?: number | null;
  calculated_pps_fee?: number | null;
  calculated_shipping_fee?: number | null;
  calculated_merchant_fee?: number | null;
  calculated_revshare_fee?: number | null;
  calculated_marketing_fee?: number | null;
  calculated_refund_fee?: number | null;

  calculated_3pmp_fee?: number | null;
  b2c_auction?: string | null;
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

// ============================================================================
// HELPERS
// ============================================================================

const passthroughFee = (
  invoiced?: number | null,
  calculated?: number | null
): number => {
  if (invoiced != null && invoiced !== 0) return Math.abs(invoiced);
  if (calculated != null && calculated !== 0) return calculated;
  return 0;
};

// ============================================================================
// 3P MARKETPLACE FEE (UNCHANGED)
// ============================================================================

const calculate3PMPFee = (sale: SaleRecord): number => {
  const clientSource = (sale.tag_clientsource || '').toUpperCase().trim();
  if (clientSource !== 'WMUS') return 0;

  if (sale.invoiced_3pmp_fee != null && sale.invoiced_3pmp_fee !== 0) {
    return Math.abs(sale.invoiced_3pmp_fee);
  }

  if (sale.calculated_3pmp_fee != null && sale.calculated_3pmp_fee !== 0) {
    return sale.calculated_3pmp_fee;
  }

  const price = sale.sale_price || 0;
  if (price <= 0) return 0;

  const marketplace = (sale.marketplace_profile_sold_on || '').toLowerCase();
  const b2c = (sale.b2c_auction || '').toLowerCase();

  if (!isB2C(marketplace, b2c)) return 0;
  if (marketplace.includes('whatnot')) return price * 0.17;
  if (marketplace.includes('wish')) return price * 0.20;
  if (marketplace.includes('ebay')) return price * 0.12;
  if (marketplace.includes('walmart') && marketplace.includes('marketplace')) return price * 0.12;
  if (marketplace.includes('shopify') || marketplace.includes('vipoutlet')) return price * 0.12;

  return 0;
};

const isB2C = (marketplace: string, b2cAuction: string): boolean => {
  if (b2cAuction === 'b2c' || b2cAuction === 'b2cmarketplace') return true;
  if (!marketplace) return false;

  const excluded = [
    'dl', 'directliquidation', 'gowholesale', 'b2b',
    'wholesale', 'pallet', 'truckload', 'dsv',
    'transfer', 'in store'
  ];

  if (excluded.some(x => marketplace.includes(x))) return false;

  return [
    'ebay', 'amazon', 'whatnot', 'wish',
    'shopify', 'vipoutlet', 'walmart marketplace'
  ].some(x => marketplace.includes(x));
};

// ============================================================================
// ALL OTHER FEES — PASSTHROUGH ONLY
// ============================================================================

export const calculateFeesForSale = (sale: SaleRecord): CalculatedFees => {
  const clientSource = (sale.tag_clientsource || '').toUpperCase().trim();
  const isWMUS = clientSource === 'WMUS';

  const checkInFee = isWMUS
    ? passthroughFee(sale.invoiced_check_in_fee, sale.calculated_check_in_fee)
    : 0;

  const refurbFee = passthroughFee(sale.invoiced_refurb_fee, sale.calculated_refurb_fee);
  const overboxFee = passthroughFee(sale.invoiced_overbox_fee, sale.calculated_overbox_fee);
  const packagingFee = passthroughFee(sale.invoiced_packaging_fee, sale.calculated_packaging_fee);
  const ppsFee = passthroughFee(sale.invoiced_pps_fee, sale.calculated_pps_fee);
  const shippingFee = passthroughFee(sale.invoiced_shipping_fee, sale.calculated_shipping_fee);
  const merchantFee = passthroughFee(sale.invoiced_merchant_fee, sale.calculated_merchant_fee);
  const revshareFee = passthroughFee(sale.invoiced_revshare_fee, sale.calculated_revshare_fee);
  const marketingFee = passthroughFee(sale.invoiced_marketing_fee, sale.calculated_marketing_fee);
  const refundFee = passthroughFee(sale.invoiced_refund_fee, sale.calculated_refund_fee);

  const thirdPartyMPFee = calculate3PMPFee(sale);

  const totalFees =
    checkInFee +
    refurbFee +
    overboxFee +
    packagingFee +
    ppsFee +
    shippingFee +
    merchantFee +
    revshareFee +
    marketingFee +
    refundFee +
    thirdPartyMPFee;

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
