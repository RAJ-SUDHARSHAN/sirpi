"""
Dockerfile Generator Agent - Generates production-ready Dockerfiles.
"""

import logging
from typing import Dict, Any, Optional, Callable

from src.agentcore.agents.base import BaseBedrockAgent
from src.agentcore.models import RepositoryContext
from src.core.config import settings

logger = logging.getLogger(__name__)


class DockerfileGeneratorAgent(BaseBedrockAgent):
    """
    Bedrock agent that generates production-optimized Dockerfiles.
    """

    def __init__(self):
        super().__init__(
            agent_id=settings.agentcore_dockerfile_generator_agent_id,
            agent_alias_id=settings.agentcore_dockerfile_generator_alias_id,
            agent_name="Dockerfile Generator",
        )

    async def invoke(
        self, input_data: Dict[str, Any], thinking_callback: Optional[Callable] = None
    ) -> str:
        """
        Generate Dockerfile based on repository context.

        Args:
            input_data: {
                'session_id': str,
                'context': RepositoryContext
            }

        Returns:
            Dockerfile content as string
        """
        session_id = input_data["session_id"]
        context: RepositoryContext = input_data["context"]
        
        # If existing production-quality Dockerfile exists, return it as-is
        if context.has_existing_dockerfile and context.existing_dockerfile_content:
            dockerfile_content = context.existing_dockerfile_content
            
            # For production repos with existing Dockerfiles, use them as-is
            # Only generate/enhance if Dockerfile is clearly incomplete or broken
            is_complete = (
                "FROM" in dockerfile_content and  # Has base image
                len(dockerfile_content.strip().split("\n")) > 5  # More than 5 lines (not a stub)
            )
            
            # If Dockerfile looks complete, use it unchanged (skip agent call)
            if is_complete:
                logger.info(f"Existing Dockerfile appears complete ({len(dockerfile_content)} chars) - using as-is (no agent call)")
                return dockerfile_content  # Return directly, no cleaning needed

        # Otherwise, call agent to enhance or generate
        prompt = self._build_dockerfile_prompt(context)

        dockerfile_content = await self._call_bedrock_agent(
            session_id=session_id, prompt=prompt, thinking_callback=thinking_callback
        )

        dockerfile_content = self._clean_dockerfile(dockerfile_content)

        return dockerfile_content

    def _build_dockerfile_prompt(self, context: RepositoryContext) -> str:
        """Build context-aware Dockerfile prompt (enhance existing or create new)."""
        
        # Critical requirements that apply to ALL Dockerfiles
        CRITICAL_REQUIREMENTS = """🚨 CRITICAL REQUIREMENTS (NON-NEGOTIABLE):

1. NO PLACEHOLDERS OR TODOS
   ❌ PLACEHOLDER, TODO, FIXME, XXX, CHANGEME
   ✅ All values must be real or use ARG/ENV variables

2. NO HARDCODED VALUES (use ARG/ENV)
   ❌ EXPOSE 3000
   ✅ ARG PORT=3000
       EXPOSE $PORT

3. SECURITY REQUIREMENTS
   ✅ Must create and use non-root user
   ✅ No secrets, API keys, or credentials
   ✅ Use specific version tags (NOT :latest)

4. PRODUCTION-READY
   ✅ Multi-stage build (builder + runner)
   ✅ Only production dependencies in final image
   ✅ Proper layer caching (COPY package files first)
   ✅ HEALTHCHECK instruction included

5. MUST WORK WITHOUT MODIFICATION
   ✅ Complete, runnable Dockerfile
   ✅ All dependencies installable
   ✅ No manual edits needed

VERIFY: Your Dockerfile must pass 'docker build' successfully.
"""

        # Package manager and framework-specific instructions
        package_manager_instructions = self._get_package_manager_instructions(context)
        framework_instructions = self._get_framework_specific_instructions(context)

        # Check if existing Dockerfile was found (only gets here if it needs enhancement)
        if context.has_existing_dockerfile and context.existing_dockerfile_content:
            return f"""EXISTING DOCKERFILE DETECTED

Repository already contains a Dockerfile. Your task is to ANALYZE and ENHANCE it.

{CRITICAL_REQUIREMENTS}

EXISTING DOCKERFILE:
```dockerfile
{context.existing_dockerfile_content}
```

Project Context:
- Language: {context.language}
- Framework: {context.framework or "none"}
- Runtime: {context.runtime}
- Package Manager: {context.package_manager}
- Start Command: {context.start_command or "auto-detect"}
- Build Command: {context.build_command or "none"}
- Ports: {context.ports}
- Deployment: {context.deployment_target}

{package_manager_instructions}

{framework_instructions}

YOUR TASK - Enhance the existing Dockerfile:
1. **Keep what works** - Don't change working configurations unnecessarily
2. **Security improvements**:
   - Add non-root user if missing
   - Remove any hardcoded secrets or credentials
   - Use specific version tags (not :latest)
3. **Production optimizations**:
   - Add multi-stage build if missing
   - Improve layer caching
   - Reduce image size
4. **Configurable values**:
   - Replace hardcoded ports with ARG/ENV variables
   - Replace hardcoded versions with ARGs
   - Externalize any configuration values
5. **Add missing essentials**:
   - HEALTHCHECK if missing
   - Proper labels for metadata
   - WORKDIR if not set
6. **Fix any issues**:
   - Incorrect base image versions
   - Missing dependencies
   - Security vulnerabilities

CRITICAL RULES:
- NO hardcoded secrets, API keys, or credentials
- Use ARG for build-time configuration (ports, versions, etc.)
- Use ENV for runtime configuration
- Add comments explaining changes/improvements
- Keep the overall structure similar to the original
- Follow framework-specific best practices above

IMPORTANT: Generate ONLY the enhanced Dockerfile content.
- Start IMMEDIATELY with FROM or ARG instruction
- NO explanations, NO markdown formatting, NO preamble
- First line must be: FROM <image> or ARG <variable>
"""
        else:
            return f"""Generate a production-ready Dockerfile for this application.

{CRITICAL_REQUIREMENTS}

NO EXISTING DOCKERFILE FOUND - Creating from scratch.

Project Context:
- Language: {context.language}
- Framework: {context.framework or "none"}
- Runtime: {context.runtime}
- Package Manager: {context.package_manager}
- Start Command: {context.start_command or "auto-detect"}
- Build Command: {context.build_command or "none"}
- Ports: {context.ports}
- Deployment: {context.deployment_target}
- Health Check: {context.health_check_path or "use root path /"}

{package_manager_instructions}

{framework_instructions}

Requirements:
1. Use multi-stage build for smaller image size
2. Use official base image (e.g., python:3.12-slim, node:20-alpine)
3. Create non-root user for security
4. Implement proper layer caching (copy package files first)
5. Install only production dependencies in final stage
6. Set WORKDIR appropriately
7. Use ARGs for configurable values (ports, versions, etc.)
8. Use ENV for runtime configuration
9. Expose ports: {context.ports}
10. Add HEALTHCHECK instruction
    - Use wget or curl (install if needed on Alpine)
    - Test the root path / or health endpoint if known
11. Use {context.start_command or "appropriate CMD for " + context.language}
12. Add labels for metadata

CRITICAL RULES:
- NO hardcoded secrets, API keys, or credentials
- Use ARG for build-time configuration
- Use ENV for runtime configuration
- Add comments for clarity
- Follow framework-specific best practices above

IMPORTANT: Generate ONLY the Dockerfile content.
- Start IMMEDIATELY with FROM or ARG instruction  
- NO explanations, NO markdown formatting, NO preamble
- First line must be: FROM <image> or ARG <variable>
"""

    def _get_package_manager_instructions(self, context: RepositoryContext) -> str:
        """Get package manager specific instructions."""
        pm = context.package_manager.lower()
        
        if pm == "yarn":
            return """
PACKAGE MANAGER: YARN (CRITICAL)
- Repository uses yarn.lock, NOT package-lock.json
- Install: RUN yarn install --frozen-lockfile (NOT npm ci)
- Production install: RUN yarn install --frozen-lockfile --production
- Build: RUN yarn build (NOT npm run build)
- Start: CMD ["yarn", "start"] (NOT npm start)
- NEVER use npm commands - this repo uses yarn!
"""
        elif pm == "pnpm":
            return """
PACKAGE MANAGER: PNPM (CRITICAL)
- Repository uses pnpm-lock.yaml
- Install: RUN pnpm install --frozen-lockfile
- Production install: RUN pnpm install --frozen-lockfile --prod
- Build: RUN pnpm build
- Start: CMD ["pnpm", "start"]
"""
        elif pm == "npm":
            return """
PACKAGE MANAGER: NPM
- Repository uses package-lock.json
- Install: RUN npm ci
- Production install: RUN npm ci --omit=dev
- Build: RUN npm run build
- Start: CMD ["npm", "start"]
"""
        else:
            # For other package managers (pip, etc.), no special Node.js instructions
            return ""

    def _get_framework_specific_instructions(self, context: RepositoryContext) -> str:
        """Get framework-specific Dockerfile instructions."""
        framework = (context.framework or "").lower()

        if "next" in framework or "nextjs" in framework:
            return """
NEXT.JS SPECIFIC REQUIREMENTS (CRITICAL):
- Enable standalone output mode by ensuring next.config.js/ts has: output: 'standalone'
- In builder stage: Run 'npm run build' which creates .next/standalone directory
- In runner stage: Copy ONLY these files:
  * COPY --from=builder /app/.next/standalone ./
  * COPY --from=builder /app/.next/static ./.next/static
  * COPY --from=builder /app/public ./public
- DO NOT copy node_modules separately (standalone includes minimal deps)
- Use CMD ["node", "server.js"] (standalone creates this file)
- Set ENV variables: NODE_ENV=production, HOSTNAME="0.0.0.0"
- Health check: wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
- Install wget in Alpine: RUN apk add --no-cache wget
"""
        elif framework in ["react", "vue", "angular", "svelte"]:
            return """
STATIC SITE / SPA REQUIREMENTS:
- Use nginx:alpine for serving static files
- Build stage: Run build command (npm run build)
- Copy build output to /usr/share/nginx/html
- Add custom nginx.conf for SPA routing (try_files $uri /index.html)
- Health check: wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
"""
        elif framework in ["express", "fastify", "koa"]:
            return """
NODE.JS API REQUIREMENTS:
- Use node:20-alpine
- Install only production dependencies in runner: npm ci --omit=dev
- No build step needed (unless TypeScript)
- Health check: wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1
"""
        elif framework in ["flask", "django", "fastapi"]:
            return """
PYTHON WEB FRAMEWORK REQUIREMENTS:
- Use python:3.12-slim
- Install dependencies from requirements.txt
- For Django: Run collectstatic in build stage
- For production: Use gunicorn or uvicorn (not dev server)
- Health check: wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1
"""
        else:
            return ""

    def _clean_dockerfile(self, content: str) -> str:
        """Remove markdown code blocks and extract Dockerfile content properly."""
        # Remove XML tags
        content = content.replace("<thinking>", "").replace("</thinking>", "")
        content = content.replace("<answer>", "").replace("</answer>", "")
        
        # Extract from markdown code blocks
        if "```dockerfile" in content:
            start = content.find("```dockerfile") + 13
            end = content.find("```", start)
            if end > start:
                content = content[start:end].strip()
        elif "```" in content:
            start = content.find("```") + 3
            end = content.find("```", start)
            if end > start:
                content = content[start:end].strip()
        
        # Find the actual FROM instruction (Dockerfile MUST start with FROM or ARG)
        lines = content.split("\n")
        from_index = -1
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith("FROM") or stripped.startswith("ARG"):
                from_index = i
                break
        
        # If we found FROM/ARG, extract from there onward
        if from_index >= 0:
            content = "\n".join(lines[from_index:])
        
        return content.strip()
