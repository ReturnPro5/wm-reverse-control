-- Create an optimized function for inbound metrics aggregation
-- This runs server-side instead of fetching all rows to the client

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
    -- Deduplicate by trgid, keeping the most recent received_on
    SELECT DISTINCT ON (u.trgid)
      u.trgid,
      u.received_on,
      u.checked_in_on,
      u.order_closed_date,
      u.effective_retail,
      u.sale_price,
      u.master_program_name,
      u.wm_week as received_week,
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
  ),
  with_calculations AS (
    SELECT
      f.*,
      -- Calculate sold week from order_closed_date
      CASE WHEN f.order_closed_date IS NOT NULL 
        THEN EXTRACT(WEEK FROM f.order_closed_date)::integer 
        ELSE NULL 
      END as sold_week,
      -- Calculate checked_in week from checked_in_on
      CASE WHEN f.checked_in_on IS NOT NULL 
        THEN EXTRACT(WEEK FROM f.checked_in_on)::integer 
        ELSE NULL 
      END as checked_in_week
    FROM filtered f
  )
  SELECT
    COUNT(*)::bigint as received_count,
    COUNT(*) FILTER (WHERE c.checked_in_on IS NOT NULL)::bigint as checked_in_count,
    COALESCE(SUM(c.sale_price) FILTER (
      WHERE c.sold_week IS NOT NULL 
        AND c.sale_price IS NOT NULL
        AND (c.master_program_name IS NULL OR LOWER(c.master_program_name) NOT LIKE '%owned%')
        AND (
          (has_week_filter AND c.sold_week = ANY(p_wm_weeks) AND c.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND c.sold_week = c.received_week)
        )
    ), 0)::numeric as sold_same_week_sales,
    COALESCE(SUM(c.effective_retail) FILTER (
      WHERE c.sold_week IS NOT NULL 
        AND c.sale_price IS NOT NULL
        AND (c.master_program_name IS NULL OR LOWER(c.master_program_name) NOT LIKE '%owned%')
        AND (
          (has_week_filter AND c.sold_week = ANY(p_wm_weeks) AND c.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND c.sold_week = c.received_week)
        )
    ), 0)::numeric as sold_same_week_retail,
    COUNT(*) FILTER (
      WHERE c.sold_week IS NOT NULL 
        AND c.sale_price IS NOT NULL
        AND (c.master_program_name IS NULL OR LOWER(c.master_program_name) NOT LIKE '%owned%')
        AND (
          (has_week_filter AND c.sold_week = ANY(p_wm_weeks) AND c.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND c.sold_week = c.received_week)
        )
    )::bigint as sold_count,
    COALESCE(SUM(c.effective_retail) FILTER (
      WHERE c.checked_in_on IS NOT NULL
        AND (
          (has_week_filter AND c.checked_in_week = ANY(p_wm_weeks) AND c.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND c.checked_in_week = c.received_week)
        )
    ), 0)::numeric as checked_in_same_week_retail,
    COALESCE(SUM(c.effective_retail) FILTER (
      WHERE c.checked_in_on IS NULL
        OR NOT (
          (has_week_filter AND c.checked_in_week = ANY(p_wm_weeks) AND c.received_week = ANY(p_wm_weeks))
          OR (NOT has_week_filter AND c.checked_in_week = c.received_week)
        )
    ), 0)::numeric as not_checked_in_same_week_retail
  FROM with_calculations c;
END;
$$;

-- Create a function for daily chart data (lightweight separate query)
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
      u.wm_week as received_week,
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