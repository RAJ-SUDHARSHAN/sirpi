"""
Supabase database service - Production ready.
Uses Transaction Pooler (Port 6543) optimized for AWS Lambda.
"""

import logging
from contextlib import contextmanager
from typing import Optional, Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from src.core.config import settings

logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Base exception for database operations."""

    pass


class SupabaseService:
    """
    Supabase database service using Transaction Pooler.

    Production-ready configuration for AWS Lambda:
    - Uses Transaction Pooler (Port 6543)
    - Optimized connection settings for serverless
    - Automatic connection cleanup
    - Health check support
    """

    def __init__(self):
        """Initialize Supabase service with Transaction Pooler."""
        self._engine = None
        self._session_factory = None

    @property
    def engine(self):
        """Get or create SQLAlchemy engine."""
        if self._engine is None:
            # Lambda-optimized configuration
            self._engine = create_engine(
                settings.database_url,
                poolclass=NullPool,
                pool_pre_ping=True,
                echo=False,  # Never echo in production
                connect_args={"connect_timeout": 10, "options": "-c statement_timeout=30000"},
            )

        return self._engine

    @property
    def session_factory(self):
        """Get or create session factory."""
        if self._session_factory is None:
            self._session_factory = sessionmaker(bind=self.engine)
        return self._session_factory

    @contextmanager
    def get_session(self) -> Session:
        """
        Get a database session with automatic commit/rollback.

        Usage:
            with supabase.get_session() as session:
                result = session.execute(text("SELECT * FROM users"))
        """
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {type(e).__name__}", exc_info=True)
            raise DatabaseError("Database operation failed")
        finally:
            session.close()

    @contextmanager
    def get_connection(self):
        """
        Get a raw psycopg2 connection with automatic cleanup.

        Usage:
            with supabase.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM users")
                    results = cur.fetchall()
        """
        try:
            conn = psycopg2.connect(
                user=settings.supabase_user,
                password=settings.supabase_password,
                host=settings.supabase_host,
                port=settings.supabase_port,
                dbname=settings.supabase_dbname,
                cursor_factory=RealDictCursor,
                connect_timeout=10,
            )
        except psycopg2.OperationalError as e:
            logger.error(f"Database connection failed: {type(e).__name__}")
            raise DatabaseError("Unable to connect to database")

        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database connection error: {type(e).__name__}", exc_info=True)
            raise DatabaseError("Database operation failed")
        finally:
            conn.close()

    async def health_check(self) -> Dict[str, Any]:
        """
        Check database connectivity and return status.

        Returns:
            Dict with status and latency
        """
        import time

        start = time.time()

        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()

                    latency_ms = (time.time() - start) * 1000

                    return {"status": "healthy", "latency_ms": round(latency_ms, 2)}
        except Exception as e:
            logger.error(f"Database health check failed: {type(e).__name__}")
            return {"status": "unhealthy", "error": "Connection failed"}

    def save_generation(
        self,
        user_id: str,
        session_id: str,
        repository_url: str,
        template_type: str,
        status: str,
        files: Optional[List[Dict[str, Any]]] = None,
        project_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Save a new generation record to database."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO generations 
                        (user_id, session_id, repository_url, template_type, status, 
                         files, project_context, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        RETURNING id, created_at
                    """,
                        (
                            user_id,
                            session_id,
                            repository_url,
                            template_type,
                            status,
                            Json(files or []),
                            Json(project_context or {}),
                        ),
                    )

                    result = cur.fetchone()
                    return result
        except Exception as e:
            logger.error(f"Failed to save generation: {type(e).__name__}")
            raise DatabaseError("Failed to save generation")

    def update_generation_status(
        self,
        session_id: str,
        status: str,
        files: Optional[List[Dict[str, Any]]] = None,
        s3_keys: Optional[List[str]] = None,
        project_context: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> bool:
        """Update generation status, s3_keys, and optionally add files or context."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    update_fields = ["status = %s", "updated_at = NOW()"]
                    params = [status]
                    
                    if s3_keys is not None:
                        update_fields.append("s3_keys = %s")
                        params.append(Json(s3_keys))
                    
                    if files is not None:
                        update_fields.append("files = %s")
                        params.append(Json(files))
                    
                    if project_context is not None:
                        update_fields.append("project_context = %s")
                        params.append(Json(project_context))
                    
                    if error is not None:
                        update_fields.append("error = %s")
                        params.append(error)
                    
                    params.append(session_id)
                    
                    query = f"""
                        UPDATE generations
                        SET {', '.join(update_fields)}
                        WHERE session_id = %s
                        RETURNING id
                    """
                    
                    cur.execute(query, params)

                    result = cur.fetchone()
                    if result:
                        return True
                    return False
        except Exception as e:
            logger.error(f"Failed to update generation: {type(e).__name__}")
            raise DatabaseError("Failed to update generation")

    def get_generation(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a generation by session_id."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT * FROM generations
                        WHERE session_id = %s
                    """,
                        (session_id,),
                    )

                    return cur.fetchone()
        except Exception as e:
            logger.error(f"Failed to get generation: {type(e).__name__}")
            raise DatabaseError("Failed to retrieve generation")

    def get_user_generations(
        self, user_id: str, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get all generations for a user (paginated)."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id, session_id, repository_url, template_type, 
                               status, created_at, updated_at
                        FROM generations
                        WHERE user_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s
                    """,
                        (user_id, limit, offset),
                    )

                    return cur.fetchall()
        except Exception as e:
            logger.error(f"Failed to get user generations: {type(e).__name__}")
            raise DatabaseError("Failed to retrieve generations")

    def save_user_profile(
        self,
        clerk_user_id: str,
        email: str,
        name: Optional[str] = None,
        avatar_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Save or update user profile."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO users (clerk_user_id, email, name, avatar_url, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, NOW(), NOW())
                        ON CONFLICT (clerk_user_id) 
                        DO UPDATE SET 
                            email = EXCLUDED.email,
                            name = EXCLUDED.name,
                            avatar_url = EXCLUDED.avatar_url,
                            updated_at = NOW()
                        RETURNING id, created_at
                    """,
                        (clerk_user_id, email, name, avatar_url),
                    )

                    result = cur.fetchone()
                    return result
        except Exception as e:
            logger.error(f"Failed to save user profile: {type(e).__name__}")
            raise DatabaseError("Failed to save user profile")

    def get_user_by_clerk_id(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by Clerk user ID."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT * FROM users
                        WHERE clerk_user_id = %s
                    """,
                        (clerk_user_id,),
                    )

                    return cur.fetchone()
        except Exception as e:
            logger.error(f"Failed to get user: {type(e).__name__}")
            raise DatabaseError("Failed to retrieve user")

    def save_github_installation(
        self,
        user_id: str,
        installation_id: int,
        account_login: str,
        account_type: str,
        account_avatar_url: Optional[str] = None,
        repositories: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Save or update GitHub App installation."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO github_installations 
                        (user_id, installation_id, account_login, account_type, account_avatar_url, repositories)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (installation_id)
                        DO UPDATE SET
                            user_id = EXCLUDED.user_id,
                            account_login = EXCLUDED.account_login,
                            account_type = EXCLUDED.account_type,
                            account_avatar_url = EXCLUDED.account_avatar_url,
                            repositories = EXCLUDED.repositories,
                            is_active = true,
                            updated_at = NOW()
                        RETURNING id, created_at
                    """,
                        (
                            user_id,
                            installation_id,
                            account_login,
                            account_type,
                            account_avatar_url,
                            Json(repositories or []),
                        ),
                    )

                    result = cur.fetchone()
                    return result
        except Exception as e:
            logger.error(f"Failed to save installation: {type(e).__name__}")
            raise DatabaseError("Failed to save GitHub installation")

    def get_user_installation(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's GitHub App installation."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT * FROM github_installations
                        WHERE user_id = %s AND is_active = true
                        ORDER BY created_at DESC
                        LIMIT 1
                    """,
                        (user_id,),
                    )

                    return cur.fetchone()
        except Exception as e:
            logger.error(f"Failed to get installation: {type(e).__name__}")
            raise DatabaseError("Failed to retrieve installation")

    def deactivate_installation(self, installation_id: int) -> bool:
        """Mark installation as inactive."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE github_installations
                        SET is_active = false, updated_at = NOW()
                        WHERE installation_id = %s
                        RETURNING id
                    """,
                        (installation_id,),
                    )

                    result = cur.fetchone()
                    if result:
                        return True
                    return False
        except Exception as e:
            logger.error(f"Failed to deactivate installation: {type(e).__name__}")
            raise DatabaseError("Failed to deactivate installation")


# Global singleton instance
supabase = SupabaseService()
