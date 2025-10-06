-- =====================================================
-- MIGRATION: Add S3 keys and Terraform state tracking
-- Run after existing schema.sql
-- =====================================================

-- Add S3 keys column to generations table (replaces files JSONB blob)
ALTER TABLE generations 
  DROP COLUMN IF EXISTS files,
  ADD COLUMN IF NOT EXISTS s3_keys JSONB DEFAULT '[]'::jsonb;

-- Add project_id for linking generations to projects
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Create index for faster project lookups
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id);

-- Add Terraform state tracking columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS terraform_state_version TEXT,
  ADD COLUMN IF NOT EXISTS terraform_state_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deployment_status TEXT DEFAULT 'not_deployed';

-- Create table for Terraform drift detection
CREATE TABLE IF NOT EXISTS terraform_drift_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    check_status TEXT NOT NULL, -- 'in_sync', 'drift_detected', 'error'
    drift_summary JSONB DEFAULT '{}'::jsonb,
    resources_changed INTEGER DEFAULT 0,
    resources_added INTEGER DEFAULT 0,
    resources_deleted INTEGER DEFAULT 0,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drift_checks_project_id ON terraform_drift_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_drift_checks_status ON terraform_drift_checks(check_status);

-- Enable RLS on drift checks table
ALTER TABLE terraform_drift_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drift_checks_select_own ON terraform_drift_checks;
CREATE POLICY drift_checks_select_own ON terraform_drift_checks
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE user_id = requesting_user_id()
        )
    );

DROP POLICY IF EXISTS drift_checks_insert_own ON terraform_drift_checks;
CREATE POLICY drift_checks_insert_own ON terraform_drift_checks
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT id FROM projects WHERE user_id = requesting_user_id()
        )
    );

-- Add comment explaining state management
COMMENT ON COLUMN projects.terraform_state_version IS 'S3 version ID of latest Terraform state file';
COMMENT ON COLUMN projects.deployment_status IS 'not_deployed, deploying, deployed, failed, drift_detected';
COMMENT ON TABLE terraform_drift_checks IS 'Tracks infrastructure drift detection results';
