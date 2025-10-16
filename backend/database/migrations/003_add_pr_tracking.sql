-- Add PR tracking fields to generations table
ALTER TABLE generations
ADD COLUMN IF NOT EXISTS pr_number INTEGER,
ADD COLUMN IF NOT EXISTS pr_url TEXT,
ADD COLUMN IF NOT EXISTS pr_branch TEXT,
ADD COLUMN IF NOT EXISTS pr_merged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pr_merged_at TIMESTAMPTZ;

-- Add index for faster PR lookups
CREATE INDEX IF NOT EXISTS idx_generations_pr_number ON generations(pr_number) WHERE pr_number IS NOT NULL;

-- Add deployment tracking fields to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS deployment_pr_number INTEGER,
ADD COLUMN IF NOT EXISTS deployment_pr_url TEXT,
ADD COLUMN IF NOT EXISTS deployment_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deployment_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deployment_error TEXT,
ADD COLUMN IF NOT EXISTS deployment_status TEXT DEFAULT 'not_deployed',
ADD COLUMN IF NOT EXISTS cloudformation_stack_set_name TEXT,
ADD COLUMN IF NOT EXISTS cloudformation_stack_set_id TEXT;

COMMENT ON COLUMN generations.pr_number IS 'GitHub PR number for infrastructure changes';
COMMENT ON COLUMN generations.pr_url IS 'GitHub PR URL';
COMMENT ON COLUMN generations.pr_branch IS 'Git branch name for the PR';
COMMENT ON COLUMN generations.pr_merged IS 'Whether the PR has been merged';
COMMENT ON COLUMN generations.pr_merged_at IS 'Timestamp when PR was merged';
