// Fee lookup tables parsed from CSV data
// These are imported statically to avoid async loading issues

import checkinData from '@/data/checkin.csv?raw';
import ppsData from '@/data/pps.csv?raw';
import refurbFeeData from '@/data/refurb_fee.csv?raw';
import refurbPctData from '@/data/of_retail_ref.csv?raw';

// Types
interface CheckInLookup {
  [key: string]: number;
}

interface PPSLookup {
  [key: string]: number;
}

interface RefurbFeeLookup {
  [key: string]: { type: 'dollar' | 'percent'; value: number };
}

interface RefurbPctLookup {
  [key: string]: number; // percentage as decimal
}

// Parse helper to handle CSV price values
const parsePrice = (value: string): number => {
  const cleaned = value.replace(/[$,%]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

// Parse CSV line respecting quoted fields
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// Parse Check-In CSV: Category,Program,BasePriceType,Key,Price
const parseCheckIn = (csv: string): CheckInLookup => {
  const lines = csv.split('\n').slice(1);
  const lookup: CheckInLookup = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (fields.length >= 5) {
      const key = fields[3];
      const price = parsePrice(fields[4]);
      if (key && price > 0) {
        lookup[key] = price;
      }
    }
  }
  return lookup;
};

// Parse PPS CSV: Category,Program(s),key,BasePriceType,Price
const parsePPS = (csv: string): PPSLookup => {
  const lines = csv.split('\n').slice(1);
  const lookup: PPSLookup = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (fields.length >= 5) {
      const key = fields[2];
      const price = parsePrice(fields[4]);
      if (key && price > 0) {
        lookup[key] = price;
      }
    }
  }
  return lookup;
};

// Parse Refurb Fee CSV: Category,Program(s),Key,BasePriceType,Price,Pricing Condition,...
const parseRefurbFee = (csv: string): RefurbFeeLookup => {
  const lines = csv.split('\n').slice(1);
  const lookup: RefurbFeeLookup = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (fields.length >= 5) {
      const key = fields[2];
      const priceType = fields[3]?.toLowerCase();
      const priceValue = parsePrice(fields[4]);
      
      if (key && priceValue > 0) {
        lookup[key] = {
          type: priceType === 'percent' ? 'percent' : 'dollar',
          value: priceValue
        };
      }
    }
  }
  return lookup;
};

// Parse % of Retail Refurb CSV: Category,Key,Program(s),Price
const parseRefurbPct = (csv: string): RefurbPctLookup => {
  const lines = csv.split('\n').slice(1);
  const lookup: RefurbPctLookup = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (fields.length >= 4) {
      const key = fields[1];
      const pct = parsePrice(fields[3]);
      if (key && pct > 0) {
        lookup[key] = pct / 100;
      }
    }
  }
  return lookup;
};

// Initialize lookups
let checkInLookup: CheckInLookup = {};
let ppsLookup: PPSLookup = {};
let refurbFeeLookup: RefurbFeeLookup = {};
let refurbPctLookup: RefurbPctLookup = {};
let initialized = false;

const initializeLookups = () => {
  if (initialized) return;
  
  checkInLookup = parseCheckIn(checkinData);
  ppsLookup = parsePPS(ppsData);
  refurbFeeLookup = parseRefurbFee(refurbFeeData);
  refurbPctLookup = parseRefurbPct(refurbPctData);
  initialized = true;
  
  console.log('Fee lookups initialized:', {
    checkIn: Object.keys(checkInLookup).length,
    pps: Object.keys(ppsLookup).length,
    refurbFee: Object.keys(refurbFeeLookup).length,
    refurbPct: Object.keys(refurbPctLookup).length
  });
};

// Build lookup key from category and program
const buildKey = (category: string | null, program: string | null): string => {
  const cat = category || '';
  const prog = program || '';
  return `${cat}${prog}`;
};

// Build lookup key with condition (for refurb)
const buildRefurbKey = (category: string | null, program: string | null, condition: string | null): string => {
  const cat = category || '';
  const prog = program || '';
  const cond = condition?.toUpperCase() || '';
  return `${cat}${prog}${cond}`;
};

// Program variant generators for PPS lookup
const getProgramVariantsForPPS = (program: string | null): string[] => {
  if (!program) return [''];
  const variants: string[] = [program];
  const upperProgram = program.toUpperCase();
  
  // Don't generate variants for Mexico facilities
  if (!upperProgram.includes('TIJUANA') && !upperProgram.includes('MONTERREY')) {
    const wmMatch = program.match(/^([A-Z]+-WM)/i);
    if (wmMatch && wmMatch[1] !== program) {
      variants.push(wmMatch[1]);
    }
  }
  return [...new Set(variants)];
};

