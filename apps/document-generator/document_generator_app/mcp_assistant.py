"""
MCP-based Document Assistant - Chatbot interface using MCP client
Connects to the running Gradio app's MCP server to execute commands
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Tuple
import gradio as gr

# MCP imports
try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.sse import sse_client

    MCP_AVAILABLE = True
    logging.info("MCP client libraries available")
except ImportError:
    MCP_AVAILABLE = False
    logging.warning("MCP client libraries not available")

# Set up logging for MCP assistant
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Create console handler if not already exists
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter("[MCP-ASSISTANT] %(levelname)s - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

try:
    from pydantic import BaseModel

    PYDANTIC_AVAILABLE = True
except ImportError:
    PYDANTIC_AVAILABLE = False

    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)


class CommandIntent(BaseModel):
    """Parsed user intent from chatbot"""

    action: str
    tool_name: str  # MCP tool name to call
    parameters: Dict[str, Any]
    confidence: float
    response: str = ""


class MCPDocumentAssistant:
    """MCP-based document assistant that connects to Gradio app's MCP server"""

    def __init__(self, server_url: str = "http://localhost:7860"):
        logger.info(f"Initializing MCP Document Assistant with server: {server_url}")
        self.server_url = server_url
        self.mcp_endpoint = f"{server_url}/gradio_api/mcp/sse"
        self.session = None
        self.tools = {}
        self.connected = False

        # Intent patterns for mapping user input to MCP tools
        self.intent_patterns = {
            r"create.*(document|outline|draft)": {
                "action": "create_outline",
                "tool_name": "handle_start_draft_click",
                "confidence": 0.9,
            },
            r"add.*(section|block)": {"action": "add_section", "tool_name": "add_ai_block", "confidence": 0.9},
            r"generate.*document": {
                "action": "generate_document",
                "tool_name": "handle_document_generation",
                "confidence": 0.9,
            },
            r"export.*(?:as )?(word|docx)": {
                "action": "export_docx",
                "tool_name": "handle_download_format",
                "confidence": 0.8,
            },
            r"export.*(?:as )?(markdown|md)": {
                "action": "export_markdown",
                "tool_name": "handle_download_format",
                "confidence": 0.8,
            },
            r"reset|clear|start over": {"action": "reset_document", "tool_name": "reset_document", "confidence": 0.9},
            r"help|commands": {"action": "help", "tool_name": None, "confidence": 1.0},
        }

    async def connect(self) -> bool:
        """Connect to the MCP server and discover available tools"""
        if not MCP_AVAILABLE:
            logger.error("MCP libraries not available")
            return False

        try:
            logger.info(f"Connecting to MCP server at: {self.mcp_endpoint}")

            # Connect using SSE client
            async with sse_client(self.mcp_endpoint) as (read, write):
                async with ClientSession(read, write) as session:
                    self.session = session

                    # Initialize the session
                    await session.initialize()

                    # List available tools
                    result = await session.list_tools()
                    self.tools = {tool.name: tool for tool in result.tools}

                    logger.info(f"Connected successfully! Found {len(self.tools)} tools:")
                    for tool_name in self.tools.keys():
                        logger.info(f"  - {tool_name}")

                    self.connected = True
                    return True

        except Exception as e:
            logger.error(f"Failed to connect to MCP server: {e}")
            self.connected = False
            return False

    async def parse_intent(self, message: str, context: Dict[str, Any]) -> CommandIntent:
        """Parse user message into MCP tool call intent"""
        logger.info(f"Parsing user message: '{message}'")

        import re

        message_lower = message.lower().strip()

        # Pattern matching to determine intent
        for pattern, intent_config in self.intent_patterns.items():
            if re.search(pattern, message_lower):
                logger.info(f"Pattern matched: {pattern} -> {intent_config['action']}")
                return CommandIntent(
                    action=intent_config["action"],
                    tool_name=intent_config["tool_name"],
                    parameters={"user_message": message, **context},
                    confidence=intent_config["confidence"],
                    response=self._get_response_for_action(intent_config["action"]),
                )

        # Unknown command
        logger.warning(f"No pattern matched for message: '{message}'")
        return CommandIntent(
            action="unknown",
            tool_name=None,
            parameters={},
            confidence=0.0,
            response="I didn't understand that command. Try 'help' to see available commands.",
        )

    def _get_response_for_action(self, action: str) -> str:
        """Generate friendly response for action"""
        responses = {
            "create_outline": "Creating document outline...",
            "add_section": "Adding new section...",
            "generate_document": "Generating document content...",
            "export_docx": "Exporting as Word document...",
            "export_markdown": "Exporting as Markdown...",
            "reset_document": "Resetting document...",
            "help": "Available commands:\n• Create document about [topic]\n• Add section about [topic]\n• Generate document\n• Export as Word/Markdown\n• Reset document",
        }
        return responses.get(action, "Processing your request...")

    async def execute_mcp_tool(self, intent: CommandIntent) -> Tuple[Any, str]:
        """Execute MCP tool call based on intent"""
        if intent.action == "help" or intent.action == "unknown":
            logger.info(f"Returning response for {intent.action}")
            return None, intent.response

        if not self.connected:
            logger.error("Not connected to MCP server")
            return None, "Error: Not connected to document server"

        if not intent.tool_name:
            logger.warning(f"No tool specified for action: {intent.action}")
            return None, "Error: No tool available for this action"

        if intent.tool_name not in self.tools:
            logger.warning(f"Tool '{intent.tool_name}' not found in available tools")
            logger.info(f"Available tools: {list(self.tools.keys())}")
            return None, f"Error: Tool '{intent.tool_name}' not available"

        try:
            logger.info(f"Calling MCP tool: {intent.tool_name}")

            # Prepare arguments based on the specific tool
            tool_args = self._prepare_tool_arguments(intent)

            logger.debug(f"Tool arguments: {tool_args}")

            # Call the MCP tool
            result = await self.session.call_tool(intent.tool_name, tool_args)

            logger.info(f"MCP tool call completed successfully")
            logger.debug(f"Result content preview: {str(result.content)[:200]}...")

            return result.content, intent.response

        except Exception as e:
            logger.error(f"Error calling MCP tool '{intent.tool_name}': {e}")
            return None, f"Error executing command: {str(e)}"

    def _prepare_tool_arguments(self, intent: CommandIntent) -> Dict[str, Any]:
        """Prepare arguments for specific MCP tools"""
        base_args = {
            "prompt": intent.parameters.get("user_message", ""),
            "resources": intent.parameters.get("resources", []),
            "session_id": intent.parameters.get("session_id", ""),
        }

        if intent.action == "create_outline":
            return {
                "prompt": intent.parameters.get("user_message", ""),
                "resources": intent.parameters.get("resources", []),
                "session_id": intent.parameters.get("session_id"),
            }
        elif intent.action == "add_section":
            return {
                "blocks": intent.parameters.get("blocks", []),
                "focused_block_id": intent.parameters.get("focused_block_id"),
            }
        elif intent.action == "generate_document":
            return {
                "title": "",
                "description": "",
                "resources": intent.parameters.get("resources", []),
                "blocks": intent.parameters.get("blocks", []),
                "session_id": intent.parameters.get("session_id"),
            }
        elif intent.action in ["export_docx", "export_markdown"]:
            format_type = "docx" if intent.action == "export_docx" else "md"
            return {"format_type": format_type, "docx_path": None, "markdown_path": None}
        elif intent.action == "reset_document":
            return {}
        else:
            return base_args


