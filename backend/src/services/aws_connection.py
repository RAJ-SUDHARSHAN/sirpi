"""
AWS account connection service using IAM Role assumption.
Secure alternative to storing user credentials.
"""

import boto3
import logging
import secrets
from typing import Optional, Dict, Any
from botocore.exceptions import ClientError

from src.core.config import settings
from src.services.supabase import supabase, DatabaseError

logger = logging.getLogger(__name__)


class AWSConnectionError(Exception):
    """AWS connection operation error."""
    pass


class AWSConnectionService:
    """
    Manages secure AWS account connections via IAM role assumption.
    
    Users deploy a CloudFormation stack in their account that creates:
    1. IAM Role with trust to our account
    2. S3 bucket for Terraform state
    3. DynamoDB table for state locking
    
    We then assume that role to perform operations in their account.
    """

    def __init__(self):
        self.sts_client = boto3.client('sts', region_name=settings.aws_region)
        self.our_account_id = settings.aws_account_id

    def generate_external_id(self) -> str:
        """
        Generate cryptographically secure external ID.
        Used to prevent confused deputy problem in IAM role assumption.
        
        Returns:
            Random 32-character external ID
        """
        return secrets.token_urlsafe(32)

    async def initiate_connection(self, user_id: str) -> Dict[str, Any]:
        """
        Start AWS account connection flow.
        
        Returns CloudFormation template URL and external ID.
        User deploys this in their AWS account.
        
        Args:
            user_id: Clerk user ID
            
        Returns:
            Dict with cloudformation_url, external_id, instructions
        """
        external_id = self.generate_external_id()

        try:
            supabase.execute(
                """
                INSERT INTO aws_connections (user_id, external_id, status)
                VALUES (%s, %s, 'pending')
                ON CONFLICT (user_id) 
                DO UPDATE SET external_id = EXCLUDED.external_id, status = 'pending'
                """,
                (user_id, external_id)
            )

            cloudformation_url = self._generate_cloudformation_launch_url(external_id)

            return {
                'cloudformation_url': cloudformation_url,
                'external_id': external_id,
                'our_account_id': self.our_account_id,
                'instructions': [
                    '1. Click the CloudFormation link below',
                    '2. Review the template (creates IAM role, S3, DynamoDB)',
                    '3. Check "I acknowledge..." and click Create Stack',
                    '4. Wait 2-3 minutes for stack creation',
                    '5. Copy the RoleArn from Outputs tab',
                    '6. Return here and paste the RoleArn to complete setup'
                ]
            }

        except DatabaseError as e:
            logger.error(f"Failed to initiate AWS connection: {e}")
            raise AWSConnectionError("Connection initiation failed")

    async def complete_connection(
        self, 
        user_id: str, 
        role_arn: str
    ) -> Dict[str, str]:
        """
        Complete AWS account connection by verifying role.
        
        User provides the IAM Role ARN after deploying CloudFormation.
        We test if we can assume it.
        
        Args:
            user_id: Clerk user ID
            role_arn: IAM Role ARN from CloudFormation outputs
            
        Returns:
            Connection status and details
        """
        try:
            connection = supabase.execute(
                "SELECT external_id FROM aws_connections WHERE user_id = %s",
                (user_id,)
            ).fetchone()

            if not connection:
                raise AWSConnectionError("Connection not initiated")

            external_id = connection['external_id']

            verified = await self._verify_role_assumption(role_arn, external_id)

            if verified:
                supabase.execute(
                    """
                    UPDATE aws_connections 
                    SET role_arn = %s, status = 'connected', connected_at = NOW()
                    WHERE user_id = %s
                    """,
                    (role_arn, user_id)
                )

                logger.info(f"AWS account connected for user {user_id}")

                return {
                    'status': 'connected',
                    'role_arn': role_arn,
                    'message': 'AWS account connected successfully'
                }
            else:
                raise AWSConnectionError("Role assumption verification failed")

        except ClientError as e:
            logger.error(f"AWS verification error: {e}")
            raise AWSConnectionError("Failed to verify AWS role")
        except DatabaseError as e:
            logger.error(f"Database error: {e}")
            raise AWSConnectionError("Connection update failed")

    async def get_user_credentials(self, user_id: str) -> Dict[str, str]:
        """
        Get temporary AWS credentials by assuming user's IAM role.
        
        These credentials are valid for 1 hour and scoped to the role's permissions.
        
        Args:
            user_id: Clerk user ID
            
        Returns:
            Dict with access_key_id, secret_access_key, session_token
        """
        try:
            connection = supabase.execute(
                """
                SELECT role_arn, external_id FROM aws_connections 
                WHERE user_id = %s AND status = 'connected'
                """,
                (user_id,)
            ).fetchone()

            if not connection:
                raise AWSConnectionError("AWS account not connected")

            response = self.sts_client.assume_role(
                RoleArn=connection['role_arn'],
                RoleSessionName=f"sirpi-session-{user_id[:8]}",
                ExternalId=connection['external_id'],
                DurationSeconds=3600  # 1 hour
            )

            credentials = response['Credentials']

            return {
                'access_key_id': credentials['AccessKeyId'],
                'secret_access_key': credentials['SecretAccessKey'],
                'session_token': credentials['SessionToken'],
                'expiration': credentials['Expiration'].isoformat()
            }

        except ClientError as e:
            logger.error(f"Failed to assume role: {e}")
            raise AWSConnectionError("Could not get user credentials")
        except DatabaseError as e:
            logger.error(f"Database error: {e}")
            raise AWSConnectionError("Connection lookup failed")

    async def get_user_aws_client(self, user_id: str, service: str):
        """
        Get boto3 client for user's AWS account.
        
        Args:
            user_id: Clerk user ID
            service: AWS service name (e.g., 'ec2', 's3', 'ecs')
            
        Returns:
            Configured boto3 client
        """
        credentials = await self.get_user_credentials(user_id)

        return boto3.client(
            service,
            aws_access_key_id=credentials['access_key_id'],
            aws_secret_access_key=credentials['secret_access_key'],
            aws_session_token=credentials['session_token'],
            region_name=settings.aws_region
        )

    async def disconnect(self, user_id: str) -> None:
        """
        Disconnect user's AWS account.
        User should delete the CloudFormation stack in their account.
        
        Args:
            user_id: Clerk user ID
        """
        try:
            supabase.execute(
                "UPDATE aws_connections SET status = 'disconnected' WHERE user_id = %s",
                (user_id,)
            )

            logger.info(f"AWS account disconnected for user {user_id}")

        except DatabaseError as e:
            logger.error(f"Failed to disconnect: {e}")
            raise AWSConnectionError("Disconnection failed")

    async def _verify_role_assumption(self, role_arn: str, external_id: str) -> bool:
        """Test if we can assume the provided role."""
        try:
            self.sts_client.assume_role(
                RoleArn=role_arn,
                RoleSessionName='sirpi-verification',
                ExternalId=external_id,
                DurationSeconds=900  # 15 minutes (minimum)
            )
            return True
        except ClientError:
            return False

    def _generate_cloudformation_launch_url(self, external_id: str) -> str:
        """Generate 1-click CloudFormation launch URL."""
        template_url = f"https://{settings.s3_bucket_name}.s3.amazonaws.com/cloudformation/sirpi-setup.yaml"
        
        params = [
            f"param_SirpiAccountId={self.our_account_id}",
            f"param_ExternalId={external_id}"
        ]
        
        return (
            f"https://console.aws.amazon.com/cloudformation/home"
            f"?region={settings.aws_region}"
            f"#/stacks/create/review"
            f"?templateURL={template_url}"
            f"&stackName=Sirpi-Setup"
            f"&{'&'.join(params)}"
        )


_aws_connection_instance = None


def get_aws_connection() -> AWSConnectionService:
    """Get AWS connection service instance (lazy singleton)."""
    global _aws_connection_instance
    if _aws_connection_instance is None:
        _aws_connection_instance = AWSConnectionService()
    return _aws_connection_instance
