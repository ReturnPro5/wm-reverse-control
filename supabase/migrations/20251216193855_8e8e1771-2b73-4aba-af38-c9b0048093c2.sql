-- Add tag_clientsource column to units_canonical
ALTER TABLE public.units_canonical 
ADD COLUMN tag_clientsource text;

-- Add tag_clientsource column to sales_metrics
ALTER TABLE public.sales_metrics 
ADD COLUMN tag_clientsource text;