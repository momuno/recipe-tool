"""
Document Assistant - Chatbot interface for document generator
Interprets natural language commands and executes app functions
"""

import re
from typing import Any, Dict, List, Optional, Tuple
import json
import asyncio
import gradio as gr

try:
    from pydantic_ai import Agent
    from pydantic import BaseModel
    PYDANTIC_AI_AVAILABLE = True
except ImportError:
    PYDANTIC_AI_AVAILABLE = False
    # Create a simple BaseModel replacement
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

from .config import settings


class CommandIntent(BaseModel):
    """Parsed user intent from chatbot"""
    action: str
    parameters: Dict[str, Any]
    confidence: float
    response: str


class DocumentAssistant:
    """Chatbot assistant for document operations"""
    
    def __init__(self):
        # Initialize the AI agent for parsing intents if available
        if PYDANTIC_AI_AVAILABLE:
            try:
                model_id = f"{settings.llm_provider}:{settings.default_model}"
                self.agent = Agent(
                    model_id,
                    system_prompt="""You are a document assistant that helps users create and manage documents.
                    Parse user requests into specific actions with parameters.
                    
                    Available actions:
                    - create_outline: Create a new document outline from a prompt. Parameters: {"topic": "the topic"}
                    - add_ai_block: Add an AI-generated section. Parameters: {"topic": "section topic"}
                    - add_text_block: Add a manual text section. Parameters: {}
                    - delete_block: Remove a section. Parameters: {}
                    - update_block: Update section content. Parameters: {}
                    - generate_document: Generate the full document. Parameters: {}
                    - export_markdown: Export as Markdown. Parameters: {}
                    - export_docx: Export as Word document. Parameters: {}
                    - reset_document: Clear and start over. Parameters: {}
                    - help: Show available commands. Parameters: {}
                    
                    You MUST respond with ONLY a JSON object (no markdown, no explanation) with these keys:
                    - "action": one of the actions above
                    - "parameters": dict of parameters for that action
                    - "confidence": float 0-1 how confident you are
                    - "response": a friendly message to show the user about what you're doing
                    
                    Example input: "Create a document about machine learning"
                    Example output: {"action": "create_outline", "parameters": {"topic": "machine learning"}, "confidence": 0.95, "response": "Creating a document outline about machine learning..."}
                    """,
                    result_type=str,
                )
                print(f"DocumentAssistant: using model {model_id}")
            except Exception as e:
                print(f"DocumentAssistant: failed to init agent: {e}")
                self.agent = None
        else:
            self.agent = None
        
        # Simple pattern matching for common commands (fallback)
        self.patterns = {
            r"create.*(document|outline).*about (.+)": ("create_outline", self._extract_topic),
            r"add.*(section|block).*(?:about|on|for) (.+)": ("add_ai_block", self._extract_topic),
            r"generate.*document": ("generate_document", lambda m: {}),
            r"export.*(?:as )?(word|docx)": ("export_docx", lambda m: {}),
            r"export.*(?:as )?(markdown|md)": ("export_markdown", lambda m: {}),
            r"delete.*(?:section|block)": ("delete_block", lambda m: {}),
            r"reset|clear|start over": ("reset_document", lambda m: {}),
            r"help|commands|what can you do": ("help", lambda m: {}),
        }
    
    def _extract_topic(self, match) -> Dict[str, str]:
        """Extract topic from regex match"""
        topic = match.group(2) if match.lastindex >= 2 else match.group(1)
        return {"topic": topic}
    
    async def parse_intent(self, message: str, context: Dict[str, Any]) -> CommandIntent:
        """Parse user message into structured intent using AI or patterns"""
        
        if self.agent:
            try:
                result = await self.agent.run(
                    f"Parse this command: {message}\nCurrent context: Has {len(context.get('blocks', []))} blocks"
                )
                
                response_text = result.data
                print(f"AI agent result: {response_text}")
                
                # Strip markdown code fencing if present
                if isinstance(response_text, str):
                    text = response_text.strip()
                    if text.startswith("```"):
                        text = re.sub(r"^```(?:json)?\s*", "", text)
                        text = re.sub(r"\s*```$", "", text)
                    intent_data = json.loads(text)
                    return CommandIntent(**intent_data)
            except Exception as e:
                print(f"AI parsing failed: {e}, falling back to patterns")
        else:
            print("No AI agent available, using pattern matching")
        
        # Fallback to pattern matching
        message_lower = message.lower().strip()
        
        for pattern, (action, param_extractor) in self.patterns.items():
            match = re.search(pattern, message_lower)
            if match:
                params = param_extractor(match)
                print(f"Pattern matched: action={action}, params={params}")
                return CommandIntent(
                    action=action,
                    parameters=params,
                    confidence=0.8,
                    response=self._get_response_for_action(action, params)
                )
        
        # Unknown command
        return CommandIntent(
            action="unknown",
            parameters={},
            confidence=0.0,
            response="I didn't understand that command. Type 'help' to see what I can do."
        )
    
    def _get_response_for_action(self, action: str, params: Dict) -> str:
        """Generate friendly response for action"""
        responses = {
            "create_outline": f"Creating document outline about {params.get('topic', 'your topic')}...",
            "add_ai_block": f"Adding section about {params.get('topic', 'that topic')}...",
            "add_text_block": "Adding a text section for you to edit...",
            "generate_document": "Generating the full document content...",
            "export_docx": "Exporting document as Word file...",
            "export_markdown": "Exporting document as Markdown...",
            "delete_block": "Removing the selected section...",
            "reset_document": "Clearing the document to start fresh...",
            "help": "Here's what I can help you with:\n• Create document outlines\n• Add/edit sections\n• Generate content\n• Export documents\n• Manage resources"
        }
        return responses.get(action, "Processing your request...")
    
    async def execute_command(
        self,
        intent: CommandIntent,
        app_functions: Dict[str, callable],
        current_state: Dict[str, Any]
    ) -> Tuple[Any, str]:
        """Execute the parsed command using app functions"""
        
        if intent.action == "unknown":
            return None, intent.response
        
        if intent.action == "help":
            return None, intent.response
        
        # Map intent actions to actual function calls
        action_mapping = {
            "create_outline": lambda: app_functions["handle_start_draft_click"](
                intent.parameters.get("topic", ""),
                current_state.get("resources", []),
                current_state.get("session_id")
            ),
            "add_ai_block": lambda: app_functions["add_ai_block"](
                current_state.get("blocks", []),
                current_state.get("focused_block_id")
            ),
            "add_text_block": lambda: app_functions["add_text_block"](
                current_state.get("blocks", []),
                current_state.get("focused_block_id")
            ),
            "generate_document": lambda: app_functions["handle_document_generation"](
                "",  # title
                "",  # description
                current_state.get("resources", []),
                current_state.get("blocks", []),
                current_state.get("session_id")
            ),
            "export_docx": lambda: app_functions["handle_download_click"](
                current_state.get("blocks", []),
                "docx"
            ),
            "export_markdown": lambda: app_functions["handle_download_click"](
                current_state.get("blocks", []),
                "md"
            ),
            "delete_block": lambda: app_functions["delete_block"](
                current_state.get("blocks", []),
                current_state.get("focused_block_id")
            ),
            "reset_document": lambda: app_functions["reset_document"](),
        }
        
        if intent.action in action_mapping:
            try:
                import inspect
                result = action_mapping[intent.action]()
                # Await if the function returned a coroutine
                if inspect.iscoroutine(result):
                    result = await result
                return result, intent.response
            except Exception as e:
                return None, f"Error executing command: {str(e)}"
        
        return None, "Command recognized but not yet implemented."


