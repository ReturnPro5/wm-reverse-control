-- Add columns for eBay Auction detection
ALTER TABLE public.sales_metrics 
ADD COLUMN IF NOT EXISTS tag_ebay_auction_sale boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS b2c_auction text;