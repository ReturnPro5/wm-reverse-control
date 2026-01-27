-- Add indexes to speed up DISTINCT queries on filter columns
CREATE INDEX IF NOT EXISTS idx_units_canonical_program_name ON units_canonical(program_name) WHERE program_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_units_canonical_master_program_name ON units_canonical(master_program_name) WHERE master_program_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_units_canonical_category_name ON units_canonical(category_name) WHERE category_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_units_canonical_facility ON units_canonical(facility) WHERE facility IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_units_canonical_location_id ON units_canonical(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_units_canonical_tag_client_ownership ON units_canonical(tag_client_ownership) WHERE tag_client_ownership IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_units_canonical_tag_clientsource ON units_canonical(tag_clientsource) WHERE tag_clientsource IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_metrics_marketplace ON sales_metrics(marketplace_profile_sold_on) WHERE marketplace_profile_sold_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_metrics_order_type ON sales_metrics(order_type_sold_on) WHERE order_type_sold_on IS NOT NULL;

-- Simpler version that runs each distinct query separately for better performance
DROP FUNCTION IF EXISTS public.get_filter_options();

CREATE OR REPLACE FUNCTION public.get_filter_options()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Build result with individual subqueries
  SELECT json_build_object(
    'programs', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT program_name AS x FROM units_canonical WHERE program_name IS NOT NULL ORDER BY program_name LIMIT 200) t), '[]'::json),
    'masterPrograms', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT master_program_name AS x FROM units_canonical WHERE master_program_name IS NOT NULL ORDER BY master_program_name LIMIT 100) t), '[]'::json),
    'categories', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT category_name AS x FROM units_canonical WHERE category_name IS NOT NULL ORDER BY category_name LIMIT 100) t), '[]'::json),
    'facilities', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT facility AS x FROM units_canonical WHERE facility IS NOT NULL ORDER BY facility LIMIT 50) t), '[]'::json),
    'locations', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT location_id AS x FROM units_canonical WHERE location_id IS NOT NULL ORDER BY location_id LIMIT 100) t), '[]'::json),
    'ownerships', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT tag_client_ownership AS x FROM units_canonical WHERE tag_client_ownership IS NOT NULL ORDER BY tag_client_ownership LIMIT 50) t), '[]'::json),
    'clientSources', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT tag_clientsource AS x FROM units_canonical WHERE tag_clientsource IS NOT NULL ORDER BY tag_clientsource LIMIT 20) t), '[]'::json),
    'marketplaces', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT marketplace_profile_sold_on AS x FROM sales_metrics WHERE marketplace_profile_sold_on IS NOT NULL ORDER BY marketplace_profile_sold_on LIMIT 50) t), '[]'::json),
    'fileTypes', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT file_type AS x FROM file_uploads WHERE file_type IS NOT NULL ORDER BY file_type) t), '[]'::json),
    'orderTypes', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT order_type_sold_on AS x FROM sales_metrics WHERE order_type_sold_on IS NOT NULL ORDER BY order_type_sold_on LIMIT 50) t), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;