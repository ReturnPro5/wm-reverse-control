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

// Parse Refurb Fee CSV: Category,Program(s),Key,BasePriceType,Price,...
const parseRefurbFee = (csv: string): RefurbFeeLookup => {
  const lines = csv.split('\n').slice(1);
  const lookup: RefurbFeeLookup = {};
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (fields.length >= 5) {
      const key = fields[2]; // Key column
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
};

// Build lookup key from category and program
const buildKey = (category: string | null, program: string | null): string => {
  const cat = category || '';
  const prog = program || '';
  return `${cat}${prog}`;
};

// Extract base program (e.g., "BENAR-WM" from "BENAR-WM-RECLAIMS-OVERSTOCK")
const getBaseProgram = (program: string | null): string => {
  if (!program) return '';
  // Try common patterns
  const match = program.match(/^([A-Z]+-WM)/i);
  return match ? match[1] : program;
};

// Calculate 3P Marketplace Fee based on DAX logic (excluding SAMS)
const calculate3PMarketplaceFee = (
  salePrice: number,
  marketplace: string | null,
  category: string | null
): number => {
  if (!marketplace || salePrice <= 0) return 0;
  
  const mp = marketplace.toLowerCase();
  const cat = (category || '').toLowerCase();
  
  // DSV or in-store = 0
  if (mp.includes('dsv') || mp.includes('in store')) return 0;
  
  // WhatNot = 17%
  if (mp.includes('whatnot')) return salePrice * 0.17;
  
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
  
  // Default B2C = 12%
  return salePrice * 0.12;
};

// Calculate Revshare Fee (excluding SAMS)
const calculateRevshareFee = (
  salePrice: number,
  program: string | null,
  marketplace: string | null
): number => {
  if (salePrice <= 0) return 0;
  
  const mp = (marketplace || '').toLowerCase();
  const prog = (program || '').toLowerCase();
  
  // DSV = 0
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
  // WhatNot = 5%
  if (mp.includes('whatnot')) return salePrice * 0.05;
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

export const calculateFeesForSale = (sale: SaleRecord): CalculatedFees => {
  initializeLookups();
  
  const salePrice = Number(sale.sale_price) || 0;
  const effectiveRetail = Number(sale.effective_retail) || 0;
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
  
  // Build lookup keys
  const baseProgram = getBaseProgram(program);
  const fullKey = buildKey(category, program);
  const baseKey = buildKey(category, baseProgram);
  
  // 1. Check-In Fee
  let checkInFee = checkInLookup[fullKey] || checkInLookup[baseKey] || 0;
  // Default if no lookup found and program contains "boxes"
  if (checkInFee === 0 && program?.toLowerCase().includes('boxes')) {
    checkInFee = 1.3;
  }
  
  // 2. PPS Fee (0 if DS facility)
  let ppsFee = 0;
  if (!facility?.toUpperCase().includes('DS')) {
    ppsFee = ppsLookup[fullKey] || ppsLookup[baseKey] || 0;
  }
  
  // 3. Refurb Fee
  let refurbFee = 0;
  // Check fixed fee lookup first
  const refurbFixed = refurbFeeLookup[fullKey] || refurbFeeLookup[baseKey];
  if (refurbFixed) {
    refurbFee = refurbFixed.type === 'percent' 
      ? (effectiveRetail * refurbFixed.value / 100)
      : refurbFixed.value;
  } else {
    // Fall back to % of retail lookup
    const refurbPct = refurbPctLookup[fullKey] || refurbPctLookup[baseKey];
    if (refurbPct && effectiveRetail > 0) {
      refurbFee = effectiveRetail * refurbPct;
    }
  }
  
  // Skip refurb for DS facility
  if (facility?.toUpperCase().includes('DS')) {
    refurbFee = 0;
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
  
  for (const sale of sales) {
    const fees = calculateFeesForSale(sale);
    breakdown.checkInFees += fees.checkInFee;
    breakdown.ppsFees += fees.ppsFee;
    breakdown.refurbFees += fees.refurbFee;
    breakdown.marketplaceFees += fees.marketplaceFee;
    breakdown.revshareFees += fees.revshareFee;
    breakdown.marketingFees += fees.marketingFee;
    totalFees += fees.totalFees;
  }
  
  return { totalFees, breakdown };
};
