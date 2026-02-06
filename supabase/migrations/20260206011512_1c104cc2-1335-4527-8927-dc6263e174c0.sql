
-- Server-side aggregation for Monthly tab KPIs
CREATE OR REPLACE FUNCTION public.get_monthly_kpis(p_file_ids uuid[] DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'gross_sales', COALESCE(SUM(gross_sale), 0),
    'effective_retail', COALESCE(SUM(effective_retail), 0),
    'units_count', COUNT(*),
    'refund_total', COALESCE(SUM(refund_amount), 0),
    'invoiced_check_in_fee', COALESCE(SUM(invoiced_check_in_fee), 0),
    'invoiced_refurb_fee', COALESCE(SUM(invoiced_refurb_fee), 0),
    'invoiced_overbox_fee', COALESCE(SUM(invoiced_overbox_fee), 0),
    'invoiced_packaging_fee', COALESCE(SUM(invoiced_packaging_fee), 0),
    'invoiced_pps_fee', COALESCE(SUM(invoiced_pps_fee), 0),
    'invoiced_shipping_fee', COALESCE(SUM(invoiced_shipping_fee), 0),
    'invoiced_merchant_fee', COALESCE(SUM(invoiced_merchant_fee), 0),
    'invoiced_revshare_fee', COALESCE(SUM(invoiced_revshare_fee), 0),
    'invoiced_3pmp_fee', COALESCE(SUM(invoiced_3pmp_fee), 0),
    'invoiced_marketing_fee', COALESCE(SUM(invoiced_marketing_fee), 0),
    'invoiced_refund_fee', COALESCE(SUM(invoiced_refund_fee), 0)
  ) INTO result
  FROM sales_metrics
  WHERE marketplace_profile_sold_on <> 'Transfer'
    AND sale_price > 0
    AND (p_file_ids IS NULL OR file_upload_id = ANY(p_file_ids));
  
  RETURN result;
END;
$$;

-- Server-side aggregation for Monthly chart data (by month + marketplace)
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
      to_char(order_closed_date::date, 'YYYY-MM') as month,
      marketplace_profile_sold_on as marketplace,
      SUM(gross_sale) as gross_sales,
      SUM(effective_retail) as effective_retail,
      COUNT(*) as units
    FROM sales_metrics
    WHERE marketplace_profile_sold_on <> 'Transfer'
      AND sale_price > 0
      AND (p_file_ids IS NULL OR file_upload_id = ANY(p_file_ids))
    GROUP BY to_char(order_closed_date::date, 'YYYY-MM'), marketplace_profile_sold_on
    ORDER BY month, marketplace_profile_sold_on
  ) t;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;
