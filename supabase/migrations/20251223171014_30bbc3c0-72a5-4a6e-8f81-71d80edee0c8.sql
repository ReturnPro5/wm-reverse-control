-- Add calculated_check_in_fee column to sales_metrics
ALTER TABLE public.sales_metrics 
ADD COLUMN calculated_check_in_fee NUMERIC DEFAULT NULL;