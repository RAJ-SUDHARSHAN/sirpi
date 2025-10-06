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

    clerk_secret_key: str
    clerk_webhook_secret: str

    supabase_user: str
    supabase_password: str
    supabase_host: str
    supabase_port: int = 6543
    supabase_dbname: str = "postgres"

    aws_region: str = "us-west-2"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None

    bedrock_model_id: str
    bedrock_agent_foundation_model: str

    agentcore_orchestrator_agent_id: str | None = None
    agentcore_context_analyzer_agent_id: str | None = None
    agentcore_dockerfile_generator_agent_id: str | None = None
    agentcore_terraform_generator_agent_id: str | None = None

    dynamodb_sessions_table: str = "sirpi-sessions"
    dynamodb_logs_table: str = "sirpi-logs"

    s3_bucket_name: str = "sirpi-generated-files"
    s3_region: str = "us-west-2"
    s3_terraform_state_bucket: str = "sirpi-terraform-states"
    dynamodb_terraform_lock_table: str = "sirpi-terraform-locks"

    github_app_id: str
    github_app_client_id: str
    github_app_client_secret: str
    github_app_private_key_path: str = "./github-app-private-key.pem"
    github_app_webhook_secret: str
    github_app_name: str = "raj-sirpi"

    # GitHub URLs
    github_base_url: str = "https://github.com"
    github_api_base_url: str = "https://api.github.com"

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
