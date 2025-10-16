-- Add account_id column to aws_connections table
-- This stores the user's AWS account ID (extracted from role ARN)

ALTER TABLE aws_connections 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_aws_connections_account_id ON aws_connections(account_id);

-- Update existing records (extract account ID from role_arn if exists)
UPDATE aws_connections 
SET account_id = SPLIT_PART(SPLIT_PART(role_arn, ':', 5), '/', 1)
WHERE role_arn IS NOT NULL AND account_id IS NULL;

COMMENT ON COLUMN aws_connections.account_id IS 'AWS Account ID (12 digits) extracted from role ARN';