// Program variant generators for Refurb lookup
const getProgramVariantsForRefurb = (program: string | null): string[] => {
  if (!program) return [''];
  const variants: string[] = [program];
  const upperProgram = program.toUpperCase();
  const wmMatch = program.match(/^([A-Z]+-WM)/i);
  if (wmMatch && wmMatch[1] !== program) {
    variants.push(wmMatch[1]);
  }
  if (upperProgram.includes('TIJUANA') || upperProgram.includes('MONTERREY')) {
    const facilityMatch = program.match(/^([A-Z]+)/i);
    if (facilityMatch) {
      variants.push(`${facilityMatch[1]}-WM`);
    }
  }
  return [...new Set(variants)];
};

// Program variant generators for Check-In lookup
const getProgramVariantsForCheckIn = (program: string | null): string[] => {
  if (!program) return [''];
  const upperProgram = program.toUpperCase();
  if (upperProgram.includes('RECLAIMS-OVERSTOCK')) {
    return [program];
  }
  return [];
};

// Condition variants for refurb lookups
const getConditionVariants = (): string[] => {
  return ['REFURBISHED', 'USED', 'NEW', 'BER', 'AS-IS'];
};

// ============================================================================
// EXCLUSION LOGIC
// ============================================================================

// Check if sale is B2C (eligible for marketplace/revshare fees)
const isB2CSale = (marketplace: string | null): boolean => {
  if (!marketplace || marketplace.trim() === '') return false;
  const mp = marketplace.toLowerCase();
  
  // Exclusions - these are NOT B2C
  if (mp.includes('directliquidation') || mp === 'dl') return false;
  if (mp.includes('gowholesale')) return false;
  if (mp.includes('manual')) return false;
  if (mp.includes('dsv')) return false;
  if (mp.includes('transfer')) return false;
  if (mp.includes('in store')) return false;
  if (mp.includes('b2b')) return false;
  if (mp.includes('wholesale')) return false;
  if (mp.includes('pallet')) return false;
  if (mp.includes('truckload')) return false;
  
  return true;
};

// Check if program is dropship (no PPS, refurb fees)
const isDropshipProgram = (program: string | null, facility: string | null): boolean => {
  if (facility?.toUpperCase().includes('DS')) return true;
  if (facility?.toUpperCase() === 'MEXICO') return true;
  if (program?.toUpperCase().startsWith('DS-')) return true;
  if (program?.toUpperCase().includes('MONTERREY')) return true;
  if (program?.toUpperCase().includes('DSV')) return true;
  return false;
};

// Check if sale should be excluded from fee calculations entirely
const isExcludedFromFees = (
  marketplace: string | null,
  program: string | null,
  sortingIndex: string | null
): boolean => {
  const mp = (marketplace || '').toLowerCase();
  const prog = (program || '').toUpperCase();
  const sorting = (sortingIndex || '').toUpperCase();
  
  // DSV sales excluded from most fees
  if (mp.includes('dsv') || prog.includes('DSV')) return true;
  
  // Manual/transfer sales
  if (mp.includes('manual') || mp.includes('transfer')) return true;
  
  return false;
};

// Check if SAMS client (different fee rules)
const isSAMSClient = (clientSource: string | null): boolean => {
  return clientSource?.toUpperCase() === 'SAMS';
};

// Check if vendor pallet (special net dollars calculation)
const isVendorPallet = (sortingIndex: string | null): boolean => {
  return sortingIndex?.toUpperCase() === 'VENDOR PALLET';
};

// ============================================================================
// FEE CALCULATION FUNCTIONS - Following hierarchy: Invoiced > Calculated
// ============================================================================

// Calculate Check-In Fee
const calculateCheckInFee = (
  invoicedValue: number | null | undefined,
  category: string | null,
  program: string | null,
  isSAMS: boolean
): number => {
  // SAMS has no check-in fee
  if (isSAMS) return 0;
  
  // 1. Use invoiced value if present (absolute value)
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  // 2. Use lookup-based calculation
  const variants = getProgramVariantsForCheckIn(program);
  for (const prog of variants) {
    const key = buildKey(category, prog);
    if (checkInLookup[key] !== undefined) {
      return checkInLookup[key];
    }
  }
  
  return 0;
};

