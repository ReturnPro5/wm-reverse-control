/**
 * Walmart Channel Dimension - Derived at Sales tab data-model level only
 * 
 * Logic (evaluated top-down):
 * 1. If "Marketplace Profile Sold On" contains "Walmart In Store" OR "Walmart Marketplace" OR "Walmart DSV" → "B2C Restock"
 * 2. Else if "Order Type Sold On" = "B2CMarketplace" → "B2C Resale"
 * 3. Else if "SortingIndex" is null/blank AND "Tag_PricingCondition" is one of ("New", "Used", "Refurbished") → "B2B Finished Goods"
 * 4. Else → "B2B Pallet"
 */

export type WalmartChannel = 'B2C Restock' | 'B2C Resale' | 'B2B Finished Goods' | 'B2B Pallet';

export const WALMART_CHANNEL_OPTIONS: WalmartChannel[] = [
  'B2C Restock',
  'B2C Resale',
  'B2B Finished Goods',
  'B2B Pallet',
];

interface SalesRecord {
  marketplace_profile_sold_on?: string | null;
  order_type_sold_on?: string | null;
  sorting_index?: string | null;
  tag_pricing_condition?: string | null;
}

const B2C_RESTOCK_MARKETPLACES = [
  'walmart in store',
  'walmart marketplace',
  'walmart dsv',
];

/**
 * Derive the Walmart Channel for a single sales record
 */
export function deriveWalmartChannel(record: SalesRecord): WalmartChannel {
  const marketplace = record.marketplace_profile_sold_on?.toLowerCase() || '';
  const orderType = record.order_type_sold_on || '';
  const sortingIndex = record.sorting_index?.trim() || '';

  // Rule 1: B2C Restock - Marketplace contains specific Walmart channels
  if (B2C_RESTOCK_MARKETPLACES.some(m => marketplace.includes(m))) {
    return 'B2C Restock';
  }

  // Rule 2: B2C Resale - Order type is B2CMarketplace
  if (orderType === 'B2CMarketplace') {
    return 'B2C Resale';
  }

  // Rule 3: B2B Finished Goods - SortingIndex is null/blank (non-pallet B2B)
  if (!sortingIndex) {
    return 'B2B Finished Goods';
  }

  // Rule 4: B2B Pallet - Has a sorting index (pallet sales)
  return 'B2B Pallet';
}

/**
 * Add walmartChannel to each record in an array (client-side derivation)
 */
export function addWalmartChannel<T extends SalesRecord>(records: T[]): (T & { walmartChannel: WalmartChannel })[] {
  return records.map(record => ({
    ...record,
    walmartChannel: deriveWalmartChannel(record),
  }));
}

/**
 * Filter records by selected Walmart Channels
 */
export function filterByWalmartChannel<T extends SalesRecord>(
  records: T[],
  selectedChannels: WalmartChannel[]
): T[] {
  if (selectedChannels.length === 0) return records;
  return records.filter(record => selectedChannels.includes(deriveWalmartChannel(record)));
}
