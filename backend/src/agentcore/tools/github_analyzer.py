"""
GitHub repository analyzer tool.
Fetches and analyzes repository structure and key files.
"""

import logging
from typing import Dict, List, Optional, Tuple
from src.services.github_app import GitHubAppService, GitHubAppError
from src.agentcore.models import RawRepositoryData

logger = logging.getLogger(__name__)


class GitHubAnalyzer:
    """
    Tool to fetch and analyze GitHub repositories.
    Pure Python tool - NOT a Bedrock agent.
    """
    
    PACKAGE_FILES = {
        'javascript': ['package.json', 'package-lock.json', 'yarn.lock'],
        'typescript': ['package.json', 'tsconfig.json'],
        'python': ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
        'go': ['go.mod', 'go.sum'],
        'java': ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        'ruby': ['Gemfile', 'Gemfile.lock'],
        'php': ['composer.json', 'composer.lock']
    }
    
    CONFIG_FILES = [
        'Dockerfile',
        'docker-compose.yml',
        '.env.example',
        'README.md'
    ]
    
    def __init__(self, github_service: GitHubAppService):
        self.github = github_service
    
    async def analyze_repository(
        self,
        installation_id: int,
        owner: str,
        repo: str
    ) -> RawRepositoryData:
        """
        Fetch and analyze repository structure.
        
        Returns:
            RawRepositoryData with file tree and key file contents
        """
        logger.info(f"Analyzing repository: {owner}/{repo}")
        
        try:
            file_tree = await self.github.get_repository_contents(
                installation_id, owner, repo, path=""
            )
            
            detected_language = self._detect_language_from_tree(file_tree)
            logger.info(f"Detected language: {detected_language}")
            
            package_files = await self._fetch_package_files(
                installation_id, owner, repo, detected_language
            )
            
            config_files = await self._fetch_config_files(
                installation_id, owner, repo
            )
            
            return RawRepositoryData(
                owner=owner,
                repo=repo,
                files=file_tree,
                package_files=package_files,
                config_files=config_files,
                detected_language=detected_language
            )
            
        except GitHubAppError as e:
            logger.error(f"GitHub API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Repository analysis failed: {e}", exc_info=True)
            raise
    
    def _detect_language_from_tree(self, file_tree: List[Dict]) -> Optional[str]:
        """Detect primary language from file extensions."""
        
        extension_counts = {}
        
        language_extensions = {
            'python': ['.py'],
            'javascript': ['.js', '.jsx'],
            'typescript': ['.ts', '.tsx'],
            'go': ['.go'],
            'java': ['.java'],
            'ruby': ['.rb'],
            'php': ['.php']
        }
        
        for file in file_tree:
            if file.get('type') != 'file':
                continue
            
            name = file.get('name', '')
            
            for lang, extensions in language_extensions.items():
                if any(name.endswith(ext) for ext in extensions):
                    extension_counts[lang] = extension_counts.get(lang, 0) + 1
        
        if not extension_counts:
            return None
        
        return max(extension_counts, key=extension_counts.get)
    
    async def _fetch_package_files(
        self,
        installation_id: int,
        owner: str,
        repo: str,
        detected_language: Optional[str]
    ) -> Dict[str, str]:
        """Fetch package manager files based on detected language."""
        
        package_files = {}
        
        if not detected_language:
            return package_files
        
        files_to_fetch = self.PACKAGE_FILES.get(detected_language, [])
        
        if detected_language in ['javascript', 'typescript']:
            files_to_fetch.extend(self.PACKAGE_FILES.get('javascript', []))
        
        for filename in files_to_fetch:
            try:
                content = await self.github.read_file(
                    installation_id, owner, repo, filename
                )
                package_files[filename] = content
                logger.info(f"Fetched: {filename}")
            except GitHubAppError:
                pass
        
        return package_files
    
    async def _fetch_config_files(
        self,
        installation_id: int,
        owner: str,
        repo: str
    ) -> Dict[str, str]:
        """Fetch common configuration files."""
        
        config_files = {}
        
        for filename in self.CONFIG_FILES:
            try:
                content = await self.github.read_file(
                    installation_id, owner, repo, filename
                )
                config_files[filename] = content
                logger.info(f"Fetched config: {filename}")
            except GitHubAppError:
                pass
        
        return config_files


def parse_github_url(url: str) -> Tuple[str, str]:
    """
    Parse GitHub URL to extract owner and repo.
    
    Examples:
        https://github.com/owner/repo -> (owner, repo)
        https://github.com/owner/repo.git -> (owner, repo)
    """
    url = url.rstrip('/')
    if url.endswith('.git'):
        url = url[:-4]
    
    parts = url.split('/')
    owner = parts[-2]
    repo = parts[-1]
    
    return owner, repo
