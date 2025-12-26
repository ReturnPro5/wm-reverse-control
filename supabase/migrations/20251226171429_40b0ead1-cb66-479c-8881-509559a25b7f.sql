-- Drop existing permissive policies and create auth-required policies

-- file_uploads
DROP POLICY IF EXISTS "Allow all operations on file_uploads" ON public.file_uploads;
CREATE POLICY "Authenticated users can manage file_uploads"
ON public.file_uploads
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- sales_metrics
DROP POLICY IF EXISTS "Allow all operations on sales_metrics" ON public.sales_metrics;
CREATE POLICY "Authenticated users can manage sales_metrics"
ON public.sales_metrics
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- units_canonical
DROP POLICY IF EXISTS "Allow all operations on units_canonical" ON public.units_canonical;
CREATE POLICY "Authenticated users can manage units_canonical"
ON public.units_canonical
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- lifecycle_events
DROP POLICY IF EXISTS "Allow all operations on lifecycle_events" ON public.lifecycle_events;
CREATE POLICY "Authenticated users can manage lifecycle_events"
ON public.lifecycle_events
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- fee_metrics
DROP POLICY IF EXISTS "Allow all operations on fee_metrics" ON public.fee_metrics;
CREATE POLICY "Authenticated users can manage fee_metrics"
ON public.fee_metrics
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);