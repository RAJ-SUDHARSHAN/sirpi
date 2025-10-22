-- Migration 004: Add AgentCore Memory tracking to generations table
-- This allows Sirpi Assistant to retrieve memory even after workflow completes

ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS agentcore_memory_id TEXT,
ADD COLUMN IF NOT EXISTS agentcore_memory_arn TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_generations_memory_id 
ON generations(agentcore_memory_id);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'generations' 
  AND column_name IN ('agentcore_memory_id', 'agentcore_memory_arn');
