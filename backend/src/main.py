from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from src.core.config import settings
from src.api import (
    health,
    workflows,
    github,
    clerk_webhooks,
    projects,
    pull_requests,
    github_webhooks,
    deployments,
    aws,
    sirpi_assistant,
)
from src.utils.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting Sirpi API - Environment: {settings.environment}")
    yield
    logger.info("Shutting down Sirpi API")


app = FastAPI(
    title="Sirpi AWS DevPost API",
    description="AI-Native DevOps Automation Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_v1_prefix, tags=["Health"])
app.include_router(workflows.router, prefix=settings.api_v1_prefix, tags=["Workflows"])
app.include_router(github.router, prefix=settings.api_v1_prefix, tags=["GitHub"])
app.include_router(clerk_webhooks.router, prefix=settings.api_v1_prefix, tags=["Webhooks"])
app.include_router(projects.router, prefix=settings.api_v1_prefix, tags=["Projects"])
app.include_router(pull_requests.router, prefix=settings.api_v1_prefix, tags=["Pull Requests"])
app.include_router(github_webhooks.router, prefix=settings.api_v1_prefix, tags=["GitHub Webhooks"])
app.include_router(deployments.router, prefix=settings.api_v1_prefix, tags=["Deployments"])
app.include_router(aws.router, prefix=settings.api_v1_prefix, tags=["AWS Setup"])
app.include_router(sirpi_assistant.router, prefix=settings.api_v1_prefix, tags=["AI Assistant"])


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {type(exc).__name__}", exc_info=True)

    if settings.environment == "development":
        return JSONResponse(
            status_code=500, content={"error": "Internal server error", "detail": str(exc)}
        )

    return JSONResponse(status_code=500, content={"error": "Internal server error"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
        log_level=settings.log_level.lower(),
    )
