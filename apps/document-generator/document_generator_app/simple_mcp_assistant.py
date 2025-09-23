"""
Simple MCP Client Assistant for Document Generator
Connects to the running app's MCP server to call functions directly
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Tuple
import gradio as gr
import httpx

# AI integration for intent parsing
try:
    from pydantic_ai import Agent
    from pydantic import BaseModel

    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False

    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)


# MCP Client imports
try:
    from mcp import ClientSession
    from mcp.client.sse import sse_client

    MCP_CLIENT_AVAILABLE = True
except ImportError:
    MCP_CLIENT_AVAILABLE = False

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter("[SIMPLE-MCP] %(levelname)s - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)


class FunctionIntent(BaseModel):
    """AI-parsed function intent"""

    function_name: str
    parameters: Dict[str, Any]
    confidence: float
    reasoning: str
    response: str = ""


class ProperMCPAssistant:
    """Proper MCP client using the MCP protocol for tool discovery and execution"""

    def __init__(self, server_url: str = "http://localhost:8000"):
        self.server_url = server_url
        self.mcp_endpoint = f"{server_url}/gradio_api/mcp/sse"
        self.available_tools = {}
        self.session = None

        logger.info(f"Initialized Proper MCP Assistant for: {server_url}")
        logger.info(f"MCP endpoint: {self.mcp_endpoint}")

        # Initialize AI agent for tool selection
        if AI_AVAILABLE:
            try:
                self.agent = Agent(
                    "openai:gpt-4o-mini",
                    result_type=FunctionIntent,
                    system_prompt="""You are a tool selection assistant for a document generator app.

You will be given:
1. A user request
2. A list of available MCP tools with descriptions

Your job is to select the most appropriate tool and prepare parameters.

Common tool mappings:
- Document creation requests → mcp_handle_start_draft_click (use full user message as prompt)
- Add section requests → add_ai_block 
- Generate content → handle_document_generation
- Export requests → handle_download_format
- Reset/clear → reset_document

