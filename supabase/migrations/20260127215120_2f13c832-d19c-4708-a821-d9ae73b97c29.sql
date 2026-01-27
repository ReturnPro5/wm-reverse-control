-- Fix: Calculate WM week from received_on instead of using the pre-computed wm_week column
-- The wm_week column is based on order_closed_date, not received_on

DROP FUNCTION IF EXISTS public.get_inbound_metrics(uuid[], integer[], integer[]);
DROP FUNCTION IF EXISTS public.get_inbound_daily_chart(uuid[], integer[], integer[]);

-- Helper function to get WM day of week (Sat=1, Sun=2, ... Fri=7)
CREATE OR REPLACE FUNCTION public.get_wm_day_of_week(p_date date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE EXTRACT(DOW FROM p_date)::integer
    WHEN 0 THEN 2  -- Sunday
    WHEN 1 THEN 3  -- Monday
    WHEN 2 THEN 4  -- Tuesday
    WHEN 3 THEN 5  -- Wednesday
    WHEN 4 THEN 6  -- Thursday
    WHEN 5 THEN 7  -- Friday
    WHEN 6 THEN 1  -- Saturday
  END
$$;

-- Recreate metrics function - calculate WM week from received_on
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
      get_wm_week_number(u.received_on) as received_week,
      get_wm_day_of_week(u.received_on) as received_day
    FROM units_canonical u
    WHERE u.file_upload_id = ANY(p_file_ids)
      AND u.tag_clientsource = 'WMUS'
      AND u.received_on IS NOT NULL
    ORDER BY u.trgid, u.received_on DESC
  ),
  filtered AS (
    SELECT *
    FROM deduped
    WHERE (p_wm_weeks IS NULL OR received_week = ANY(p_wm_weeks))
      AND (p_wm_days IS NULL OR received_day = ANY(p_wm_days))
  )
  SELECT
    COUNT(*)::bigint as received_count,
    COUNT(*) FILTER (WHERE checked_in_on IS NOT NULL)::bigint as checked_in_count,
    COALESCE(SUM(sale_price) FILTER (
      WHERE order_closed_date IS NOT NULL 
        AND sale_price IS NOT NULL
        AND sale_price > 0
        AND (master_program_name IS NULL OR LOWER(master_program_name) NOT LIKE '%owned%')
        AND get_wm_week_number(order_closed_date) = received_week
    ), 0)::numeric as sold_same_week_sales,
    COALESCE(SUM(effective_retail) FILTER (
      WHERE order_closed_date IS NOT NULL 
        AND sale_price IS NOT NULL
        AND sale_price > 0
        AND (master_program_name IS NULL OR LOWER(master_program_name) NOT LIKE '%owned%')
        AND get_wm_week_number(order_closed_date) = received_week
    ), 0)::numeric as sold_same_week_retail,
    COUNT(*) FILTER (
      WHERE order_closed_date IS NOT NULL 
        AND sale_price IS NOT NULL
        AND sale_price > 0
        AND (master_program_name IS NULL OR LOWER(master_program_name) NOT LIKE '%owned%')
        AND get_wm_week_number(order_closed_date) = received_week
    )::bigint as sold_count,
    COALESCE(SUM(effective_retail) FILTER (
      WHERE checked_in_on IS NOT NULL
        AND get_wm_week_number(checked_in_on) = received_week
    ), 0)::numeric as checked_in_same_week_retail,
    COALESCE(SUM(effective_retail) FILTER (
      WHERE checked_in_on IS NULL
        OR get_wm_week_number(checked_in_on) IS NULL
        OR get_wm_week_number(checked_in_on) != received_week
    ), 0)::numeric as not_checked_in_same_week_retail
  FROM filtered;
$$;

-- Recreate chart function - calculate WM week from received_on
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
      u.checked_in_on,
      get_wm_week_number(u.received_on) as received_week,
      get_wm_day_of_week(u.received_on) as received_day
    FROM units_canonical u
    WHERE u.file_upload_id = ANY(p_file_ids)
      AND u.tag_clientsource = 'WMUS'
      AND u.received_on IS NOT NULL
    ORDER BY u.trgid, u.received_on DESC
  ),
  filtered AS (
    SELECT *
    FROM deduped
    WHERE (p_wm_weeks IS NULL OR received_week = ANY(p_wm_weeks))
      AND (p_wm_days IS NULL OR received_day = ANY(p_wm_days))
  )
  SELECT
    received_on as date,
    COUNT(*)::bigint as received,
    COUNT(*) FILTER (WHERE checked_in_on IS NOT NULL)::bigint as checked_in
  FROM filtered
  GROUP BY received_on
  ORDER BY received_on;
$$;

-- Add an index on received_on for better performance
CREATE INDEX IF NOT EXISTS idx_units_canonical_received_on ON public.units_canonical(received_on);