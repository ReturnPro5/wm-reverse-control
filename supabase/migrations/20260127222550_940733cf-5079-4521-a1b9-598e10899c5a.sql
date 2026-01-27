
-- Fix get_inbound_metrics to use simple checked_in logic (not week comparison)
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
SET search_path = 'public'
AS $$
  WITH week_ranges AS (
    -- Get date ranges for requested weeks (or all dates if no filter)
    SELECT r.start_date, r.end_date
    FROM unnest(COALESCE(p_wm_weeks, ARRAY[]::integer[])) AS w(week_num)
    CROSS JOIN LATERAL get_wm_week_date_range(w.week_num, 2025) AS r
  ),
  deduped AS (
    SELECT DISTINCT ON (u.trgid)
      u.trgid,
      u.received_on,
      u.checked_in_on,
      u.order_closed_date,
      u.effective_retail,
      u.sale_price,
      u.master_program_name
    FROM units_canonical u
    WHERE u.file_upload_id = ANY(p_file_ids)
      AND u.tag_clientsource = 'WMUS'
      AND u.received_on IS NOT NULL
      -- Only apply date filter if weeks were specified
      AND (
        p_wm_weeks IS NULL 
        OR EXISTS (
          SELECT 1 FROM week_ranges wr 
          WHERE u.received_on BETWEEN wr.start_date AND wr.end_date
        )
      )
      -- Apply day of week filter if specified
      AND (
        p_wm_days IS NULL 
        OR get_wm_day_of_week(u.received_on) = ANY(p_wm_days)
      )
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
        AND get_wm_week_number(order_closed_date) = get_wm_week_number(received_on)
    ), 0)::numeric as sold_same_week_sales,
    COALESCE(SUM(effective_retail) FILTER (
      WHERE order_closed_date IS NOT NULL 
        AND sale_price IS NOT NULL
        AND sale_price > 0
        AND (master_program_name IS NULL OR LOWER(master_program_name) NOT LIKE '%owned%')
        AND get_wm_week_number(order_closed_date) = get_wm_week_number(received_on)
    ), 0)::numeric as sold_same_week_retail,
    COUNT(*) FILTER (
      WHERE order_closed_date IS NOT NULL 
        AND sale_price IS NOT NULL
        AND sale_price > 0
        AND (master_program_name IS NULL OR LOWER(master_program_name) NOT LIKE '%owned%')
        AND get_wm_week_number(order_closed_date) = get_wm_week_number(received_on)
    )::bigint as sold_count,
    -- Fixed: Simple check-in logic (has checked_in_on date = checked in)
    COALESCE(SUM(effective_retail) FILTER (WHERE checked_in_on IS NOT NULL), 0)::numeric as checked_in_same_week_retail,
    -- Fixed: Simple not checked-in logic (no checked_in_on date = not checked in)
    COALESCE(SUM(effective_retail) FILTER (WHERE checked_in_on IS NULL), 0)::numeric as not_checked_in_same_week_retail
  FROM deduped;
$$;
