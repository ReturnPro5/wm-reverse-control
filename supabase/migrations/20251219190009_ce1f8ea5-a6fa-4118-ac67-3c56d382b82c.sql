-- Add tag_pricing_condition column to sales_metrics
ALTER TABLE public.sales_metrics 
ADD COLUMN tag_pricing_condition text DEFAULT NULL;