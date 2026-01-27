-- Drop the previous functions and create corrected ones that use stored wm_week values
-- and calculate WM weeks properly for order_closed_date and checked_in_on

DROP FUNCTION IF EXISTS public.get_inbound_metrics(uuid[], integer[], integer[]);
DROP FUNCTION IF EXISTS public.get_inbound_daily_chart(uuid[], integer[], integer[]);

-- Walmart fiscal week calculation function
-- WM fiscal year starts on the Saturday closest to Feb 1
CREATE OR REPLACE FUNCTION public.get_wm_week_number(p_date date)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  week_start date;
  fiscal_year_start date;
  feb1 date;
  feb1_dow integer;
  days_to_prev_sat integer;
  days_to_next_sat integer;
  fiscal_start_year integer;
  day_of_week integer;
  days_to_subtract integer;
  days_diff integer;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get the Saturday of the week containing the date (WM week runs Sat-Fri)
  day_of_week := EXTRACT(DOW FROM p_date)::integer; -- 0=Sunday, 6=Saturday
  days_to_subtract := CASE WHEN day_of_week = 6 THEN 0 ELSE day_of_week + 1 END;
  week_start := p_date - days_to_subtract;
  
  -- Determine fiscal year (if in January, use previous year)
  fiscal_start_year := CASE 
    WHEN EXTRACT(MONTH FROM week_start) = 1 THEN EXTRACT(YEAR FROM week_start)::integer - 1 
    ELSE EXTRACT(YEAR FROM week_start)::integer 
  END;
  
  -- Find Saturday closest to Feb 1 of fiscal start year
  feb1 := make_date(fiscal_start_year, 2, 1);
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
  
  -- Calculate weeks from fiscal year start
  days_diff := week_start - fiscal_year_start;
  RETURN (days_diff / 7) + 1;
END;
$$;

-- Optimized inbound metrics using proper WM week calculation
CREATE OR REPLACE FUNCTION public.get_inbound_metrics(
  p_file_ids uuid[],
  p_wm_weeks integer[] DEFAULT NULL,
  p_wm_days integer[] DEFAULT NULL
)
RETURNS TABLE (
  received_count bigint,
  checked_in_count bigint,
  sold_same_week_sales numeric,
  sold_same_week_retail numeric,
  sold_count bigint,
  checked_in_same_week_retail numeric,
  not_checked_in_same_week_retail numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_week_filter boolean := p_wm_weeks IS NOT NULL AND array_length(p_wm_weeks, 1) > 0;
  has_day_filter boolean := p_wm_days IS NOT NULL AND array_length(p_wm_days, 1) > 0;
BEGIN
  RETURN QUERY
  WITH deduplicated AS (
    SELECT DISTINCT ON (u.trgid)
      u.trgid,
      u.received_on,
      u.checked_in_on,
      u.order_closed_date,
      u.effective_retail,
      u.sale_price,
      u.master_program_name,
      get_wm_week_number(u.received_on) as received_week,
      u.wm_day_of_week as received_day,
      get_wm_week_number(u.order_closed_date) as sold_week,
      get_wm_week_number(u.checked_in_on) as checked_in_week
    FROM units_canonical u
    WHERE u.file_upload_id = ANY(p_file_ids)
      AND u.tag_clientsource = 'WMUS'
      AND u.received_on IS NOT NULL
    ORDER BY u.trgid, u.received_on DESC
  ),
  filtered AS (
    SELECT *
    FROM deduplicated d
    WHERE (NOT has_week_filter OR d.received_week = ANY(p_wm_weeks))
      AND (NOT has_day_filter OR d.received_day = ANY(p_wm_days))
  )
  SELECT
    COUNT(*)::bigint as received_count,
    COUNT(*) FILTER (WHERE f.checked_in_on IS NOT NULL)::bigint as checked_in_count,
    COALESCE(SUM(f.sale_price) FILTER (
      WHERE f.sold_week IS NOT NULL 
        AND f.sale_price IS NOT NULL
        AND (f.master_program_name IS NULL OR LOWER(f.master_program_name) NOT LIKE '%owned%')
        AND (
          (has_week_filter AND f.sold_week = ANY(p_wm_weeks) AND f.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND f.sold_week = f.received_week)
        )
    ), 0)::numeric as sold_same_week_sales,
    COALESCE(SUM(f.effective_retail) FILTER (
      WHERE f.sold_week IS NOT NULL 
        AND f.sale_price IS NOT NULL
        AND (f.master_program_name IS NULL OR LOWER(f.master_program_name) NOT LIKE '%owned%')
        AND (
          (has_week_filter AND f.sold_week = ANY(p_wm_weeks) AND f.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND f.sold_week = f.received_week)
        )
    ), 0)::numeric as sold_same_week_retail,
    COUNT(*) FILTER (
      WHERE f.sold_week IS NOT NULL 
        AND f.sale_price IS NOT NULL
        AND (f.master_program_name IS NULL OR LOWER(f.master_program_name) NOT LIKE '%owned%')
        AND (
          (has_week_filter AND f.sold_week = ANY(p_wm_weeks) AND f.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND f.sold_week = f.received_week)
        )
    )::bigint as sold_count,
    COALESCE(SUM(f.effective_retail) FILTER (
      WHERE f.checked_in_on IS NOT NULL
        AND (
          (has_week_filter AND f.checked_in_week = ANY(p_wm_weeks) AND f.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND f.checked_in_week = f.received_week)
        )
    ), 0)::numeric as checked_in_same_week_retail,
    COALESCE(SUM(f.effective_retail) FILTER (
      WHERE f.checked_in_on IS NULL
        OR NOT (
          (has_week_filter AND f.checked_in_week = ANY(p_wm_weeks) AND f.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND f.checked_in_week = f.received_week)
        )
    ), 0)::numeric as not_checked_in_same_week_retail
  FROM filtered f;
END;
$$;

-- Daily chart function with proper WM week calculation
CREATE OR REPLACE FUNCTION public.get_inbound_daily_chart(
  p_file_ids uuid[],
  p_wm_weeks integer[] DEFAULT NULL,
  p_wm_days integer[] DEFAULT NULL
)
RETURNS TABLE (
  date date,
  received bigint,
  checked_in bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_week_filter boolean := p_wm_weeks IS NOT NULL AND array_length(p_wm_weeks, 1) > 0;
  has_day_filter boolean := p_wm_days IS NOT NULL AND array_length(p_wm_days, 1) > 0;
BEGIN
  RETURN QUERY
  WITH deduplicated AS (
    SELECT DISTINCT ON (u.trgid)
      u.trgid,
      u.received_on,
      u.checked_in_on,
      get_wm_week_number(u.received_on) as received_week,
      u.wm_day_of_week as received_day
    FROM units_canonical u
    WHERE u.file_upload_id = ANY(p_file_ids)
      AND u.tag_clientsource = 'WMUS'
      AND u.received_on IS NOT NULL
    ORDER BY u.trgid, u.received_on DESC
  ),
  filtered AS (
    SELECT *
    FROM deduplicated d
    WHERE (NOT has_week_filter OR d.received_week = ANY(p_wm_weeks))
      AND (NOT has_day_filter OR d.received_day = ANY(p_wm_days))
  )
  SELECT
    f.received_on as date,
    COUNT(*)::bigint as received,
    COUNT(*) FILTER (WHERE f.checked_in_on IS NOT NULL)::bigint as checked_in
  FROM filtered f
  GROUP BY f.received_on
  ORDER BY f.received_on;
END;
$$;