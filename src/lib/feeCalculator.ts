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
  const lines = csv.split('\n').slice(1); // Skip header
  const lookup: CheckInLookup = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (fields.length >= 5) {
      const key = fields[3]; // Key column
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
      const key = fields[2]; // key column
      const price = parsePrice(fields[4]);
      if (key && price > 0) {
        lookup[key] = price;
      }
    }
  }
  return lookup;
};

// Parse Refurb Fee CSV: Category,Program(s),Key,BasePriceType,Price,Pricing Condition,...
// Key format: {Category}{Program}{PricingCondition}
const parseRefurbFee = (csv: string): RefurbFeeLookup => {
  const lines = csv.split('\n').slice(1);
  const lookup: RefurbFeeLookup = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (fields.length >= 5) {
      const key = fields[2]; // Key column (includes condition)
      const priceType = fields[3]?.toLowerCase(); // BasePriceType
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
// Key format: {Category}{Program}{PricingCondition}
const parseRefurbPct = (csv: string): RefurbPctLookup => {
  const lines = csv.split('\n').slice(1);
  const lookup: RefurbPctLookup = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (fields.length >= 4) {
      const key = fields[1]; // Key column
      const pct = parsePrice(fields[3]); // Price is actually %
      if (key && pct > 0) {
        lookup[key] = pct / 100; // Convert to decimal
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

// Build lookup key from category and program (for checkin and pps)
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

// Extract base program patterns for lookup matching
const getProgramVariants = (program: string | null): string[] => {
  if (!program) return [''];
  const variants: string[] = [program];
  
  // Extract facility code and try with -WM suffix
  const facilityMatch = program.match(/^([A-Z]+)/i);
  if (facilityMatch) {
    const facility = facilityMatch[1];
    variants.push(`${facility}-WM`);
    variants.push(`${facility}-WM-RECLAIMS-OVERSTOCK`);
    variants.push(`${facility}-WM-OVERSTOCK`);
  }
  
  // Try extracting base -WM pattern
  const wmMatch = program.match(/^([A-Z]+-WM)/i);
  if (wmMatch) {
    variants.push(wmMatch[1]);
  }
  
  return [...new Set(variants)]; // Remove duplicates
};

// Get all condition variants to try
const getConditionVariants = (): string[] => {
  return ['REFURBISHED', 'USED', 'NEW', 'BER', 'AS-IS'];
};

// Determine if a marketplace is B2C (vs B2B/wholesale)
const isB2CMarketplace = (marketplace: string | null): boolean => {
  if (!marketplace || marketplace.trim() === '') return false;
  
  const mp = marketplace.toLowerCase();
  
  // B2B/Wholesale channels - NO marketplace fee
  if (mp.includes('dl') || mp.includes('directliquidation')) return false;
  if (mp.includes('gowholesale') || mp.includes('wholesale')) return false;
  if (mp.includes('manual') && !mp.includes('whatnot')) return false;
  if (mp.includes('dsv')) return false;
  if (mp.includes('in store')) return false;
  
  // B2C channels
  if (mp.includes('ebay')) return true;
  if (mp.includes('walmart') && mp.includes('marketplace')) return true;
  if (mp.includes('whatnot') || mp.includes('flashfindz')) return true;
  if (mp.includes('shopify') || mp.includes('vipoutlet')) return true;
  if (mp.includes('wish')) return true;
  if (mp.includes('amazon')) return true;
  
  // Default: assume NOT B2C for safety (avoid over-charging fees)
  return false;
};

// Calculate 3P Marketplace Fee based on DAX logic (excluding SAMS)
const calculate3PMarketplaceFee = (
  salePrice: number,
  marketplace: string | null,
  category: string | null
): number => {
  if (salePrice <= 0) return 0;
  
  // Only apply to B2C marketplaces
  if (!isB2CMarketplace(marketplace)) return 0;
  
  const mp = (marketplace || '').toLowerCase();
  const cat = (category || '').toLowerCase();
  
  // DSV or in-store = 0 (already handled by isB2CMarketplace but explicit)
  if (mp.includes('dsv') || mp.includes('in store')) return 0;
  
  // WhatNot = 17%
  if (mp.includes('whatnot') || mp.includes('flashfindz')) return salePrice * 0.17;
  
  // Wish = 20%
  if (mp.includes('wish')) return salePrice * 0.20;
  
  // eBay - 8% for electronics, 12% otherwise
  if (mp.includes('ebay')) {
    return cat.includes('electronics') ? salePrice * 0.08 : salePrice * 0.12;
  }
  
  // Walmart Marketplace - 8% for electronics, 12% otherwise
  if (mp.includes('walmart') && mp.includes('marketplace')) {
    return cat.includes('electronics') ? salePrice * 0.08 : salePrice * 0.12;
  }
  
  // Shopify/VIPOutlet - 12%
  if (mp.includes('shopify') || mp.includes('vipoutlet')) {
    return salePrice * 0.12;
  }
  
  // Default B2C = 12%
  return salePrice * 0.12;
};

// Calculate Revshare Fee (excluding SAMS)
// Note: Revshare applies to all sales EXCEPT DSV
const calculateRevshareFee = (
  salePrice: number,
  program: string | null,
  marketplace: string | null
): number => {
  if (salePrice <= 0) return 0;
  
  const mp = (marketplace || '').toLowerCase();
  const prog = (program || '').toLowerCase();
  
  // DSV = 0 (explicitly excluded in DAX)
  if (mp.includes('dsv')) return 0;
  
  // Reclaims, FC, Searcy = 4.5%
  if (prog.includes('reclaim') || prog.includes('fc') || prog.includes('searcy')) {
    return salePrice * 0.045;
  }
  
  // Default = 5%
  return salePrice * 0.05;
};

// Calculate Marketing Fee
const calculateMarketingFee = (
  salePrice: number,
  marketplace: string | null
): number => {
  const mp = (marketplace || '').toLowerCase();
  // WhatNot/FlashFindz = 5%
  if (mp.includes('whatnot') || mp.includes('flashfindz')) return salePrice * 0.05;
  return 0;
};

// Main fee calculation interface
export interface SaleRecord {
  sale_price: number;
  category_name: string | null;
  program_name: string | null;
  marketplace_profile_sold_on: string | null;
  facility: string | null;
  effective_retail?: number | null;
  mr_lmr_upc_average_category_retail?: number | null;
  tag_clientsource?: string | null;
}

export interface CalculatedFees {
  checkInFee: number;
  ppsFee: number;
  refurbFee: number;
  marketplaceFee: number;
  revshareFee: number;
  marketingFee: number;
  totalFees: number;
}

// Debug: track lookup misses
let debugSampleCount = 0;

export const calculateFeesForSale = (sale: SaleRecord): CalculatedFees => {
  initializeLookups();
  
  const salePrice = Number(sale.sale_price) || 0;
  const effectiveRetail = Number(sale.effective_retail) || Number(sale.mr_lmr_upc_average_category_retail) || 0;
  const category = sale.category_name;
  const program = sale.program_name;
  const marketplace = sale.marketplace_profile_sold_on;
  const facility = sale.facility;
  
  // Skip SAMS entirely
  if (sale.tag_clientsource?.toUpperCase() === 'SAMS') {
    return {
      checkInFee: 0,
      ppsFee: 0,
      refurbFee: 0,
      marketplaceFee: 0,
      revshareFee: 0,
      marketingFee: 0,
      totalFees: 0
    };
  }
  
  // Build lookup keys - try multiple program variants
  const programVariants = getProgramVariants(program);
  const conditionVariants = getConditionVariants();
  
  // Helper to find value in lookup with multiple key variants
  const findInLookup = <T>(lookup: Record<string, T>): T | undefined => {
    for (const prog of programVariants) {
      const key = buildKey(category, prog);
      if (lookup[key] !== undefined) return lookup[key];
    }
    return undefined;
  };
  
  // Helper to find refurb value (needs condition)
  const findRefurbInLookup = <T>(lookup: Record<string, T>): T | undefined => {
    for (const prog of programVariants) {
      for (const cond of conditionVariants) {
        const key = buildRefurbKey(category, prog, cond);
        if (lookup[key] !== undefined) return lookup[key];
      }
    }
    return undefined;
  };
  
  // 1. Check-In Fee
  let checkInFee = findInLookup(checkInLookup) || 0;
  // Default if no lookup found and program contains "boxes"
  if (checkInFee === 0 && program?.toLowerCase().includes('boxes')) {
    checkInFee = 1.3;
  }
  
  // 2. PPS Fee (0 if DS facility or dropship program)
  let ppsFee = 0;
  const isDropship = facility?.toUpperCase().includes('DS') || program?.toUpperCase().startsWith('DS-');
  if (!isDropship) {
    ppsFee = findInLookup(ppsLookup) || 0;
  }
  
  // 3. Refurb Fee
  let refurbFee = 0;
  if (!isDropship) {
    // Check fixed fee lookup first (with condition variants)
    const refurbFixed = findRefurbInLookup(refurbFeeLookup);
    if (refurbFixed) {
      refurbFee = refurbFixed.type === 'percent' 
        ? (effectiveRetail * refurbFixed.value / 100)
        : refurbFixed.value;
    } else {
      // Fall back to % of retail lookup (with condition variants)
      const refurbPct = findRefurbInLookup(refurbPctLookup);
      if (refurbPct && effectiveRetail > 0) {
        refurbFee = effectiveRetail * refurbPct;
      }
    }
  }
  
  // 4. 3P Marketplace Fee
  const marketplaceFee = calculate3PMarketplaceFee(salePrice, marketplace, category);
  
  // 5. Revshare Fee
  const revshareFee = calculateRevshareFee(salePrice, program, marketplace);
  
  // 6. Marketing Fee
  const marketingFee = calculateMarketingFee(salePrice, marketplace);
  
  const totalFees = checkInFee + ppsFee + refurbFee + marketplaceFee + revshareFee + marketingFee;
  
  return {
    checkInFee,
    ppsFee,
    refurbFee,
    marketplaceFee,
    revshareFee,
    marketingFee,
    totalFees
  };
};

// Calculate total fees for an array of sales
export const calculateTotalFees = (sales: SaleRecord[]): {
  totalFees: number;
  breakdown: {
    checkInFees: number;
    ppsFees: number;
    refurbFees: number;
    marketplaceFees: number;
    revshareFees: number;
    marketingFees: number;
  };
} => {
  const breakdown = {
    checkInFees: 0,
    ppsFees: 0,
    refurbFees: 0,
    marketplaceFees: 0,
    revshareFees: 0,
    marketingFees: 0
  };
  
  let totalFees = 0;
  let missedLookups = { checkIn: 0, pps: 0, refurb: 0 };
  
  for (const sale of sales) {
    const fees = calculateFeesForSale(sale);
    breakdown.checkInFees += fees.checkInFee;
    breakdown.ppsFees += fees.ppsFee;
    breakdown.refurbFees += fees.refurbFee;
    breakdown.marketplaceFees += fees.marketplaceFee;
    breakdown.revshareFees += fees.revshareFee;
    breakdown.marketingFees += fees.marketingFee;
    totalFees += fees.totalFees;
    
    // Track misses
    if (fees.checkInFee === 0 && sale.sale_price > 0) missedLookups.checkIn++;
    if (fees.ppsFee === 0 && sale.sale_price > 0 && !sale.facility?.includes('DS')) missedLookups.pps++;
    if (fees.refurbFee === 0 && sale.sale_price > 0 && !sale.facility?.includes('DS')) missedLookups.refurb++;
  }
  
  console.log('Fee calculation summary:', {
    totalSales: sales.length,
    totalFees,
    breakdown,
    missedLookups
  });
  
  return { totalFees, breakdown };
};
