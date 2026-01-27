-- Drop and recreate with a much faster approach
-- Pre-filter data BEFORE computing WM weeks to reduce computation

DROP FUNCTION IF EXISTS public.get_inbound_metrics(uuid[], integer[], integer[]);
DROP FUNCTION IF EXISTS public.get_inbound_daily_chart(uuid[], integer[], integer[]);

-- Recreate metrics function with optimized logic
CREATE OR REPLACE FUNCTION public.get_inbound_metrics(
  p_file_ids uuid[],
  p_wm_weeks integer[] DEFAULT NULL,
  p_wm_days integer[] DEFAULT NULL
)
RETURNS TABLE(
  received_count bigint,
  checked_in_count bigint,
  sold_same_week_sales numeric,
  sold_same_week_retail numeric,
  sold_count bigint,
  checked_in_same_week_retail numeric,
  not_checked_in_same_week_retail numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deduped AS (
    SELECT DISTINCT ON (u.trgid)
      u.trgid,
      u.received_on,
      u.checked_in_on,
      u.order_closed_date,
      u.effective_retail,
      u.sale_price,
      u.master_program_name,
      u.wm_week,
      u.wm_day_of_week
    FROM units_canonical u
    WHERE u.file_upload_id = ANY(p_file_ids)
      AND u.tag_clientsource = 'WMUS'
      AND u.received_on IS NOT NULL
      AND (p_wm_weeks IS NULL OR u.wm_week = ANY(p_wm_weeks))
      AND (p_wm_days IS NULL OR u.wm_day_of_week = ANY(p_wm_days))
    ORDER BY u.trgid, u.received_on DESC
  )
  SELECT
    COUNT(*)::bigint as received_count,
    COUNT(*) FILTER (WHERE checked_in_on IS NOT NULL)::bigint as checked_in_count,
    COALESCE(SUM(sale_price) FILTER (
      WHERE order_closed_date IS NOT NULL 
        AND sale_price IS NOT NULL
        AND sale_price > 0
        AND (master_program_name IS NULL OR LOWER(master_program_name) NOT LIKE '%owned%')
        AND DATE_TRUNC('week', order_closed_date) = DATE_TRUNC('week', received_on)
    ), 0)::numeric as sold_same_week_sales,
    COALESCE(SUM(effective_retail) FILTER (
      WHERE order_closed_date IS NOT NULL 
        AND sale_price IS NOT NULL
        AND sale_price > 0
        AND (master_program_name IS NULL OR LOWER(master_program_name) NOT LIKE '%owned%')
        AND DATE_TRUNC('week', order_closed_date) = DATE_TRUNC('week', received_on)
    ), 0)::numeric as sold_same_week_retail,
    COUNT(*) FILTER (
      WHERE order_closed_date IS NOT NULL 
        AND sale_price IS NOT NULL
        AND sale_price > 0
        AND (master_program_name IS NULL OR LOWER(master_program_name) NOT LIKE '%owned%')
        AND DATE_TRUNC('week', order_closed_date) = DATE_TRUNC('week', received_on)
    )::bigint as sold_count,
    COALESCE(SUM(effective_retail) FILTER (
      WHERE checked_in_on IS NOT NULL
        AND DATE_TRUNC('week', checked_in_on) = DATE_TRUNC('week', received_on)
    ), 0)::numeric as checked_in_same_week_retail,
    COALESCE(SUM(effective_retail) FILTER (
      WHERE checked_in_on IS NULL
        OR DATE_TRUNC('week', checked_in_on) != DATE_TRUNC('week', received_on)
    ), 0)::numeric as not_checked_in_same_week_retail
  FROM deduped;
$$;

-- Recreate chart function with optimized logic
CREATE OR REPLACE FUNCTION public.get_inbound_daily_chart(
  p_file_ids uuid[],
  p_wm_weeks integer[] DEFAULT NULL,
  p_wm_days integer[] DEFAULT NULL
)
RETURNS TABLE(date date, received bigint, checked_in bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deduped AS (
    SELECT DISTINCT ON (u.trgid)
      u.trgid,
      u.received_on,
      u.checked_in_on
    FROM units_canonical u
    WHERE u.file_upload_id = ANY(p_file_ids)
      AND u.tag_clientsource = 'WMUS'
      AND u.received_on IS NOT NULL
      AND (p_wm_weeks IS NULL OR u.wm_week = ANY(p_wm_weeks))
      AND (p_wm_days IS NULL OR u.wm_day_of_week = ANY(p_wm_days))
    ORDER BY u.trgid, u.received_on DESC
  )
  SELECT
    received_on as date,
    COUNT(*)::bigint as received,
    COUNT(*) FILTER (WHERE checked_in_on IS NOT NULL)::bigint as checked_in
  FROM deduped
  GROUP BY received_on
  ORDER BY received_on;
$$;