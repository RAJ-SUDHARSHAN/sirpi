"""
Base class for Bedrock AgentCore integration.
"""

import boto3
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Callable

from src.core.config import settings

logger = logging.getLogger(__name__)


class BedrockAgentError(Exception):
    """Bedrock agent operation error."""
    pass


class BaseBedrockAgent(ABC):
    """
    Base class for Bedrock agent wrappers.
    Handles boto3 client and streaming response parsing.
    """
    
    def __init__(self, agent_id: str, agent_alias_id: str, agent_name: str):
        self.agent_id = agent_id
        self.agent_alias_id = agent_alias_id
        self.agent_name = agent_name
        self.bedrock_client = boto3.client(
            'bedrock-agent-runtime',
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key
        )
        logger.info(f"Initialized {agent_name} (ID: {agent_id}, Alias: {agent_alias_id})")
    
    @abstractmethod
    async def invoke(self, input_data: Dict[str, Any], thinking_callback: Optional[Callable] = None) -> Any:
        """
        Invoke the agent with input data.
        Subclasses must implement this method.
        """
        pass
    
    async def _call_bedrock_agent(
        self,
        session_id: str,
        prompt: str,
        thinking_callback: Optional[Callable] = None,
        enable_trace: bool = False,
        max_retries: int = 3
    ) -> str:
        """
        Call Bedrock agent and parse streaming response.
        
        Args:
            session_id: Session ID for conversation context
            prompt: Input text for the agent
            thinking_callback: Optional callback for streaming chunks
            enable_trace: Enable trace for debugging
            max_retries: Maximum number of retry attempts for throttling
            
        Returns:
            Complete agent response text
        """
        import asyncio
        from botocore.exceptions import ClientError, EventStreamError
        
        last_error = None
        
        for attempt in range(max_retries):
            try:
                logger.info(f"Invoking {self.agent_name} (session: {session_id})")
                
                response = self.bedrock_client.invoke_agent(
                    agentId=self.agent_id,
                    agentAliasId=self.agent_alias_id,
                    sessionId=session_id,
                    inputText=prompt,
                    enableTrace=enable_trace
                )
                
                agent_response = ""
                event_stream = response.get('completion', [])
                
                for event in event_stream:
                    if 'chunk' in event:
                        chunk = event['chunk']
                        if 'bytes' in chunk:
                            chunk_text = chunk['bytes'].decode('utf-8')
                            agent_response += chunk_text
                            
                            if thinking_callback:
                                thinking_callback(self.agent_name, chunk_text)
                    
                    if enable_trace and 'trace' in event:
                        logger.debug(f"Trace: {event['trace']}")
                
                logger.info(f"{self.agent_name} response received ({len(agent_response)} chars)")
                
                return agent_response.strip()
                
            except (ClientError, EventStreamError) as e:
                error_code = getattr(e, 'response', {}).get('Error', {}).get('Code', '')
                
                # Check if it's a throttling error
                if 'throttl' in str(e).lower() or error_code == 'ThrottlingException':
                    last_error = e
                    
                    if attempt < max_retries - 1:
                        # Exponential backoff: 2^attempt seconds (2s, 4s, 8s)
                        wait_time = 2 ** (attempt + 1)
                        logger.warning(
                            f"{self.agent_name} throttled, retrying in {wait_time}s "
                            f"(attempt {attempt + 1}/{max_retries})"
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"{self.agent_name} throttled after {max_retries} attempts")
                        raise BedrockAgentError(
                            f"{self.agent_name} rate limited after {max_retries} retries. "
                            "Please wait a moment and try again."
                        )
                else:
                    # Non-throttling error, raise immediately
                    logger.error(f"{self.agent_name} invocation failed: {e}", exc_info=True)
                    raise BedrockAgentError(f"{self.agent_name} error: {str(e)}")
                    
            except Exception as e:
                logger.error(f"{self.agent_name} invocation failed: {e}", exc_info=True)
                raise BedrockAgentError(f"{self.agent_name} error: {str(e)}")
    
    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """
        Parse JSON from agent response.
        Handles markdown code blocks, XML tags, and extra text.
        """
        try:
            # Remove XML tags
            response = response.replace('<thinking>', '').replace('</thinking>', '')
            response = response.replace('<answer>', '').replace('</answer>', '')
            
            # Try to find JSON in markdown code blocks
            if '```json' in response:
                start = response.find('```json') + 7
                end = response.find('```', start)
                json_str = response[start:end].strip()
            elif '```' in response:
                start = response.find('```') + 3
                end = response.find('```', start)
                json_str = response[start:end].strip()
            else:
                # Try to find JSON object in the text (search for { and })
                start = response.find('{')
                end = response.rfind('}') + 1
                if start >= 0 and end > start:
                    json_str = response[start:end].strip()
                else:
                    # Last resort: try the whole response
                    json_str = response.strip()
            
            # Try to parse the extracted JSON
            return json.loads(json_str)
            
        except json.JSONDecodeError as e:
            # If JSON parsing failed, try to extract from markdown bullet points as fallback
            logger.warning(f"JSON parsing failed, attempting markdown extraction: {e}")
            try:
                return self._extract_json_from_markdown(response)
            except Exception as markdown_error:
                logger.error(f"Failed to parse JSON: {e}")
                logger.error(f"Failed markdown extraction: {markdown_error}")
                logger.error(f"Full response: {response}")
                raise BedrockAgentError(f"Invalid JSON response from agent: {str(e)}")
    
    def _extract_json_from_markdown(self, markdown_text: str) -> Dict[str, Any]:
        """Extract structured data from markdown bullet points as fallback."""
        import re
        
        result = {
            'dependencies': {},  # Always initialize as empty dict, not None
        }
        
        # Extract simple key-value pairs from markdown
        patterns = {
            'language': r'\*\*Language\*\*:?\s*([\w\+\-\.]+)',
            'framework': r'\*\*Framework\*\*:?\s*([\w\s\-\.]+?)(?:\n|$)',
            'runtime': r'\*\*Runtime\*\*:?\s*([\w\s\-\.]+?)(?:\n|$)',
            'package_manager': r'\*\*Package Manager\*\*:?\s*([\w\s\-\.]+?)(?:\n|$)',
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, markdown_text, re.IGNORECASE)
            if match:
                result[key] = match.group(1).strip()
        
        # Extract port from text
        port_match = re.search(r'\*\*.*?Port.*?\*\*:?\s*(\d+)', markdown_text, re.IGNORECASE)
        if port_match:
            result['ports'] = [int(port_match.group(1))]
        else:
            result['ports'] = [3000]  # Default
        
        # Defaults for ALL required fields (ensuring proper types)
        result.setdefault('language', 'javascript')
        result.setdefault('framework', 'unknown')
        result.setdefault('runtime', 'node20')
        result.setdefault('package_manager', 'npm')
        result.setdefault('deployment_target', 'fargate')
        result.setdefault('environment_vars', [])
        result.setdefault('health_check_path', '/health')
        result.setdefault('start_command', 'npm start')
        result.setdefault('build_command', None)
        
        logger.warning(f"Extracted from markdown: {result}")
        return result
