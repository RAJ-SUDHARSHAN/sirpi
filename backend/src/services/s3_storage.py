"""
S3 storage service for generated files and Terraform state management.
"""

import boto3
import logging
from typing import Dict, List, Optional
from botocore.exceptions import ClientError

from src.core.config import settings

logger = logging.getLogger(__name__)


class S3StorageError(Exception):
    """S3 storage operation error."""
    pass


class S3StorageService:
    """
    Manages S3 storage for:
    - Generated infrastructure files (Dockerfile, Terraform, etc.)
    - Terraform state files with versioning
    - Pre-signed download URLs
    """

    def __init__(self):
        self.s3_client = boto3.client('s3', region_name=settings.s3_region)
        self.generated_files_bucket = settings.s3_bucket_name
        self.terraform_state_bucket = settings.s3_terraform_state_bucket

    async def ensure_buckets_exist(self) -> None:
        """Create S3 buckets if they don't exist."""
        try:
            for bucket_name, versioning in [
                (self.generated_files_bucket, False),
                (self.terraform_state_bucket, True)
            ]:
                try:
                    self.s3_client.head_bucket(Bucket=bucket_name)
                except ClientError:
                    self.s3_client.create_bucket(
                        Bucket=bucket_name,
                        CreateBucketConfiguration={'LocationConstraint': settings.s3_region}
                    )
                    logger.info(f"Created S3 bucket: {bucket_name}")

                    if versioning:
                        self.s3_client.put_bucket_versioning(
                            Bucket=bucket_name,
                            VersioningConfiguration={'Status': 'Enabled'}
                        )
                        logger.info(f"Enabled versioning on: {bucket_name}")

        except ClientError as e:
            logger.error(f"Failed to setup S3 buckets: {e}")
            raise S3StorageError("S3 bucket setup failed")

    async def save_generated_files(
        self,
        session_id: str,
        files: List[Dict[str, str]]
    ) -> List[str]:
        """
        Save generated infrastructure files to S3.

        Args:
            session_id: Unique session identifier
            files: List of dicts with 'filename' and 'content'

        Returns:
            List of S3 keys for saved files
        """
        s3_keys = []

        try:
            for file in files:
                key = f"generations/{session_id}/{file['filename']}"

                self.s3_client.put_object(
                    Bucket=self.generated_files_bucket,
                    Key=key,
                    Body=file['content'].encode('utf-8'),
                    ContentType=self._get_content_type(file['filename']),
                    Metadata={
                        'session_id': session_id,
                        'file_type': file.get('type', 'unknown')
                    }
                )

                s3_keys.append(key)
                logger.info(f"Saved file to S3: {key}")

            return s3_keys

        except ClientError as e:
            logger.error(f"Failed to save files to S3: {e}")
            raise S3StorageError("File upload failed")

    async def get_download_urls(
        self,
        s3_keys: List[str],
        expires_in: int = 3600
    ) -> Dict[str, str]:
        """
        Generate pre-signed URLs for file downloads.

        Args:
            s3_keys: List of S3 object keys
            expires_in: URL expiration time in seconds (default: 1 hour)

        Returns:
            Dict mapping filename to download URL
        """
        urls = {}

        try:
            for key in s3_keys:
                url = self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': self.generated_files_bucket,
                        'Key': key
                    },
                    ExpiresIn=expires_in
                )

                filename = key.split('/')[-1]
                urls[filename] = url

            return urls

        except ClientError as e:
            logger.error(f"Failed to generate download URLs: {e}")
            raise S3StorageError("URL generation failed")

    async def save_terraform_state(
        self,
        project_id: str,
        state_content: str
    ) -> str:
        """
        Save Terraform state file with versioning.

        Args:
            project_id: Unique project identifier
            state_content: Terraform state JSON content

        Returns:
            S3 version ID
        """
        key = f"states/{project_id}/terraform.tfstate"

        try:
            response = self.s3_client.put_object(
                Bucket=self.terraform_state_bucket,
                Key=key,
                Body=state_content.encode('utf-8'),
                ContentType='application/json',
                Metadata={'project_id': project_id}
            )

            version_id = response.get('VersionId', 'null')
            logger.info(f"Saved Terraform state: {key} (version: {version_id})")

            return version_id

        except ClientError as e:
            logger.error(f"Failed to save Terraform state: {e}")
            raise S3StorageError("State save failed")

    async def get_terraform_state(
        self,
        project_id: str,
        version_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Retrieve Terraform state file.

        Args:
            project_id: Unique project identifier
            version_id: Specific version to retrieve (None = latest)

        Returns:
            Terraform state JSON content or None if not found
        """
        key = f"states/{project_id}/terraform.tfstate"

        try:
            params = {
                'Bucket': self.terraform_state_bucket,
                'Key': key
            }

            if version_id:
                params['VersionId'] = version_id

            response = self.s3_client.get_object(**params)
            content = response['Body'].read().decode('utf-8')

            return content

        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return None
            logger.error(f"Failed to retrieve Terraform state: {e}")
            raise S3StorageError("State retrieval failed")

    async def list_terraform_state_versions(
        self,
        project_id: str
    ) -> List[Dict[str, str]]:
        """
        List all versions of a Terraform state file.

        Args:
            project_id: Unique project identifier

        Returns:
            List of versions with metadata
        """
        key = f"states/{project_id}/terraform.tfstate"

        try:
            response = self.s3_client.list_object_versions(
                Bucket=self.terraform_state_bucket,
                Prefix=key
            )

            versions = []
            for version in response.get('Versions', []):
                versions.append({
                    'version_id': version['VersionId'],
                    'last_modified': version['LastModified'].isoformat(),
                    'size': version['Size'],
                    'is_latest': version['IsLatest']
                })

            return sorted(versions, key=lambda x: x['last_modified'], reverse=True)

        except ClientError as e:
            logger.error(f"Failed to list state versions: {e}")
            raise S3StorageError("Version listing failed")

    async def delete_old_state_versions(
        self,
        project_id: str,
        keep_count: int = 10
    ) -> int:
        """
        Delete old Terraform state versions, keeping only recent ones.

        Args:
            project_id: Unique project identifier
            keep_count: Number of recent versions to keep

        Returns:
            Number of versions deleted
        """
        versions = await self.list_terraform_state_versions(project_id)

        if len(versions) <= keep_count:
            return 0

        to_delete = versions[keep_count:]
        key = f"states/{project_id}/terraform.tfstate"
        deleted_count = 0

        try:
            for version in to_delete:
                self.s3_client.delete_object(
                    Bucket=self.terraform_state_bucket,
                    Key=key,
                    VersionId=version['version_id']
                )
                deleted_count += 1

            logger.info(f"Deleted {deleted_count} old state versions for project {project_id}")
            return deleted_count

        except ClientError as e:
            logger.error(f"Failed to delete old versions: {e}")
            raise S3StorageError("Version cleanup failed")

    def _get_content_type(self, filename: str) -> str:
        """Determine content type based on file extension."""
        if filename.endswith('.tf'):
            return 'text/plain'
        elif filename.endswith('.yaml') or filename.endswith('.yml'):
            return 'text/yaml'
        elif filename.endswith('.json'):
            return 'application/json'
        elif filename == 'Dockerfile':
            return 'text/plain'
        elif filename.endswith('.sh'):
            return 'text/x-shellscript'
        else:
            return 'text/plain'


_s3_storage_instance = None


def get_s3_storage() -> S3StorageService:
    """Get S3 storage service instance (lazy singleton)."""
    global _s3_storage_instance
    if _s3_storage_instance is None:
        _s3_storage_instance = S3StorageService()
    return _s3_storage_instance