// Calculate Refurb Fee with full hierarchy
const calculateRefurbFee = (
  invoicedValue: number | null | undefined,
  expectedHVRefurb: number | null | undefined,
  category: string | null,
  program: string | null,
  effectiveRetail: number,
  isDropship: boolean,
  isSAMS: boolean,
  isVendorPalletItem: boolean
): number => {
  // Dropship = no refurb fee
  if (isDropship) return 0;
  
  // SAMS = no refurb fee (unless explicitly invoiced)
  if (isSAMS) {
    if (invoicedValue != null && invoicedValue !== 0) {
      return Math.abs(invoicedValue);
    }
    return 0;
  }
  
  // 1. Use invoiced value if present
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  // 2. For vendor pallets, use expected HV AS-IS refurb fee
  if (isVendorPalletItem && expectedHVRefurb != null && expectedHVRefurb !== 0) {
    return Math.abs(expectedHVRefurb);
  }
  
  // 3. Use lookup-based calculation
  const variants = getProgramVariantsForRefurb(program);
  const conditions = getConditionVariants();
  
  // Try fixed fee lookup first
  for (const prog of variants) {
    for (const cond of conditions) {
      const key = buildRefurbKey(category, prog, cond);
      if (refurbFeeLookup[key] !== undefined) {
        const entry = refurbFeeLookup[key];
        return entry.type === 'percent' 
          ? (effectiveRetail * entry.value / 100)
          : entry.value;
      }
    }
  }
  
  // Fall back to % of retail lookup
  for (const prog of variants) {
    for (const cond of conditions) {
      const key = buildRefurbKey(category, prog, cond);
      if (refurbPctLookup[key] !== undefined && effectiveRetail > 0) {
        return effectiveRetail * refurbPctLookup[key];
      }
    }
  }
  
  return 0;
};

// Calculate Overbox Fee - invoiced or calculated fallback
const calculateOverboxFee = (
  invoicedValue: number | null | undefined,
  isB2C: boolean
): number => {
  // 1. Use invoiced value if present
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  // 2. No calculated fallback for overbox - it's invoiced only
  return 0;
};

// Calculate Packaging Fee
const calculatePackagingFee = (
  invoicedValue: number | null | undefined
): number => {
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  return 0;
};

// Calculate PPS (Pick-Pack-Ship) Fee
const calculatePPSFee = (
  invoicedValue: number | null | undefined,
  category: string | null,
  program: string | null,
  isDropship: boolean,
  isSAMS: boolean,
  isExcluded: boolean
): number => {
  // Exclusions
  if (isDropship) return 0;
  if (isSAMS) return 0;
  if (isExcluded) return 0;
  
  // 1. Use invoiced value if present
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  // 2. Use lookup-based calculation
  const variants = getProgramVariantsForPPS(program);
  for (const prog of variants) {
    const key = buildKey(category, prog);
    if (ppsLookup[key] !== undefined) {
      return ppsLookup[key];
    }
  }
  
  return 0;
};

// Calculate Shipping Fee - invoiced or calculated
const calculateShippingFee = (
  invoicedValue: number | null | undefined,
  isB2C: boolean,
  salePrice: number
): number => {
  // 1. Use invoiced value if present
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  // 2. No calculated fallback - shipping is invoiced only
  return 0;
};

// Calculate Revshare Fee - per DAX hierarchy
const calculateRevshareFee = (
  invoicedValue: number | null | undefined,
  salePrice: number,
  program: string | null,
  isB2C: boolean,
  isSAMS: boolean,
  isExcluded: boolean
): number => {
  // 1. Use invoiced value if present
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  // Exclusions
  if (!isB2C) return 0;
  if (isSAMS) return 0;
  if (isExcluded) return 0;
  if (salePrice <= 0) return 0;
  
  const prog = (program || '').toLowerCase();
  
  // Reclaims, FC, Searcy = 4.5%
  if (prog.includes('reclaim') || prog.includes('fc') || prog.includes('searcy')) {
    return salePrice * 0.045;
  }
  
  // Default B2C = 5%
  return salePrice * 0.05;
};

