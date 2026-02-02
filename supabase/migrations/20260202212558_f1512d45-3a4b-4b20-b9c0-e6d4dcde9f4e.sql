-- Add title column to sales_metrics table for product title drill-down
ALTER TABLE public.sales_metrics 
ADD COLUMN title text;