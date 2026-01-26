-- Add order_type_sold_on column to sales_metrics for B2B/B2C order type filtering
ALTER TABLE public.sales_metrics 
ADD COLUMN order_type_sold_on text DEFAULT NULL;

-- Create an index for efficient filtering
CREATE INDEX idx_sales_metrics_order_type ON public.sales_metrics(order_type_sold_on);