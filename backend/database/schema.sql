-- =====================================================
-- SETUP: UUID Extension & Helper Functions
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extract Clerk user ID from JWT (for RLS policies)
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS TEXT AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text;
$$ LANGUAGE SQL STABLE;

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TABLES
-- =====================================================

-- Users (synced from Clerk via webhook)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub App Installations
CREATE TABLE IF NOT EXISTS github_installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    installation_id BIGINT UNIQUE NOT NULL,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL,
    account_avatar_url TEXT,
    repositories JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects (imported GitHub repositories)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    repository_url TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    github_repo_id BIGINT,
    installation_id BIGINT,
    language TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    generation_count INTEGER DEFAULT 0,
    last_generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, slug)
);

-- Infrastructure Generations (AgentCore workflow results)
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    session_id TEXT UNIQUE NOT NULL,
    repository_url TEXT NOT NULL,
    template_type TEXT NOT NULL,
    status TEXT NOT NULL,
    files JSONB DEFAULT '[]'::jsonb,
    project_context JSONB DEFAULT '{}'::jsonb,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_installations_user_id ON github_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_installations_installation_id ON github_installations(installation_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_session_id ON generations(session_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_insert_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;

CREATE POLICY users_select_own ON users
    FOR SELECT USING (clerk_user_id = requesting_user_id());
CREATE POLICY users_insert_own ON users
    FOR INSERT WITH CHECK (clerk_user_id = requesting_user_id());
CREATE POLICY users_update_own ON users
    FOR UPDATE USING (clerk_user_id = requesting_user_id());

-- GitHub installations policies
DROP POLICY IF EXISTS installations_select_own ON github_installations;
DROP POLICY IF EXISTS installations_insert_own ON github_installations;
DROP POLICY IF EXISTS installations_update_own ON github_installations;

CREATE POLICY installations_select_own ON github_installations
    FOR SELECT USING (user_id = requesting_user_id());
CREATE POLICY installations_insert_own ON github_installations
    FOR INSERT WITH CHECK (user_id = requesting_user_id());
CREATE POLICY installations_update_own ON github_installations
    FOR UPDATE USING (user_id = requesting_user_id());

-- Projects policies
DROP POLICY IF EXISTS projects_select_own ON projects;
DROP POLICY IF EXISTS projects_insert_own ON projects;
DROP POLICY IF EXISTS projects_update_own ON projects;
DROP POLICY IF EXISTS projects_delete_own ON projects;

CREATE POLICY projects_select_own ON projects
    FOR SELECT USING (user_id = requesting_user_id());
CREATE POLICY projects_insert_own ON projects
    FOR INSERT WITH CHECK (user_id = requesting_user_id());
CREATE POLICY projects_update_own ON projects
    FOR UPDATE USING (user_id = requesting_user_id());
CREATE POLICY projects_delete_own ON projects
    FOR DELETE USING (user_id = requesting_user_id());

-- Generations policies
DROP POLICY IF EXISTS generations_select_own ON generations;
DROP POLICY IF EXISTS generations_insert_own ON generations;
DROP POLICY IF EXISTS generations_update_own ON generations;

CREATE POLICY generations_select_own ON generations
    FOR SELECT USING (user_id = requesting_user_id());
CREATE POLICY generations_insert_own ON generations
    FOR INSERT WITH CHECK (user_id = requesting_user_id());
CREATE POLICY generations_update_own ON generations
    FOR UPDATE USING (user_id = requesting_user_id());

-- =====================================================
-- TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_installations_updated_at ON github_installations;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_generations_updated_at ON generations;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_installations_updated_at BEFORE UPDATE ON github_installations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generations_updated_at BEFORE UPDATE ON generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();