def create_chatbot_interface():
    """Create the Gradio chatbot interface components"""

    with gr.Column():
        gr.Markdown("### 🤖 MCP Document Assistant")
        gr.Markdown("Connected to the app via MCP protocol!")

        chatbot = gr.Chatbot(
            height=400,
            placeholder="Type a command to get started...",
            bubble_full_width=False,
            elem_classes="mcp-assistant-chatbot",
            type="messages",
        )

        with gr.Row():
            msg_input = gr.Textbox(
                placeholder="Try: 'Create a document about machine learning' or 'Add a section on neural networks'",
                show_label=False,
                scale=4,
                lines=1,
            )
            send_btn = gr.Button("Send", variant="primary", scale=1)
            clear_btn = gr.Button("Clear", scale=1)

        with gr.Accordion("📡 MCP Commands", open=False):
            gr.Markdown("""
            **Document Creation:**
            - "Create a document about [topic]"
            - "Start an outline for [topic]"
            
            **Section Management:**
            - "Add a section about [topic]"
            - "Generate the document"
            
            **Export:**
            - "Export as Word"
            - "Export as Markdown"
            
            **Other:**
            - "Reset document"
            - "Help" - Show commands
            
            *Commands are executed via MCP protocol to the running app*
            """)

    return chatbot, msg_input, send_btn, clear_btn


