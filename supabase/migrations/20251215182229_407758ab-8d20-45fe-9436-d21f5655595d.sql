-- Create enum for file types
CREATE TYPE public.file_type AS ENUM ('Sales', 'Inbound', 'Outbound', 'Inventory', 'Unknown');

-- Create enum for lifecycle stages
CREATE TYPE public.lifecycle_stage AS ENUM ('Received', 'CheckedIn', 'Tested', 'Listed', 'Sold');

-- File uploads tracking table
CREATE TABLE public.file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_type file_type NOT NULL DEFAULT 'Unknown',
  file_business_date DATE NOT NULL,
  upload_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count INTEGER DEFAULT 0,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Units canonical table (current state of each unit - deduplicated)
CREATE TABLE public.units_canonical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trgid TEXT NOT NULL UNIQUE,
  file_upload_id UUID REFERENCES public.file_uploads(id) ON DELETE CASCADE,
  
  -- Lifecycle dates
  received_on DATE,
  checked_in_on DATE,
  tested_on DATE,
  first_listed_date DATE,
  order_closed_date DATE,
  
  -- Current lifecycle stage
  current_stage lifecycle_stage,
  
  -- Retail values
  upc_retail NUMERIC(10,2),
  mr_lmr_upc_average_category_retail NUMERIC(10,2),
  effective_retail NUMERIC(10,2),
  
  -- Sales data
  sale_price NUMERIC(10,2),
  discount_amount NUMERIC(10,2),
  
  -- Program and category info
  program_name TEXT,
  master_program_name TEXT,
  category_name TEXT,
  marketplace_profile_sold_on TEXT,
  
  -- Location and ownership
  facility TEXT,
  location_id TEXT,
  tag_client_ownership TEXT,
  
  -- WM week fields
  wm_week INTEGER,
  wm_day_of_week INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lifecycle events table (preserves all events, never deleted)
CREATE TABLE public.lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trgid TEXT NOT NULL,
  file_upload_id UUID REFERENCES public.file_uploads(id) ON DELETE CASCADE,
  stage lifecycle_stage NOT NULL,
  event_date DATE NOT NULL,
  file_business_date DATE NOT NULL,
  wm_week INTEGER,
  wm_day_of_week INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales metrics table
CREATE TABLE public.sales_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trgid TEXT NOT NULL UNIQUE,
  file_upload_id UUID REFERENCES public.file_uploads(id) ON DELETE CASCADE,
  
  order_closed_date DATE NOT NULL,
  sale_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  gross_sale NUMERIC(10,2) NOT NULL DEFAULT 0,
  effective_retail NUMERIC(10,2),
  
  -- Refund tracking
  refund_amount NUMERIC(10,2) DEFAULT 0,
  is_refunded BOOLEAN DEFAULT false,
  
  -- Program info
  program_name TEXT,
  master_program_name TEXT,
  category_name TEXT,
  marketplace_profile_sold_on TEXT,
  facility TEXT,
  
  -- WM week
  wm_week INTEGER,
  wm_day_of_week INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fee metrics table
CREATE TABLE public.fee_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trgid TEXT NOT NULL UNIQUE,
  file_upload_id UUID REFERENCES public.file_uploads(id) ON DELETE CASCADE,
  
  -- Individual fee columns
  check_in_fee NUMERIC(10,2) DEFAULT 0,
  packaging_fee NUMERIC(10,2) DEFAULT 0,
  pick_pack_ship_fee NUMERIC(10,2) DEFAULT 0,
  refurbishing_fee NUMERIC(10,2) DEFAULT 0,
  marketplace_fee NUMERIC(10,2) DEFAULT 0,
  total_fees NUMERIC(10,2) DEFAULT 0,
  
  -- Program info
  program_name TEXT,
  facility TEXT,
  
  -- WM week
  wm_week INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_units_canonical_trgid ON public.units_canonical(trgid);
CREATE INDEX idx_units_canonical_current_stage ON public.units_canonical(current_stage);
CREATE INDEX idx_units_canonical_wm_week ON public.units_canonical(wm_week);
CREATE INDEX idx_lifecycle_events_trgid ON public.lifecycle_events(trgid);
CREATE INDEX idx_lifecycle_events_stage ON public.lifecycle_events(stage);
CREATE INDEX idx_lifecycle_events_wm_week ON public.lifecycle_events(wm_week);
CREATE INDEX idx_sales_metrics_wm_week ON public.sales_metrics(wm_week);
CREATE INDEX idx_sales_metrics_order_closed ON public.sales_metrics(order_closed_date);
CREATE INDEX idx_fee_metrics_wm_week ON public.fee_metrics(wm_week);

-- Enable RLS (but allow all operations since single user)
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units_canonical ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_metrics ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for single-user access
CREATE POLICY "Allow all operations on file_uploads" ON public.file_uploads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on units_canonical" ON public.units_canonical FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on lifecycle_events" ON public.lifecycle_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sales_metrics" ON public.sales_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on fee_metrics" ON public.fee_metrics FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for units_canonical
CREATE TRIGGER update_units_canonical_updated_at
  BEFORE UPDATE ON public.units_canonical
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();