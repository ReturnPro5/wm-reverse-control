-- Add 'Monthly' to the file_type enum for quarterly review monthly files
ALTER TYPE public.file_type ADD VALUE IF NOT EXISTS 'Monthly';