// Calculate 3PMP Fee (third-party marketplace percentage) - per DAX hierarchy
const calculate3PMPFee = (
  invoicedValue: number | null | undefined,
  salePrice: number,
  marketplace: string | null,
  category: string | null,
  isB2C: boolean,
  isSAMS: boolean,
  isExcluded: boolean
): number => {
  // 1. Use invoiced value if present
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  // Exclusions
  if (!isB2C) return 0;
  if (isSAMS) return 0;
  if (isExcluded) return 0;
  if (salePrice <= 0) return 0;
  
  const mp = (marketplace || '').toLowerCase();
  const cat = (category || '').toLowerCase();
  
  // Platform-specific rates
  if (mp.includes('whatnot') || mp.includes('flashfindz')) return salePrice * 0.17;
  if (mp.includes('wish')) return salePrice * 0.20;
  if (mp.includes('ebay')) {
    return cat.includes('electronics') ? salePrice * 0.08 : salePrice * 0.12;
  }
  if (mp.includes('walmart') && mp.includes('marketplace')) {
    return cat.includes('electronics') ? salePrice * 0.08 : salePrice * 0.12;
  }
  if (mp.includes('shopify') || mp.includes('vipoutlet')) {
    return salePrice * 0.12;
  }
  if (mp.includes('amazon')) {
    return cat.includes('electronics') ? salePrice * 0.08 : salePrice * 0.15;
  }
  
  // Default B2C = 12%
  return salePrice * 0.12;
};

// Calculate Merchant Fee - INVOICED ONLY, NO FALLBACK
const calculateMerchantFee = (
  invoicedValue: number | null | undefined
): number => {
  // Merchant fee is ONLY from invoiced values - no percentage fallback
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  return 0;
};

// Calculate Marketing Fee - per DAX hierarchy
const calculateMarketingFee = (
  invoicedValue: number | null | undefined,
  salePrice: number,
  marketplace: string | null,
  isB2C: boolean,
  isExcluded: boolean
): number => {
  // 1. Use invoiced value if present
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  if (!isB2C || isExcluded) return 0;
  
  // 2. Calculate based on rules
  const mp = (marketplace || '').toLowerCase();
  if (mp.includes('whatnot') || mp.includes('flashfindz')) return salePrice * 0.05;
  return 0;
};

// Calculate Refund Fee (contra-revenue)
const calculateRefundFee = (
  invoicedValue: number | null | undefined,
  refundAmount: number | null | undefined
): number => {
  // 1. Use invoiced value if present
  if (invoicedValue != null && invoicedValue !== 0) {
    return Math.abs(invoicedValue);
  }
  
  // 2. Use refund_amount from sales data
  if (refundAmount != null && refundAmount !== 0) {
    return Math.abs(refundAmount);
  }
  
  return 0;
};

// ============================================================================
// MAIN INTERFACES AND CALCULATION FUNCTIONS
// ============================================================================

// Extended sale record with optional invoiced fee columns
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
  // Invoiced fee columns (for hierarchy precedence)
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
  // Vendor pallet/invoice fields
  sorting_index?: string | null;
  vendor_invoice_total?: number | null;
  service_invoice_total?: number | null;
  expected_hv_as_is_refurb_fee?: number | null;
}

// All 11 fee components
export interface CalculatedFees {
  checkInFee: number;
  refurbFee: number;
  overboxFee: number;
  packagingFee: number;
  ppsFee: number;
  shippingFee: number;
  merchantFee: number;
  revshareFee: number;
  thirdPartyMPFee: number;  // 3PMP
  marketingFee: number;
  refundFee: number;
  totalFees: number;
}

