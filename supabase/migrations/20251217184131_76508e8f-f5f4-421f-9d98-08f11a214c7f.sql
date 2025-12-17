-- Add 'Production' to the file_type enum
ALTER TYPE file_type ADD VALUE 'Production';

-- Note: We'll keep 'Unknown' in the enum but it won't be used for categorized files