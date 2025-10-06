from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import logging
import uuid

from src.services.supabase import supabase, DatabaseError
from src.services.github_app import get_github_app, GitHubAppError
from src.utils.clerk_auth import get_current_user_id

router = APIRouter()
logger = logging.getLogger(__name__)


class ImportRepositoryRequest(BaseModel):
    full_name: str
    installation_id: int


@router.post("/projects/import")
async def import_repository(
    request: ImportRepositoryRequest, user_id: str = Depends(get_current_user_id)
):
    try:
        parts = request.full_name.split("/")
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid repository name format")

        owner, repo_name = parts

        github = get_github_app()

        try:
            repos = await github.get_installation_repositories(request.installation_id)
        except GitHubAppError:
            raise HTTPException(status_code=502, detail="GitHub API error")

        repo_data = next((r for r in repos if r["full_name"] == request.full_name), None)

        if not repo_data:
            raise HTTPException(status_code=404, detail="Repository not found in installation")

        project_id = str(uuid.uuid4())
        project_slug = repo_name.lower().replace("_", "-").replace(" ", "-")

        try:
            with supabase.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO projects
                        (id, user_id, name, slug, repository_url, repository_name,
                         github_repo_id, installation_id, language, description, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (user_id, slug) DO UPDATE SET
                            github_repo_id = EXCLUDED.github_repo_id,
                            installation_id = EXCLUDED.installation_id,
                            language = EXCLUDED.language,
                            description = EXCLUDED.description,
                            status = EXCLUDED.status,
                            updated_at = NOW()
                        RETURNING id, name, slug, status, created_at
                    """,
                        (
                            project_id,
                            user_id,
                            repo_name,
                            project_slug,
                            repo_data["html_url"],
                            request.full_name,
                            repo_data["id"],
                            request.installation_id,
                            repo_data.get("language"),
                            repo_data.get("description"),
                            "pending",
                        ),
                    )

                    result = cur.fetchone()

        except DatabaseError:
            raise HTTPException(status_code=500, detail="Failed to save project")

        return {
            "success": True,
            "project": {
                "id": result["id"],
                "name": result["name"],
                "slug": result["slug"],
                "status": result["status"],
                "created_at": result["created_at"].isoformat(),
                "repository_name": request.full_name,
                "language": repo_data.get("language"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Import error: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to import repository")


@router.get("/projects")
async def get_user_projects(user_id: str = Depends(get_current_user_id)):
    try:
        with supabase.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, slug, repository_url, repository_name,
                           language, description, status, created_at, updated_at
                    FROM projects
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                """,
                    (user_id,),
                )

                projects = cur.fetchall()

    except DatabaseError:
        raise HTTPException(status_code=500, detail="Failed to retrieve projects")

    return {
        "success": True,
        "count": len(projects),
        "projects": [
            {
                "id": p["id"],
                "name": p["name"],
                "slug": p["slug"],
                "repository_name": p["repository_name"],
                "language": p["language"],
                "description": p["description"],
                "status": p["status"],
                "created_at": p["created_at"].isoformat(),
                "framework_info": {
                    "framework": p["language"] or "other",
                    "display_name": p["language"] or "Other",
                },
                "deployment_info": {"url": None, "ip": None, "status": p["status"]},
            }
            for p in projects
        ],
    }


@router.get("/projects/{project_slug}")
async def get_project_detail(project_slug: str, user_id: str = Depends(get_current_user_id)):
    try:
        with supabase.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM projects
                    WHERE slug = %s AND user_id = %s
                """,
                    (project_slug, user_id),
                )

                project = cur.fetchone()

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        return {
            "success": True,
            "project": {
                "id": project["id"],
                "name": project["name"],
                "slug": project["slug"],
                "repository_name": project["repository_name"],
                "language": project["language"],
                "description": project["description"],
                "status": project["status"],
                "created_at": project["created_at"].isoformat(),
            },
        }

    except HTTPException:
        raise
    except DatabaseError:
        raise HTTPException(status_code=500, detail="Failed to retrieve project")
    except Exception as e:
        logger.error(f"Project detail error: {type(e).__name__}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")


@router.get("/projects/repositories")
async def get_imported_repositories(user_id: str = Depends(get_current_user_id)):
    try:
        with supabase.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, github_repo_id, repository_name, 
                           language, created_at, installation_id
                    FROM projects
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                """,
                    (user_id,),
                )

                projects = cur.fetchall()

    except DatabaseError:
        raise HTTPException(status_code=500, detail="Failed to retrieve repositories")

    return {
        "success": True,
        "repositories": [
            {
                "id": p["id"],
                "github_id": str(p["github_repo_id"]),
                "name": p["name"],
                "full_name": p["repository_name"],
                "language": p["language"],
                "user_id": user_id,
                "created_at": p["created_at"].isoformat(),
            }
            for p in projects
        ],
    }
