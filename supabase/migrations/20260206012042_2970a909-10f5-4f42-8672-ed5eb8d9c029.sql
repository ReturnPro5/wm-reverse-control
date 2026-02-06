
CREATE OR REPLACE FUNCTION public.get_monthly_chart_data(p_file_ids uuid[] DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT 
      wm_week,
      marketplace_profile_sold_on as marketplace,
      SUM(gross_sale) as gross_sales,
      SUM(effective_retail) as effective_retail,
      COUNT(*) as units
    FROM sales_metrics
    WHERE marketplace_profile_sold_on <> 'Transfer'
      AND sale_price > 0
      AND (p_file_ids IS NULL OR file_upload_id = ANY(p_file_ids))
    GROUP BY wm_week, marketplace_profile_sold_on
    ORDER BY wm_week, marketplace_profile_sold_on
  ) t;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;