Return:
- function_name: exact tool name from the available list
- parameters: dict with required parameters (always include user's message as 'prompt' for creation tasks)
- confidence: 0-1 confidence score
- reasoning: why this tool was chosen
- response: friendly message about what will happen

Be flexible with language variations like "draft", "create", "make", "write", "generate".
""",
                )
                logger.info("AI agent initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize AI agent: {e}")
                self.agent = None
        else:
            logger.info("AI not available, using fallback logic")
            self.agent = None

    async def connect_and_discover_tools(self) -> bool:
        """Connect to MCP server and discover available tools - using HTTP fallback for now"""

        try:
            logger.info(f"Discovering tools from MCP server: {self.server_url}/gradio_api/mcp/")

            # Use proper MCP JSON-RPC request to get tools list
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Send MCP tools/list request
                mcp_request = {"jsonrpc": "2.0", "id": "1", "method": "tools/list", "params": {}}

                response = await client.post(
                    f"{self.server_url}/gradio_api/mcp/",
                    json=mcp_request,
                    headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
                )
                response.raise_for_status()

                # Parse SSE response format (handles both \n and \r\n)
                response_text = response.text
                if "event: message" in response_text and "data: " in response_text:
                    # Extract JSON from SSE format - handle CRLF or LF line endings
                    if "data: " in response_text:
                        json_data = response_text.split("data: ", 1)[1].strip()
                        schema_response = json.loads(json_data)

                        # Extract tools from JSON-RPC response
                        if "result" in schema_response and "tools" in schema_response["result"]:
                            tools_list = schema_response["result"]["tools"]

                            # Convert to tool objects with name and description
                            self.available_tools = {}
                            for tool_schema in tools_list:
                                tool_name = tool_schema.get("name", "unknown")
                                # Create a simple tool object
                                self.available_tools[tool_name] = {
                                    "name": tool_name,
                                    "description": tool_schema.get("description", f"Tool: {tool_name}"),
                                }
                        else:
                            logger.error("Invalid MCP response format - no tools in result")
                            return False
                    else:
                        logger.error("No data field found in SSE response")
                        return False
                else:
                    logger.error(f"Expected SSE format but got: {response_text[:100]}...")
                    return False

                logger.info(f"Discovered {len(self.available_tools)} tools from HTTP schema:")
                for tool_name in list(self.available_tools.keys())[:10]:  # Show first 10
                    logger.info(f"  - {tool_name}")

                return True

        except Exception as e:
            logger.error(f"Failed to discover tools via HTTP schema: {e}")
            return False

    async def parse_intent_with_ai(self, message: str) -> FunctionIntent:
        """Use AI to determine which function to call"""
        logger.info(f"Using AI to parse message: '{message}'")

        if not self.agent:
            # Fallback for common patterns
            logger.warning("No AI agent available, using fallback")
            if any(word in message.lower() for word in ["create", "draft", "make", "write", "document", "about"]):
                return FunctionIntent(
                    function_name="mcp_handle_start_draft_click",
                    parameters={"prompt": message},
                    confidence=0.7,
                    reasoning="Fallback pattern matched document creation keywords",
                    response="Creating document...",
                )
            else:
                return FunctionIntent(
                    function_name="unknown",
                    parameters={},
                    confidence=0.0,
                    reasoning="No AI agent and no fallback patterns matched",
                    response="I need help understanding that request.",
                )

        # Get tool list for AI context
        tool_descriptions = []
        if self.available_tools:
            for tool_name, tool in self.available_tools.items():
                tool_descriptions.append(f"- {tool_name}: {tool['description']}")
        else:
            # Fallback list
            tool_descriptions = [
                "- mcp_handle_start_draft_click: Creates document outline from prompt",
                "- handle_document_generation: Generates content for existing blocks",
                "- add_ai_block: Adds new AI-generated section",
                "- handle_download_format: Exports document",
                "- reset_document: Clears document",
            ]

        try:
            # Ask AI to choose tool
            tools_context = "\n".join(tool_descriptions)
            result = await self.agent.run(
                f"""User request: "{message}"

Available MCP tools:
{tools_context}

Select the most appropriate tool and prepare parameters for this request."""
            )

            logger.info(f"AI selected tool: {result.data.function_name}")
            logger.info(f"AI reasoning: {result.data.reasoning}")
            return result.data

        except Exception as e:
            logger.error(f"AI tool selection failed: {e}")
            # Fallback
            return FunctionIntent(
                function_name="mcp_handle_start_draft_click"
                if any(word in message.lower() for word in ["create", "draft", "make", "write"])
                else "unknown",
                parameters={"prompt": message}
                if any(word in message.lower() for word in ["create", "draft", "make", "write"])
                else {},
                confidence=0.5,
                reasoning=f"AI failed, used simple fallback: {e}",
                response="Processing your request...",
            )

    async def execute_mcp_tool(self, function_intent: FunctionIntent, context: Dict[str, Any]) -> Tuple[Any, str]:
        """Execute the selected tool using proper MCP protocol"""

        if function_intent.function_name == "unknown":
            return None, function_intent.response

        if function_intent.function_name not in self.available_tools:
            logger.warning(f"Tool '{function_intent.function_name}' not found in available tools")
            return None, f"Error: Tool '{function_intent.function_name}' not available"

        try:
            # Prepare tool arguments based on the function
            tool_args = self._prepare_mcp_tool_args(function_intent, context)

            logger.info(f"Calling MCP tool: {function_intent.function_name}")
            logger.debug(f"Tool arguments: {tool_args}")

            # Call MCP tool using JSON-RPC protocol
            result = await self.call_mcp_tool(function_intent.function_name, tool_args)

            logger.info(f"MCP tool call completed successfully")
            logger.debug(f"Result: {str(result)[:200]}...")

            # Return the result and response message
            return result, function_intent.response if function_intent.response else "Tool executed successfully"

        except Exception as e:
            logger.error(f"Error calling MCP tool '{function_intent.function_name}': {e}")
            return None, f"Error executing tool: {str(e)}"

    def _prepare_mcp_tool_args(self, function_intent: FunctionIntent, context: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare arguments for MCP tool call"""

        function_name = function_intent.function_name

        if function_name == "create_draft_document":
            return {"prompt": function_intent.parameters.get("prompt", "")}
        elif function_name == "generate_final_document":
            return {}
        elif function_name == "handle_document_generation":
            return {"title": context.get("title", ""), "description": context.get("description", "")}
        elif function_name == "handle_download_format":
            return {"format_type": function_intent.parameters.get("format", "docx")}
        elif function_name == "reset_document":
            return {}
        else:
            # Return any parameters from the function intent
            return function_intent.parameters

    def _convert_to_gradio_api_format(
        self, function_name: str, tool_args: Dict[str, Any], context: Dict[str, Any]
    ) -> List[Any]:
        """Convert MCP tool args to Gradio API format (list of arguments)"""

        if function_name == "handle_start_draft_click":
            return [tool_args.get("prompt", ""), tool_args.get("resources", []), tool_args.get("session_id", "")]
        elif function_name == "add_ai_block":
            return [tool_args.get("blocks", []), tool_args.get("focused_block_id", None)]
        elif function_name == "handle_document_generation":
            return [
                tool_args.get("title", ""),
                tool_args.get("description", ""),
                tool_args.get("resources", []),
                tool_args.get("blocks", []),
                tool_args.get("session_id", ""),
            ]
        elif function_name == "handle_download_format":
            return [
                tool_args.get("format_type", "docx"),
                tool_args.get("docx_path", None),
                tool_args.get("markdown_path", None),
            ]
        elif function_name == "reset_document":
            return []
        else:
            # For unknown functions, try to convert dict to list of values
            return list(tool_args.values())

    async def call_gradio_api(self, endpoint: str, data: List[Any]) -> Any:
        """Call Gradio API endpoint directly"""
        if not endpoint:
            return None

        url = f"{self.server_url}{endpoint}"
        logger.info(f"Calling Gradio API: {url}")
        logger.debug(f"Request data: {data}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json={"data": data})
                response.raise_for_status()

                result = response.json()
                logger.info(f"API call successful, response type: {type(result)}")
                logger.debug(f"Response preview: {str(result)[:200]}...")

                return result.get("data", result)

        except Exception as e:
            logger.error(f"API call failed: {e}")
            return None

    def prepare_api_data(self, function_intent: FunctionIntent, context: Dict[str, Any]) -> List[Any]:
        """Prepare data array for Gradio API call based on function"""
        function_name = function_intent.function_name

        if function_name == "handle_start_draft_click":
            return [
                function_intent.parameters.get("prompt", ""),  # prompt
                context.get("resources", []),  # resources
                context.get("session_id", ""),  # session_id
            ]
        elif function_name == "add_ai_block":
            return [
                context.get("blocks", []),  # blocks
                context.get("focused_block_id", None),  # focused_block_id
            ]
        elif function_name == "handle_document_generation":
            return [
                "",  # title
                "",  # description
                context.get("resources", []),  # resources
                context.get("blocks", []),  # blocks
                context.get("session_id", ""),  # session_id
            ]
        elif function_name == "handle_download_format":
            # Determine format from parameters or function intent
            export_format = function_intent.parameters.get("format", "docx")
            return [
                export_format,  # format_type
                None,  # docx_path
                None,  # markdown_path
            ]
        elif function_name == "reset_document":
            return []
        else:
            return []

    async def execute_function(self, function_intent: FunctionIntent, context: Dict[str, Any]) -> Tuple[Any, str]:
        """Execute the AI-selected function via MCP protocol"""
        if function_intent.function_name == "unknown":
            return None, function_intent.response

        # Prepare MCP tool arguments
        tool_args = self.prepare_mcp_tool_args(function_intent, context)

        # Add response if not set
        if not function_intent.response:
            function_intent.response = f"Calling {function_intent.function_name}..."

        logger.info(f"Executing MCP tool: {function_intent.function_name}")
        logger.info(f"Reasoning: {function_intent.reasoning}")

        # Call MCP tool
        result = await self.call_mcp_tool(function_intent.function_name, tool_args)

        return result, function_intent.response

    def prepare_mcp_tool_args(self, function_intent: FunctionIntent, context: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare arguments for MCP tool call"""
        function_name = function_intent.function_name

        if function_name in ["handle_start_draft_click", "mcp_handle_start_draft_click"]:
            return {"prompt": function_intent.parameters.get("prompt", "")}
        elif function_name == "add_ai_block":
            return {}  # No arguments needed
        elif function_name == "handle_document_generation":
            return {"title": context.get("title", ""), "description": context.get("description", "")}
        elif function_name == "handle_download_format":
            return {"format_type": function_intent.parameters.get("format", "docx")}
        elif function_name == "reset_document":
            return {}
        else:
            # Return the parameters as-is for other tools
            return function_intent.parameters

    async def call_mcp_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call MCP tool using JSON-RPC protocol"""
        try:
            logger.info(f"Calling MCP tool: {tool_name}")
            logger.debug(f"Arguments: {arguments}")

            # Send MCP tools/call request
            mcp_request = {
                "jsonrpc": "2.0",
                "id": "2",
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments},
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.server_url}/gradio_api/mcp/",
                    json=mcp_request,
                    headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
                )
                response.raise_for_status()

                logger.info(
                    f"\n\nIMPORTANT: MCP tool call response:\n {response.headers}\n{response.content}\n{response.text}\n"
                )
                # Parse SSE response format
                response_text = response.text
                if "event: message" in response_text and "data: " in response_text:
                    json_data = response_text.split("data: ", 1)[1].strip()
                    mcp_response = json.loads(json_data)

                    if "result" in mcp_response:
                        logger.info(f"MCP tool call successful")
                        return mcp_response["result"]
                    elif "error" in mcp_response:
                        logger.error(f"MCP tool call error: {mcp_response['error']}")
                        return None
                    else:
                        logger.error("Invalid MCP response format")
                        return None
                else:
                    logger.error(f"Expected SSE format but got: {response_text[:100]}...")
                    return None

        except Exception as e:
            logger.error(f"MCP tool call failed: {e}")
            return None


def create_simple_mcp_chatbot():
    """Create simple MCP chatbot interface"""

    with gr.Column():
        gr.Markdown("### 🚀 Simple MCP Assistant")
        gr.Markdown("Calls app functions directly via Gradio API!")

        chatbot = gr.Chatbot(
            height=400, placeholder="Ready to help with your document...", bubble_full_width=False, type="messages"
        )

        with gr.Row():
            msg_input = gr.Textbox(
                placeholder="Example: 'Create a document about artificial intelligence'", show_label=False, scale=4
            )
            send_btn = gr.Button("Send", variant="primary", scale=1)
            clear_btn = gr.Button("Clear", scale=1)

        gr.Markdown("**Available Commands:** Create, Add section, Generate, Export, Reset, Help")

    return chatbot, msg_input, send_btn, clear_btn


def handle_simple_mcp_chat(
    message: str,
    history: List[Dict],
    blocks_state: List[Dict],
    resources_state: List[Dict],
    session_id: str,
    focused_block_id: Optional[str],
    server_url: str = "http://localhost:8000",
) -> None:
    """Handle chat via simple MCP approach"""

    logger.info(f"=== SIMPLE MCP CHAT HANDLER ===")
    logger.info(f"Message: '{message}'")
    logger.info(f"Server: {server_url}")

    if not message:
        return

    # Run async processing
    asyncio.run(
        _async_simple_mcp_chat(
            message, history, blocks_state, resources_state, session_id, focused_block_id, server_url
        )
    )

    return


async def _async_simple_mcp_chat(
    message: str,
    history: List[Dict],
    blocks_state: List[Dict],
    resources_state: List[Dict],
    session_id: str,
    focused_block_id: Optional[str],
    server_url: str,
) -> Tuple[List[Dict], List[Dict], List[Dict], str]:
    """Async simple MCP processing with AI function selection"""

    # Initialize proper MCP assistant
    assistant = ProperMCPAssistant(server_url)

    # Connect to MCP server and discover tools using proper protocol
    logger.info("Connecting to MCP server and discovering tools...")
    connected = await assistant.connect_and_discover_tools()

    if not connected:
        # Fallback error handling
        history.append({"role": "user", "content": message})
        history.append({
            "role": "assistant",
            "content": "Error: Could not connect to document server. Make sure the app is running with MCP enabled.",
        })
        return history, blocks_state, resources_state, ""

    # Use AI to parse intent and select function
    function_intent = await assistant.parse_intent_with_ai(message)

    # Prepare context
    context = {
        "blocks": blocks_state,
        "resources": resources_state,
        "session_id": session_id,
        "focused_block_id": focused_block_id,
    }

    # Execute the AI-selected MCP tool
    result, response = await assistant.execute_mcp_tool(function_intent, context)

    # Update history
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": response})

    # Process result based on function called
    logger.info(f"Processing result for function: {function_intent.function_name}")
    logger.debug(f"Result type: {type(result)}")
    logger.debug(f"Result content: {result}")

    if function_intent.function_name in ["handle_start_draft_click", "mcp_handle_start_draft_click"] and result:
        logger.info("Extracting document creation results")

        # The MCP result should contain ToolResult format with JSON in content
        try:
            if isinstance(result, dict) and "content" in result:
                # Extract the JSON from the MCP ToolResult
                content_items = result.get("content", [])
                if content_items and len(content_items) > 0:
                    text_content = content_items[0].get("text", "")
                    if text_content:
                        # Parse the JSON response from our MCP wrapper
                        response_data = json.loads(text_content)
                        logger.info(f"Parsed MCP response: {response_data.get('status', 'unknown')}")

                        if response_data.get("status") == "success" and "data" in response_data:
                            data = response_data["data"]
                            new_blocks = data.get("blocks", blocks_state)
                            new_resources = data.get("resources", resources_state)

                            logger.info(f"Updated blocks: {len(new_blocks)}, resources: {len(new_resources)}")
                            return history, new_blocks, new_resources, ""
                        else:
                            logger.error(f"MCP wrapper returned error: {response_data.get('message', 'Unknown error')}")
                    else:
                        logger.error("No text content in MCP result")
                else:
                    logger.error("No content items in MCP result")
            else:
                logger.error(f"Unexpected MCP result format: {type(result)}")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from MCP result: {e}")
        except Exception as e:
            logger.error(f"Error processing MCP result: {e}")
            logger.error(f"Result structure: {result}")

    elif function_intent.function_name in ["add_ai_block", "handle_document_generation"] and result:
        logger.info(f"Processing {function_intent.function_name} results")
        # These should return updated blocks
        if isinstance(result, list):
            new_blocks = result[0] if result else blocks_state
            return history, new_blocks, resources_state, ""

    elif function_intent.function_name == "reset_document":
        logger.info("Resetting document state")
        return history, [], [], ""

    # Default: no state change
    return
