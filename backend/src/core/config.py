"""
Core configuration for Sirpi AWS DevPost application.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    environment: str = "development"
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"

    # Clerk Authentication
    clerk_secret_key: str
    clerk_webhook_secret: str

    # Supabase Database
    supabase_user: str
    supabase_password: str
    supabase_host: str
    supabase_port: int = 6543
    supabase_dbname: str = "postgres"

    # AWS Configuration
    aws_region: str = "us-west-2"
    aws_account_id: str
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    # Bedrock Models
    bedrock_model_id: str
    bedrock_agent_foundation_model: str
    
    # Sirpi AI Assistant (separate model for chat assistance)
    sirpi_assistant_model_id: str = "us.amazon.nova-pro-v1:0"
    sirpi_assistant_region: str = "us-east-1"  # Nova Pro available in us-east-1

    # AgentCore Agent IDs
    agentcore_orchestrator_agent_id: str | None = None
    agentcore_context_analyzer_agent_id: str | None = None
    agentcore_dockerfile_generator_agent_id: str | None = None
    agentcore_terraform_generator_agent_id: str | None = None

    # Agent Alias IDs (optional, defaults to TSTALIASID)
    agentcore_context_analyzer_alias_id: str = "TSTALIASID"
    agentcore_dockerfile_generator_alias_id: str = "TSTALIASID"
    agentcore_terraform_generator_alias_id: str = "TSTALIASID"

    # DynamoDB Tables
    dynamodb_sessions_table: str = "sirpi-sessions"
    dynamodb_logs_table: str = "sirpi-logs"

    # S3 Storage
    s3_bucket_name: str = "sirpi-generated-files"
    s3_region: str = "us-west-2"
    s3_terraform_state_bucket: str = "sirpi-terraform-states"
    
    # Terraform State Management
    dynamodb_terraform_lock_table: str = "sirpi-terraform-locks"

    # GitHub App Configuration
    github_app_id: str
    github_app_client_id: str
    github_app_client_secret: str
    github_app_private_key_path: str = "./github-app-private-key.pem"
    github_app_webhook_secret: str
    github_app_name: str = "raj-sirpi"
    github_webhook_secret: str | None = None

    # GitHub URLs
    github_base_url: str = "https://github.com"
    github_api_base_url: str = "https://api.github.com"

    # CloudFormation Template URL
    cloudformation_template_url: str = (
        "https://sirpi-generated-files.s3.us-west-2.amazonaws.com/cloudformation/sirpi-setup.yaml"
    )
    
    # E2B API Key for sandbox execution
    e2b_api_key: str

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def database_url(self) -> str:
        """Build database connection string for SQLAlchemy."""
        return (
            f"postgresql+psycopg2://{self.supabase_user}:{self.supabase_password}"
            f"@{self.supabase_host}:{self.supabase_port}/{self.supabase_dbname}"
        )


settings = Settings()
