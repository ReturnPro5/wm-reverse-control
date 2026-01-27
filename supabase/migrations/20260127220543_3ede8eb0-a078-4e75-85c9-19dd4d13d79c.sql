-- Create a helper function to get the date range for a WM week
CREATE OR REPLACE FUNCTION public.get_wm_week_date_range(p_wm_week integer, p_year integer DEFAULT NULL)
RETURNS TABLE(start_date date, end_date date)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  fiscal_year integer;
  feb1 date;
  feb1_dow integer;
  fiscal_year_start date;
  days_to_prev_sat integer;
  days_to_next_sat integer;
BEGIN
  -- Default to current year if not provided
  fiscal_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  
  -- Find Saturday closest to Feb 1
  feb1 := make_date(fiscal_year, 2, 1);
  feb1_dow := EXTRACT(DOW FROM feb1)::integer;
  
  IF feb1_dow = 6 THEN
    fiscal_year_start := feb1;
  ELSE
    days_to_prev_sat := CASE WHEN feb1_dow = 0 THEN 1 ELSE feb1_dow + 1 END;
    days_to_next_sat := 6 - feb1_dow;
    
    IF days_to_prev_sat <= days_to_next_sat THEN
      fiscal_year_start := feb1 - days_to_prev_sat;
    ELSE
      fiscal_year_start := feb1 + days_to_next_sat;
    END IF;
  END IF;
  
  -- Calculate week start and end
  start_date := fiscal_year_start + ((p_wm_week - 1) * 7);
  end_date := start_date + 6;
  
  RETURN NEXT;
END;
$$;

-- Optimized get_inbound_metrics using date range filtering (index-friendly)
DROP FUNCTION IF EXISTS public.get_inbound_metrics(uuid[], integer[], integer[]);

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
    COALESCE(SUM(effective_retail) FILTER (
      WHERE checked_in_on IS NOT NULL
        AND get_wm_week_number(checked_in_on) = get_wm_week_number(received_on)
    ), 0)::numeric as checked_in_same_week_retail,
    COALESCE(SUM(effective_retail) FILTER (
      WHERE checked_in_on IS NULL
        OR get_wm_week_number(checked_in_on) IS NULL
        OR get_wm_week_number(checked_in_on) != get_wm_week_number(received_on)
    ), 0)::numeric as not_checked_in_same_week_retail
  FROM deduped;
$$;

-- Optimized get_inbound_daily_chart using date range filtering
DROP FUNCTION IF EXISTS public.get_inbound_daily_chart(uuid[], integer[], integer[]);

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
  WITH week_ranges AS (
    SELECT r.start_date, r.end_date
    FROM unnest(COALESCE(p_wm_weeks, ARRAY[]::integer[])) AS w(week_num)
    CROSS JOIN LATERAL get_wm_week_date_range(w.week_num, 2025) AS r
  ),
  deduped AS (
    SELECT DISTINCT ON (u.trgid)
      u.trgid,
      u.received_on,
      u.checked_in_on
    FROM units_canonical u
    WHERE u.file_upload_id = ANY(p_file_ids)
      AND u.tag_clientsource = 'WMUS'
      AND u.received_on IS NOT NULL
      AND (
        p_wm_weeks IS NULL 
        OR EXISTS (
          SELECT 1 FROM week_ranges wr 
          WHERE u.received_on BETWEEN wr.start_date AND wr.end_date
        )
      )
      AND (
        p_wm_days IS NULL 
        OR get_wm_day_of_week(u.received_on) = ANY(p_wm_days)
      )
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