def create_chatbot_interface():
    """Create the Gradio chatbot interface components"""
    
    with gr.Column():
        gr.Markdown("### 🤖 Document Assistant")
        gr.Markdown("Ask me to help create, edit, or manage your document!")
        
        chatbot = gr.Chatbot(
            height=150,
            placeholder="Type a command to get started...",
            bubble_full_width=False,
            elem_classes="assistant-chatbot"
        )
        
        with gr.Row():
            msg_input = gr.Textbox(
                placeholder="Try: 'Create a document about machine learning' or 'Add a section on neural networks'",
                show_label=False,
                scale=4,
                lines=1
            )
            send_btn = gr.Button("Send", variant="primary", scale=1)
            clear_btn = gr.Button("Clear", scale=1)
        
        with gr.Accordion("📚 Available Commands", open=False):
            gr.Markdown("""
            **Document Creation:**
            - "Create a document about [topic]"
            - "Start an outline for [topic]"
            
            **Section Management:**
            - "Add a section about [topic]"
            - "Add a text block"
            - "Delete this section"
            - "Update the section content"
            
            **Generation & Export:**
            - "Generate the document"
            - "Export as Word"
            - "Export as Markdown"
            
            **Other:**
            - "Reset/Clear document"
            - "Help" - Show commands
            """)
    
    return chatbot, msg_input, send_btn, clear_btn


