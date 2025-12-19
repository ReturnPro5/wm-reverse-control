-- Add columns for vendor pallet/invoice handling and invoiced fee values
ALTER TABLE public.sales_metrics
ADD COLUMN IF NOT EXISTS sorting_index text,
ADD COLUMN IF NOT EXISTS vendor_invoice_total numeric,
ADD COLUMN IF NOT EXISTS service_invoice_total numeric,
ADD COLUMN IF NOT EXISTS expected_hv_as_is_refurb_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_check_in_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_refurb_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_overbox_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_packaging_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_pps_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_shipping_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_merchant_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_revshare_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_3pmp_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_marketing_fee numeric,
ADD COLUMN IF NOT EXISTS invoiced_refund_fee numeric;