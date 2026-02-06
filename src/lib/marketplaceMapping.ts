// Marketplace mapping logic from Power BI
// This centralizes the logic so it can be used across all sales tabs

export interface SaleRecord {
  marketplace_profile_sold_on: string | null;
  tag_ebay_auction_sale?: boolean | null;
  b2c_auction?: string | null;
}

export const mapMarketplace = (sale: SaleRecord): string => {
  const marketplaceSoldOn = sale.marketplace_profile_sold_on;
  
  // If blank/null → "Manual Sales"
  if (!marketplaceSoldOn || marketplaceSoldOn.trim() === '') return 'Manual Sales';
  
  const lower = marketplaceSoldOn.toLowerCase();
  
  // Contains "DL" → "DirectLiquidation"
  if (lower.includes('dl')) return 'DirectLiquidation';
  
  // Contains "whatnot" or "flashfindz" → "WhatNot"
  if (lower.includes('whatnot') || lower.includes('flashfindz')) return 'WhatNot';
  
  // Contains "shopify" → "VIPOutlet"
  if (lower.includes('shopify')) return 'VIPOutlet';
  
  // Contains "manual" → "Local Pickup"
  if (lower.includes('manual')) return 'Local Pickup';
  
  // Contains "daily deals" → "eBay"
  if (lower.includes('daily deals')) return 'eBay';
  
  // eBay Auction logic: Tag_eBayAuctionSale=TRUE or (B2CAuction="TRUE" && marketplace="eBay")
  if (
    sale.tag_ebay_auction_sale === true || 
    (sale.b2c_auction === 'TRUE' && marketplaceSoldOn === 'eBay')
  ) {
    return 'eBay Auction';
  }
  
  // Default: return original value
  return marketplaceSoldOn;
};

// Standard marketplace colors for consistent theming
export const marketplaceColors: Record<string, string> = {
  'Walmart Marketplace': 'hsl(211, 100%, 43%)',
  'Walmart DSV': 'hsl(211, 80%, 32%)',
  'Walmart In Store': 'hsl(211, 60%, 55%)',
  'eBay': 'hsl(45, 100%, 44%)',
  'eBay Auction': 'hsl(38, 90%, 38%)',
  'DirectLiquidation': 'hsl(198, 70%, 45%)',
  'WhatNot': 'hsl(168, 55%, 42%)',
  'VIPOutlet': 'hsl(142, 50%, 40%)',
  'Local Pickup': 'hsl(220, 15%, 55%)',
  'Manual Sales': 'hsl(220, 10%, 65%)',
  'goWholesale': 'hsl(180, 45%, 40%)',
  'Amazon': 'hsl(25, 85%, 50%)',
};

export const getMarketplaceColor = (marketplace: string, index: number): string => {
  return marketplaceColors[marketplace] || `hsl(${(index * 60) % 360}, 70%, 50%)`;
};
