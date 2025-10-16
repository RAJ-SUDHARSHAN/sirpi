-- Migration: Add AWS connection fields and deployment tracking
-- Created: 2025-01-14

-- Add missing columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS aws_connection_id UUID REFERENCES aws_connections(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS aws_role_arn TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deployment_status TEXT DEFAULT 'not_deployed';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deployment_error TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deployment_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deployment_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cloudformation_stack_set_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cloudformation_stack_set_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS terraform_state_version INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS terraform_state_updated_at TIMESTAMP WITH TIME ZONE;

-- Add missing columns to generations table
ALTER TABLE generations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE generations ADD COLUMN IF NOT EXISTS pr_number INTEGER;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS pr_url TEXT;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS pr_branch TEXT;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS pr_merged BOOLEAN DEFAULT FALSE;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS pr_merged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS s3_keys JSONB DEFAULT '[]'::jsonb;

-- Create index for project_id in generations
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id);

-- Update existing projects to have proper deployment_status based on current state
UPDATE projects SET deployment_status = 'pr_created' WHERE status = 'pr_created';