// Calculate all fees for a single sale record
export const calculateFeesForSale = (sale: SaleRecord): CalculatedFees => {
  initializeLookups();
  
  const salePrice = Number(sale.sale_price) || 0;
  const effectiveRetail = Number(sale.effective_retail) || Number(sale.mr_lmr_upc_average_category_retail) || 0;
  const category = sale.category_name;
  const program = sale.program_name;
  const marketplace = sale.marketplace_profile_sold_on;
  const facility = sale.facility;
  
  // Determine exclusion flags
  const isSAMS = isSAMSClient(sale.tag_clientsource);
  const isDropship = isDropshipProgram(program, facility);
  const isB2C = isB2CSale(marketplace);
  const isExcluded = isExcludedFromFees(marketplace, program, sale.sorting_index);
  const isVendorPalletItem = isVendorPallet(sale.sorting_index);
  
  // Calculate all 11 fee components using hierarchy
  const checkInFee = calculateCheckInFee(sale.invoiced_check_in_fee, category, program, isSAMS);
  
  const refurbFee = calculateRefurbFee(
    sale.invoiced_refurb_fee,
    sale.expected_hv_as_is_refurb_fee,
    category,
    program,
    effectiveRetail,
    isDropship,
    isSAMS,
    isVendorPalletItem
  );
  
  const overboxFee = calculateOverboxFee(sale.invoiced_overbox_fee, isB2C);
  const packagingFee = calculatePackagingFee(sale.invoiced_packaging_fee);
  
  const ppsFee = calculatePPSFee(
    sale.invoiced_pps_fee,
    category,
    program,
    isDropship,
    isSAMS,
    isExcluded
  );
  
  const shippingFee = calculateShippingFee(sale.invoiced_shipping_fee, isB2C, salePrice);
  
  // Merchant fee is INVOICED ONLY - no calculated fallback
  const merchantFee = calculateMerchantFee(sale.invoiced_merchant_fee);
  
  const revshareFee = calculateRevshareFee(
    sale.invoiced_revshare_fee,
    salePrice,
    program,
    isB2C,
    isSAMS,
    isExcluded
  );
  
  const thirdPartyMPFee = calculate3PMPFee(
    sale.invoiced_3pmp_fee,
    salePrice,
    marketplace,
    category,
    isB2C,
    isSAMS,
    isExcluded
  );
  
  const marketingFee = calculateMarketingFee(
    sale.invoiced_marketing_fee,
    salePrice,
    marketplace,
    isB2C,
    isExcluded
  );
  
  const refundFee = calculateRefundFee(sale.invoiced_refund_fee, sale.refund_amount);
  
  // Total fees = sum of all components
  // Note: merchantFee is only included if invoiced (not calculated), so no double-counting with 3PMP
  const totalFees = checkInFee + refurbFee + overboxFee + packagingFee + ppsFee + 
                    shippingFee + merchantFee + revshareFee + thirdPartyMPFee + marketingFee + refundFee;
  
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

// Calculate Net Dollars for a single sale following the hierarchy:
// A. Vendor Pallets: Sale Price - Fees + Refurb Fee - Expected HV AS IS Refurb Fee
// B. Vendor-Invoiced: VendorInvoiceTotal + ServiceInvoiceTotal
// C. Standard: Sale Price (discount applied) - Fees
export const calculateNetDollarsForSale = (sale: SaleRecord, fees: CalculatedFees): number => {
  const salePrice = Number(sale.sale_price) || 0;
  
  // A. Vendor Pallets - special calculation
  if (isVendorPallet(sale.sorting_index)) {
    const expectedHVRefurb = Number(sale.expected_hv_as_is_refurb_fee) || 0;
    // Net = Sale - TotalFees + RefurbFee - ExpectedHVRefurb
    return salePrice - fees.totalFees + fees.refurbFee - expectedHVRefurb;
  }
  
  // B. Vendor-Invoiced Items
  if (sale.vendor_invoice_total != null && sale.vendor_invoice_total !== 0) {
    const vendorTotal = Number(sale.vendor_invoice_total) || 0;
    const serviceTotal = Number(sale.service_invoice_total) || 0;
    return vendorTotal + serviceTotal;
  }
  
  // C. Standard Case: Sale Price - Fees
  return salePrice - fees.totalFees;
};

// Fee breakdown structure for aggregation
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

// Calculate total fees for an array of sales with full breakdown
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
  let missedLookups = { checkIn: 0, pps: 0, refurb: 0 };
  
  for (const sale of sales) {
    const fees = calculateFeesForSale(sale);
    
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
    
    // Calculate net dollars per line item
    netDollars += calculateNetDollarsForSale(sale, fees);
    
    // Track misses for debugging
    const isDropship = isDropshipProgram(sale.program_name, sale.facility);
    const isSAMS = isSAMSClient(sale.tag_clientsource);
    if (fees.checkInFee === 0 && sale.sale_price > 0 && !isSAMS) missedLookups.checkIn++;
    if (fees.ppsFee === 0 && sale.sale_price > 0 && !isDropship && !isSAMS) missedLookups.pps++;
    if (fees.refurbFee === 0 && sale.sale_price > 0 && !isDropship && !isSAMS) missedLookups.refurb++;
  }
  
  console.log('Fee calculation summary:', {
    totalSales: sales.length,
    totalFees,
    netDollars,
    breakdown,
    missedLookups
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

// Legacy function for components that haven't been updated yet
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
