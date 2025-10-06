"""
Base class for Bedrock AgentCore integration.
"""

import boto3
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

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
    
    def __init__(self, agent_id: str, agent_name: str):
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.bedrock_client = boto3.client(
            'bedrock-agent-runtime',
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key
        )
        logger.info(f"Initialized {agent_name} (ID: {agent_id})")
    
    @abstractmethod
    async def invoke(self, input_data: Dict[str, Any]) -> Any:
        """
        Invoke the agent with input data.
        Subclasses must implement this method.
        """
        pass
    
    async def _call_bedrock_agent(
        self,
        session_id: str,
        prompt: str,
        enable_trace: bool = False
    ) -> str:
        """
        Call Bedrock agent and parse streaming response.
        
        Args:
            session_id: Session ID for conversation context
            prompt: Input text for the agent
            enable_trace: Enable trace for debugging
            
        Returns:
            Complete agent response text
        """
        try:
            logger.info(f"Invoking {self.agent_name} (session: {session_id})")
            
            # Try without alias first (latest version)
            try:
                response = self.bedrock_client.invoke_agent(
                    agentId=self.agent_id,
                    sessionId=session_id,
                    inputText=prompt,
                    enableTrace=enable_trace
                )
            except Exception as e:
                if 'alias' in str(e).lower():
                    # If alias is required, try with TSTALIASID
                    logger.info(f"Retrying with test alias...")
                    response = self.bedrock_client.invoke_agent(
                        agentId=self.agent_id,
                        agentAliasId='TSTALIASID',
                        sessionId=session_id,
                        inputText=prompt,
                        enableTrace=enable_trace
                    )
                else:
                    raise
            
            agent_response = ""
            event_stream = response.get('completion', [])
            
            for event in event_stream:
                if 'chunk' in event:
                    chunk = event['chunk']
                    if 'bytes' in chunk:
                        chunk_text = chunk['bytes'].decode('utf-8')
                        agent_response += chunk_text
                
                if enable_trace and 'trace' in event:
                    logger.debug(f"Trace: {event['trace']}")
            
            logger.info(f"{self.agent_name} response received ({len(agent_response)} chars)")
            
            return agent_response.strip()
            
        except Exception as e:
            logger.error(f"{self.agent_name} invocation failed: {e}", exc_info=True)
            raise BedrockAgentError(f"{self.agent_name} error: {str(e)}")
    
    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """
        Parse JSON from agent response.
        Handles markdown code blocks and extra text.
        """
        try:
            if '```json' in response:
                start = response.find('```json') + 7
                end = response.find('```', start)
                json_str = response[start:end].strip()
            elif '```' in response:
                start = response.find('```') + 3
                end = response.find('```', start)
                json_str = response[start:end].strip()
            else:
                json_str = response
            
            return json.loads(json_str)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e}")
            logger.error(f"Full response: {response}")
            raise BedrockAgentError(f"Invalid JSON response from agent: {str(e)}")