async def _async_handle(assistant, message, context, app_functions):
    """Async helper to parse intent and execute command."""
    intent = await assistant.parse_intent(message, context)
    result, response = await assistant.execute_command(intent, app_functions, context)
    return intent, result, response


def handle_chat_message(
    message: str,
    history: List[List[str]],
    blocks_state: List[Dict],
    resources_state: List[Dict],
    session_id: str,
    focused_block_id: Optional[str],
    app_functions: Dict[str, callable]
) -> Tuple[List[List[str]], List[Dict], List[Dict], Optional[str]]:
    """Process chat message and execute commands (synchronous version)"""
    
    if not message:
        return history, blocks_state, resources_state, None
    
    # Reset generated content tracker
    handle_chat_message._last_generated_content = None
    
    # Initialize assistant (could cache this)
    assistant = DocumentAssistant()
    
    # Prepare context
    context = {
        "blocks": blocks_state,
        "resources": resources_state,
        "session_id": session_id,
        "focused_block_id": focused_block_id
    }
    
    # Run async code - use nest_asyncio-style approach for running inside existing loop
    try:
        loop = asyncio.get_running_loop()
        # We're inside an existing event loop (Gradio's), use a new thread
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, _async_handle(assistant, message, context, app_functions))
            intent, result, response = future.result()
    except RuntimeError:
        # No running loop, safe to use asyncio.run
        intent, result, response = asyncio.run(_async_handle(assistant, message, context, app_functions))
    
    # Update history
    history.append([message, response])
    
    # Return updated states based on action
    if intent.action == "create_outline" and result:
        # handle_start_draft_click returns a large tuple for Gradio outputs
        # Extract blocks (index 3) and resources (index 2) from the tuple
        if isinstance(result, tuple) and len(result) >= 4:
            new_blocks = result[3]
            new_resources = result[2]
            # gr.update() objects aren't usable - check for actual list data
            if isinstance(new_blocks, list):
                return history, new_blocks, resources_state, response
            if isinstance(new_resources, list):
                return history, blocks_state, new_resources, response
        return history, blocks_state, resources_state, response
    elif intent.action in ["add_ai_block", "add_text_block", "delete_block"] and result:
        # These return updated blocks list directly
        if isinstance(result, list):
            return history, result, resources_state, response
        return history, blocks_state, resources_state, response
    elif intent.action == "generate_document" and result:
        # handle_document_generation returns (json_str, generated_content, docx_path, md_path)
        if isinstance(result, tuple) and len(result) >= 2:
            generated_content = result[1]
            if generated_content and isinstance(generated_content, str):
                handle_chat_message._last_generated_content = generated_content
        return history, blocks_state, resources_state, response
    elif intent.action in ["export_docx", "export_markdown"] and result:
        return history, blocks_state, resources_state, f"{response}\n\nFile ready: {result}"
    elif intent.action == "reset_document" and result:
        if isinstance(result, tuple) and len(result) >= 4:
            new_resources = result[2]
            new_blocks = result[3]
            if isinstance(new_blocks, list):
                return history, new_blocks, new_resources if isinstance(new_resources, list) else [], response
        return history, [], [], response
    else:
        return history, blocks_state, resources_state, response