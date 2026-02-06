
-- Fix get_monthly_chart_data: change parameter from text[] to uuid[]
DROP FUNCTION IF EXISTS public.get_monthly_chart_data(text[]);

CREATE OR REPLACE FUNCTION public.get_monthly_chart_data(p_file_ids uuid[] DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT 
      wm_week,
      marketplace_profile_sold_on as marketplace,
      SUM(gross_sale) as gross_sales,
      SUM(effective_retail) as effective_retail,
      COUNT(*) as units,
      MIN(order_closed_date) as sort_date
    FROM sales_metrics
    WHERE (p_file_ids IS NULL OR file_upload_id = ANY(p_file_ids))
    GROUP BY wm_week, marketplace_profile_sold_on
    ORDER BY MIN(order_closed_date), wm_week
  ) t;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Add index to speed up file_upload_id filtering on sales_metrics
CREATE INDEX IF NOT EXISTS idx_sales_metrics_file_upload_id ON public.sales_metrics(file_upload_id);
