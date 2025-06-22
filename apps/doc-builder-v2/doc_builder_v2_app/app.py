import gradio as gr
from pathlib import Path
import uuid

class DocBuilderApp:
    def __init__(self):
        self.max_blocks = 20  # Maximum number of blocks to support
        
    def create_app(self):
        """Create and return the Document Builder Gradio app using native components."""
        
        # Load custom CSS
        css_path = Path(__file__).parent / "static" / "css" / "styles_native.css"
        if css_path.exists():
            with open(css_path, "r") as f:
                custom_css = f.read()
        else:
            custom_css = ""

        with gr.Blocks(css=custom_css, title="Document Builder") as app:
            # Initialize state
            blocks_data = gr.State([
                {
                    'id': str(uuid.uuid4()),
                    'type': 'ai',
                    'heading': 'Section 1',
                    'content': '',
                    'resources': [],
                    'visible': True
                },
                {
                    'id': str(uuid.uuid4()),
                    'type': 'text',
                    'heading': 'Section 2',
                    'content': '',
                    'resources': [],
                    'visible': True
                }
            ])
            resources_state = gr.State([])
            
            with gr.Row():
                # App name and explanation
                with gr.Column():
                    gr.Markdown("# Document Builder")
                    gr.Markdown(
                        "A tool for creating structured documents with customizable sections, "
                        "templates, and formatting options. Build professional documents "
                        "efficiently with an intuitive interface."
                    )

                # Import and Save buttons
                with gr.Column():
                    with gr.Row():
                        gr.HTML("<div style='flex: 1;'></div>")
                        import_builder_btn = gr.Button(
                            "Import Builder",
                            variant="secondary",
                            size="sm"
                        )
                        save_builder_btn = gr.Button(
                            "Save Builder",
                            variant="primary",
                            size="sm"
                        )

            # Document title and description
            with gr.Row():
                doc_title = gr.Textbox(
                    value="Document Title",
                    placeholder="Enter document title",
                    label="Document Title",
                    scale=1
                )
                doc_description = gr.Textbox(
                    value="",
                    placeholder="Explain what this document is about. Include specifics such as purpose, audience, style, format, etc.",
                    label="Document Description",
                    scale=3
                )

            # Main content area
            with gr.Row():
                # Resources column
                with gr.Column(scale=1):
                    gr.Markdown("### Resources")
                    file_upload = gr.File(
                        label="Upload Resources",
                        file_count="multiple",
                        file_types=["image", ".pdf", ".txt", ".md", ".doc", ".docx"]
                    )
                    resources_display = gr.Markdown("*No resources uploaded yet*")

                # Workspace column
                with gr.Column(scale=2):
                    with gr.Row():
                        ai_btn = gr.Button("Add AI Block", variant="primary", size="sm")
                        text_btn = gr.Button("Add Text Block", variant="secondary", size="sm")
                    
                    # Container for all blocks
                    blocks_container = gr.Group()
                    
                    # Create all block components (initially hidden)
                    block_components = []
                    
                    for i in range(self.max_blocks):
                        with blocks_container:
                            with gr.Group(visible=False) as block_group:
                                with gr.Row():
                                    block_type_label = gr.Markdown("", elem_classes="block-type-label")
                                    delete_btn = gr.Button("×", size="sm", elem_classes="delete-btn")
                                
                                heading_input = gr.Textbox(
                                    label="Heading",
                                    placeholder="Enter heading (optional)",
                                    elem_classes="block-heading"
                                )
                                
                                content_input = gr.Textbox(
                                    label="Content",
                                    placeholder="Enter content...",
                                    lines=5,
                                    elem_classes="block-content"
                                )
                                
                                resources_info = gr.Markdown("*Drop resources here*", elem_classes="block-resources-info")
                                
                                block_components.append({
                                    'group': block_group,
                                    'type_label': block_type_label,
                                    'heading': heading_input,
                                    'content': content_input,
                                    'resources': resources_info,
                                    'delete': delete_btn,
                                    'index': i
                                })

                # Generated document column
                with gr.Column(scale=1):
                    with gr.Row():
                        generate_doc_btn = gr.Button("Generate Document", variant="primary", size="sm")
                        save_doc_btn = gr.Button("Save Document", variant="secondary", size="sm")
                    
                    generated_content = gr.Markdown(
                        "*Click 'Generate Document' to see the generated content here*"
                    )

            # Update functions
            def add_block(blocks, block_type):
                """Add a new block of the specified type."""
                if len(blocks) < self.max_blocks:
                    new_block = {
                        'id': str(uuid.uuid4()),
                        'type': block_type,
                        'heading': '',
                        'content': '',
                        'resources': [],
                        'visible': True
                    }
                    blocks.append(new_block)
                return blocks
            
            def delete_block(blocks, index):
                """Delete a block at the specified index."""
                if index < len(blocks):
                    blocks.pop(index)
                return blocks
            
            def update_block_field(blocks, index, field, value):
                """Update a specific field of a block."""
                if index < len(blocks):
                    blocks[index][field] = value
                return blocks
            
            def sync_ui_with_blocks(blocks):
                """Sync the UI components with the blocks data."""
                updates = []
                
                for i, comp in enumerate(block_components):
                    if i < len(blocks):
                        block = blocks[i]
                        # Update visibility
                        updates.append(gr.update(visible=True))
                        
                        # Update type label
                        type_text = "**AI Block**" if block['type'] == 'ai' else "**Text Block**"
                        updates.append(gr.update(value=type_text))
                        
                        # Update heading
                        updates.append(gr.update(value=block.get('heading', '')))
                        
                        # Update content
                        updates.append(gr.update(value=block.get('content', '')))
                        
                        # Update resources
                        if block.get('resources'):
                            resources_text = f"*{len(block['resources'])} resources attached*"
                        else:
                            resources_text = "*Drop resources here*"
                        updates.append(gr.update(value=resources_text))
                        
                        # Delete button always visible
                        updates.append(gr.update())
                    else:
                        # Hide this block
                        updates.append(gr.update(visible=False))
                        updates.append(gr.update())  # type_label
                        updates.append(gr.update())  # heading
                        updates.append(gr.update())  # content
                        updates.append(gr.update())  # resources
                        updates.append(gr.update())  # delete
                
                return updates
            
            def handle_file_upload(files, current_resources):
                """Handle file uploads."""
                if not files:
                    return current_resources, gr.update()
                
                new_resources = current_resources.copy() if current_resources else []
                
                for file_path in files:
                    if file_path:
                        import os
                        file_name = os.path.basename(file_path)
                        file_ext = os.path.splitext(file_name)[1].lower()
                        is_image = file_ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
                        
                        new_resources.append({
                            'path': file_path,
                            'name': file_name,
                            'type': 'image' if is_image else 'file'
                        })
                
                # Update display
                if new_resources:
                    display_text = "### Uploaded Resources:\n"
                    for res in new_resources:
                        icon = "🖼️" if res['type'] == 'image' else "📄"
                        display_text += f"- {icon} {res['name']}\n"
                else:
                    display_text = "*No resources uploaded yet*"
                
                return new_resources, gr.update(value=display_text)
            
            def generate_document(blocks, title, description):
                """Generate document preview."""
                if not blocks:
                    return "No content blocks to generate from."
                
                output = f"# {title}\n\n"
                if description:
                    output += f"*{description}*\n\n---\n\n"
                
                for block in blocks:
                    if block.get('heading'):
                        output += f"## {block['heading']}\n\n"
                    
                    if block['type'] == 'ai':
                        output += f"**AI Instruction:** {block.get('content', '')}\n\n"
                    else:
                        output += f"{block.get('content', '')}\n\n"
                    
                    if block.get('resources'):
                        output += "**Resources:**\n"
                        for res in block['resources']:
                            output += f"- {res['name']}\n"
                        output += "\n"
                
                return output
            
            # Collect all component outputs for sync function
            all_component_outputs = []
            for comp in block_components:
                all_component_outputs.extend([
                    comp['group'],
                    comp['type_label'],
                    comp['heading'],
                    comp['content'],
                    comp['resources'],
                    comp['delete']
                ])
            
            # Wire up event handlers
            
            # Add block buttons
            ai_btn.click(
                fn=lambda blocks: add_block(blocks, 'ai'),
                inputs=[blocks_data],
                outputs=[blocks_data]
            ).then(
                fn=sync_ui_with_blocks,
                inputs=[blocks_data],
                outputs=all_component_outputs
            )
            
            text_btn.click(
                fn=lambda blocks: add_block(blocks, 'text'),
                inputs=[blocks_data],
                outputs=[blocks_data]
            ).then(
                fn=sync_ui_with_blocks,
                inputs=[blocks_data],
                outputs=all_component_outputs
            )
            
            # Delete buttons and field updates for each block
            for i, comp in enumerate(block_components):
                # Delete button
                comp['delete'].click(
                    fn=lambda blocks, idx=i: delete_block(blocks, idx),
                    inputs=[blocks_data],
                    outputs=[blocks_data]
                ).then(
                    fn=sync_ui_with_blocks,
                    inputs=[blocks_data],
                    outputs=all_component_outputs
                )
                
                # Heading change
                comp['heading'].change(
                    fn=lambda blocks, value, idx=i: update_block_field(blocks, idx, 'heading', value),
                    inputs=[blocks_data, comp['heading']],
                    outputs=[blocks_data]
                )
                
                # Content change
                comp['content'].change(
                    fn=lambda blocks, value, idx=i: update_block_field(blocks, idx, 'content', value),
                    inputs=[blocks_data, comp['content']],
                    outputs=[blocks_data]
                )
            
            # File upload
            file_upload.change(
                fn=handle_file_upload,
                inputs=[file_upload, resources_state],
                outputs=[resources_state, resources_display]
            )
            
            # Generate document
            generate_doc_btn.click(
                fn=generate_document,
                inputs=[blocks_data, doc_title, doc_description],
                outputs=[generated_content]
            )
            
            # Initial UI sync
            app.load(
                fn=sync_ui_with_blocks,
                inputs=[blocks_data],
                outputs=all_component_outputs
            )
            
        return app

def main():
    """Main entry point for the Document Builder app."""
    builder = DocBuilderApp()
    app = builder.create_app()
    app.launch()

if __name__ == "__main__":
    main()