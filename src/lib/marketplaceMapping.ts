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
  'eBay': 'hsl(45, 93%, 47%)',
  'eBay Auction': 'hsl(45, 80%, 35%)',
  'DirectLiquidation': 'hsl(200, 70%, 50%)',
  'WhatNot': 'hsl(280, 87%, 65%)',
  'VIPOutlet': 'hsl(142, 76%, 36%)',
  'Local Pickup': 'hsl(320, 70%, 50%)',
  'Manual Sales': 'hsl(0, 0%, 50%)',
  'Walmart Marketplace': 'hsl(207, 90%, 54%)',
  'Walmart DSV': 'hsl(207, 70%, 40%)',
  'Walmart In Store': 'hsl(207, 50%, 60%)',
  'goWholesale': 'hsl(170, 70%, 45%)',
  'Amazon': 'hsl(27, 98%, 54%)',
};

export const getMarketplaceColor = (marketplace: string, index: number): string => {
  return marketplaceColors[marketplace] || `hsl(${(index * 60) % 360}, 70%, 50%)`;
};
