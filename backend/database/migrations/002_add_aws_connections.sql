-- =====================================================
-- MIGRATION: AWS Account Connections
-- Secure IAM role-based AWS account linking
-- =====================================================

CREATE TABLE IF NOT EXISTS aws_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    role_arn TEXT,
    external_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, connected, disconnected, error
    connected_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aws_connections_user_id ON aws_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_aws_connections_status ON aws_connections(status);

-- Enable RLS
ALTER TABLE aws_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aws_connections_select_own ON aws_connections;
DROP POLICY IF EXISTS aws_connections_insert_own ON aws_connections;
DROP POLICY IF EXISTS aws_connections_update_own ON aws_connections;
DROP POLICY IF EXISTS aws_connections_delete_own ON aws_connections;

CREATE POLICY aws_connections_select_own ON aws_connections
    FOR SELECT USING (user_id = requesting_user_id());

CREATE POLICY aws_connections_insert_own ON aws_connections
    FOR INSERT WITH CHECK (user_id = requesting_user_id());

CREATE POLICY aws_connections_update_own ON aws_connections
    FOR UPDATE USING (user_id = requesting_user_id());

CREATE POLICY aws_connections_delete_own ON aws_connections
    FOR DELETE USING (user_id = requesting_user_id());

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_aws_connections_updated_at ON aws_connections;
CREATE TRIGGER update_aws_connections_updated_at BEFORE UPDATE ON aws_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add AWS connection reference to projects
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS aws_connection_id UUID REFERENCES aws_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_aws_connection ON projects(aws_connection_id);

COMMENT ON TABLE aws_connections IS 'Stores IAM role information for secure AWS account access';
COMMENT ON COLUMN aws_connections.role_arn IS 'IAM Role ARN that Sirpi assumes to access user AWS account';
COMMENT ON COLUMN aws_connections.external_id IS 'Cryptographic external ID for secure role assumption';
