
-- Drop both versions and recreate with only one parameter type
DROP FUNCTION IF EXISTS public.get_monthly_chart_data(uuid[]);
DROP FUNCTION IF EXISTS public.get_monthly_chart_data(text[]);

CREATE OR REPLACE FUNCTION public.get_monthly_chart_data(p_file_ids text[] DEFAULT NULL)
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