def handle_mcp_chat_message(
    message: str,
    history: List[Dict],
    blocks_state: List[Dict],
    resources_state: List[Dict],
    session_id: str,
    focused_block_id: Optional[str],
    server_url: str = "http://localhost:7860",
) -> Tuple[List[Dict], List[Dict], List[Dict], str]:
    """Process chat message using MCP client (synchronous wrapper)"""

    logger.info(f"=== MCP CHAT MESSAGE HANDLER STARTED ===")
    logger.info(f"Message: '{message}'")
    logger.info(f"Server URL: {server_url}")
    logger.info(f"Session ID: {session_id}")
    logger.info(f"Current blocks: {len(blocks_state)}, resources: {len(resources_state)}")

    if not message:
        logger.info("Empty message, returning unchanged state")
        return history, blocks_state, resources_state, ""

    # Run async MCP operations
    result = asyncio.run(
        _async_handle_mcp_chat(
            message, history, blocks_state, resources_state, session_id, focused_block_id, server_url
        )
    )

    return result


async def _async_handle_mcp_chat(
    message: str,
    history: List[Dict],
    blocks_state: List[Dict],
    resources_state: List[Dict],
    session_id: str,
    focused_block_id: Optional[str],
    server_url: str,
) -> Tuple[List[Dict], List[Dict], List[Dict], str]:
    """Async MCP chat message handling"""

    # Initialize MCP assistant
    logger.info("Initializing MCP Document Assistant")
    assistant = MCPDocumentAssistant(server_url)

    # Connect to MCP server
    if not await assistant.connect():
        error_msg = "Failed to connect to document server. Make sure the app is running."
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": error_msg})
        return history, blocks_state, resources_state, ""

    # Prepare context
    context = {
        "blocks": blocks_state,
        "resources": resources_state,
        "session_id": session_id,
        "focused_block_id": focused_block_id,
    }

    # Parse intent
    logger.info("Parsing user intent...")
    intent = await assistant.parse_intent(message, context)

    # Execute MCP tool
    logger.info("Executing MCP tool...")
    result, response = await assistant.execute_mcp_tool(intent)

    # Update chat history
    logger.info("Updating chat history")
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": response})

    # Process results and update app state
    logger.info(f"Processing MCP result for action: {intent.action}")

    if intent.action == "create_outline" and result:
        logger.info("Processing create_outline MCP result")
        # MCP result should contain the updated state
        # For now, return unchanged state - this will be refined
        return history, blocks_state, resources_state, ""

    elif intent.action in ["add_section", "generate_document"] and result:
        logger.info(f"Processing {intent.action} MCP result")
        return history, blocks_state, resources_state, ""

    elif intent.action in ["export_docx", "export_markdown"] and result:
        logger.info(f"Export completed via MCP: {intent.action}")
        return history, blocks_state, resources_state, ""

    elif intent.action == "reset_document" and result:
        logger.info("Processing reset_document MCP result")
        return history, [], [], ""  # Clear states

    else:
        logger.info("No state change from MCP call")
        return history, blocks_state, resources_state, ""
