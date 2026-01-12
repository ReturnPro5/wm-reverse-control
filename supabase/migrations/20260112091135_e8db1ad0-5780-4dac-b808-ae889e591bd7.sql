-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can manage file_uploads" ON public.file_uploads;

-- Create permissive policy that allows all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users"
ON public.file_uploads
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also allow anonymous access since no auth is implemented yet
CREATE POLICY "Allow all operations for anonymous users"
ON public.file_uploads
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Fix sales_metrics table as well
DROP POLICY IF EXISTS "Authenticated users can manage sales_metrics" ON public.sales_metrics;

CREATE POLICY "Allow all operations for authenticated users on sales_metrics"
ON public.sales_metrics
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on sales_metrics"
ON public.sales_metrics
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Fix lifecycle_events table
DROP POLICY IF EXISTS "Authenticated users can manage lifecycle_events" ON public.lifecycle_events;

CREATE POLICY "Allow all operations for authenticated users on lifecycle_events"
ON public.lifecycle_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on lifecycle_events"
ON public.lifecycle_events
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Fix units_canonical table
DROP POLICY IF EXISTS "Authenticated users can manage units_canonical" ON public.units_canonical;

CREATE POLICY "Allow all operations for authenticated users on units_canonical"
ON public.units_canonical
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on units_canonical"
ON public.units_canonical
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Fix fee_metrics table
DROP POLICY IF EXISTS "Authenticated users can manage fee_metrics" ON public.fee_metrics;

CREATE POLICY "Allow all operations for authenticated users on fee_metrics"
ON public.fee_metrics
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for anonymous users on fee_metrics"
ON public.fee_metrics
FOR ALL
TO anon
USING (true)
WITH CHECK (true);