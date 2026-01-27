-- Create optimized RPC function to get all distinct filter options in one call
CREATE OR REPLACE FUNCTION public.get_filter_options()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'programs', (SELECT COALESCE(json_agg(DISTINCT program_name ORDER BY program_name), '[]'::json) FROM units_canonical WHERE program_name IS NOT NULL),
    'masterPrograms', (SELECT COALESCE(json_agg(DISTINCT master_program_name ORDER BY master_program_name), '[]'::json) FROM units_canonical WHERE master_program_name IS NOT NULL),
    'categories', (SELECT COALESCE(json_agg(DISTINCT category_name ORDER BY category_name), '[]'::json) FROM units_canonical WHERE category_name IS NOT NULL),
    'facilities', (SELECT COALESCE(json_agg(DISTINCT facility ORDER BY facility), '[]'::json) FROM units_canonical WHERE facility IS NOT NULL),
    'locations', (SELECT COALESCE(json_agg(DISTINCT location_id ORDER BY location_id), '[]'::json) FROM units_canonical WHERE location_id IS NOT NULL),
    'ownerships', (SELECT COALESCE(json_agg(DISTINCT tag_client_ownership ORDER BY tag_client_ownership), '[]'::json) FROM units_canonical WHERE tag_client_ownership IS NOT NULL),
    'clientSources', (SELECT COALESCE(json_agg(DISTINCT tag_clientsource ORDER BY tag_clientsource), '[]'::json) FROM units_canonical WHERE tag_clientsource IS NOT NULL),
    'marketplaces', (SELECT COALESCE(json_agg(DISTINCT marketplace_profile_sold_on ORDER BY marketplace_profile_sold_on), '[]'::json) FROM sales_metrics WHERE marketplace_profile_sold_on IS NOT NULL),
    'fileTypes', (SELECT COALESCE(json_agg(DISTINCT file_type ORDER BY file_type), '[]'::json) FROM file_uploads WHERE file_type IS NOT NULL),
    'orderTypes', (SELECT COALESCE(json_agg(DISTINCT order_type_sold_on ORDER BY order_type_sold_on), '[]'::json) FROM sales_metrics WHERE order_type_sold_on IS NOT NULL)
  );
$$;