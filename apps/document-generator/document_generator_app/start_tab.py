import gradio as gr

def create_start_tab():
    with gr.Tab("Draft", id="start_tab"):
        with gr.Column(elem_classes="start-tab-container"):
            # Big centered welcome message
            gr.Markdown("# Welcome to Document Generator", elem_classes="start-welcome-title")
            gr.Markdown("Draft once. Regenerate forever.", elem_classes="start-welcome-subtitle")

            # Single expanding card
            with gr.Column(elem_classes="start-input-card-container"):
                with gr.Column(elem_classes="start-input-card"):
                    gr.TextArea(
                        label="What document would you like to create?",
                        elem_classes="resource-drop-label",
                    )
                    # Example buttons container - always visible at the top
                    with gr.Column(elem_classes="start-examples-container"):
                        with gr.Row(elem_classes="start-examples-buttons"):
                            start_tab_example_code_readme_btn = gr.Button(
                                "📝 Code README", variant="secondary", size="sm", elem_classes="start-example-btn"
                            )
                            start_tab_example_product_launch_btn = gr.Button(
                                "🚀 Product Launch",
                                variant="secondary",
                                size="sm",
                                elem_classes="start-example-btn",
                            )
                            start_tab_example_performance_review_btn = gr.Button(
                                "📈 Performance Review",
                                variant="secondary",
                                size="sm",
                                elem_classes="start-example-btn",
                            )

                    # User prompt input
                    start_tab_prompt_input = gr.TextArea(
                        placeholder="Describe your structured document here...\n",
                        show_label=False,
                        elem_classes="start-prompt-input",
                        lines=4,
                        max_lines=10,
                        elem_id="start-prompt-input",
                        value="",  # Explicitly set initial value
                    )

                    # Error message component (hidden by default)
                    start_tab_error_message = gr.HTML(value="", visible=False, elem_classes="start-error-message")

                    # Expandable content within the same card
                    with gr.Column(elem_classes="start-expandable-content", elem_id="start-expandable-section"):
                        # Display attached references (above dropzone and button)
                        with gr.Column(elem_classes="start-resources-display-container"):
                            # Create a placeholder for the attached references display
                            start_tab_attached_references_display = gr.HTML(
                                value='<div class="start-resources-list"></div>',
                                elem_classes="start-resources-display",
                            )

                        # Upload area - full width
                        gr.TextArea(
                            label="Add reference files for AI context. (.docx, .md, .csv, .py, .json, .txt, etc.)",
                            elem_classes="resource-drop-label",
                        )
                        # File upload dropzone
                        start_file_upload = gr.File(
                            label="Drop files here or click to upload",
                            file_count="multiple",
                            file_types=SUPPORTED_FILE_TYPES,
                            elem_classes="start-file-upload-dropzone",
                            show_label=False,
                            height=90,
                        )

                        # Warning message for protected files
                        start_upload_warning = gr.HTML(visible=False)

                        # Draft button - full width below dropzone
                        get_started_btn = gr.Button(
                            "Draft",
                            variant="primary",
                            size="sm",
                            elem_classes="start-get-started-btn start-draft-btn",
                            elem_id="start-get-started-btn",
                        )

            # Main feature card with three examples
            with gr.Column(elem_classes="start-feature-card"):
                gr.Markdown("### Why Choose Document Generator?", elem_classes="start-feature-title")
                gr.Markdown(
                    "Build living document templates you control. Fine-tune sections, lock in what works, regenerate what needs updating. Perfect for content that evolves with your codebase, grows with new resources, or needs to stay current automatically.",
                    elem_classes="start-feature-description",
                )

                # Three feature columns
                with gr.Row(elem_classes="start-features-grid"):
                    with gr.Column(scale=1, elem_classes="start-feature-item"):
                        template_img_path = (
                            Path(__file__).parent / "static" / "images" / "template_control-removebg-preview.jpg"
                        )
                        gr.Image(
                            value=str(template_img_path),
                            show_label=False,
                            height=150,
                            container=False,
                            elem_classes="start-feature-image",
                            elem_id="template-control-image",
                            show_download_button=False,
                            show_fullscreen_button=False,
                            interactive=False,
                        )
                        gr.Markdown("### Template Control", elem_classes="start-feature-item-title")
                        gr.Markdown(
                            "Get started fast, then own the template. Update sections, adjust prompts, fine-tune your design. Maintain exactly the structure you need.",
                            elem_classes="start-feature-item-text",
                        )

                    with gr.Column(scale=1, elem_classes="start-feature-item"):
                        evergreen_img_path = (
                            Path(__file__).parent / "static" / "images" / "evergreen_content-removebg-preview.jpg"
                        )
                        gr.Image(
                            value=str(evergreen_img_path),
                            show_label=False,
                            height=150,
                            container=False,
                            elem_classes="start-feature-image",
                            elem_id="evergreen-content-image",
                            show_download_button=False,
                            show_fullscreen_button=False,
                            interactive=False,
                        )
                        gr.Markdown("### Evergreen Content", elem_classes="start-feature-item-title")
                        gr.Markdown(
                            "Link to evolving resources - code, docs, notes. Regenerate anytime to pull in the latest context. Perfect for READMEs, API docs, or any content that tracks changing information.",
                            elem_classes="start-feature-item-text",
                        )

                    with gr.Column(scale=1, elem_classes="start-feature-item"):
                        smart_img_path = (
                            Path(__file__).parent / "static" / "images" / "smart_regeneration-removebg-preview.jpg"
                        )
                        gr.Image(
                            value=str(smart_img_path),
                            show_label=False,
                            height=150,
                            container=False,
                            elem_classes="start-feature-image",
                            elem_id="smart-regeneration-image",
                            show_download_button=False,
                            show_fullscreen_button=False,
                            interactive=False,
                        )
                        gr.Markdown("### Smart Regeneration", elem_classes="start-feature-item-title")
                        gr.Markdown(
                            "Refresh while keeping refined content intact. Regenerate specific parts with new data - your polished introduction stays perfect while metrics update automatically.",
                            elem_classes="start-feature-item-text",
                        )

            # Process section
            with gr.Column(elem_classes="start-process-section"):
                gr.Markdown("## How It Works", elem_classes="start-process-title")
                gr.Markdown(
                    "Three simple steps to transform your ideas into polished documents",
                    elem_classes="start-process-subtitle",
                )

                with gr.Row(elem_classes="start-process-container"):
                    # Left side - Steps
                    with gr.Column(scale=1, elem_classes="start-process-steps-vertical"):
                        # Step 1
                        with gr.Row(elem_classes="start-process-step-vertical start-step-1"):
                            with gr.Column(scale=0, min_width=60, elem_classes="start-step-number-col"):
                                gr.Markdown("1", elem_classes="start-step-number-vertical")
                            with gr.Column(scale=1, elem_classes="start-step-content"):
                                gr.Markdown("### Draft Your Template", elem_classes="start-step-title")
                                gr.Markdown(
                                    "Start with AI assistance to create your initial document structure. Describe what you need and upload reference materials.",
                                    elem_classes="start-step-description",
                                )

                        # Step 2
                        with gr.Row(elem_classes="start-process-step-vertical start-step-2"):
                            with gr.Column(scale=0, min_width=60, elem_classes="start-step-number-col"):
                                gr.Markdown("2", elem_classes="start-step-number-vertical")
                            with gr.Column(scale=1, elem_classes="start-step-content"):
                                gr.Markdown("### Edit & Update", elem_classes="start-step-title")
                                gr.Markdown(
                                    "Refine your outline and keep resources current. Update reference files as content changes, adjust prompts, and reorganize sections to match your evolving needs.",
                                    elem_classes="start-step-description",
                                )

                        # Step 3
                        with gr.Row(elem_classes="start-process-step-vertical start-step-3"):
                            with gr.Column(scale=0, min_width=60, elem_classes="start-step-number-col"):
                                gr.Markdown("3", elem_classes="start-step-number-vertical")
                            with gr.Column(scale=1, elem_classes="start-step-content"):
                                gr.Markdown("### Generate & Export", elem_classes="start-step-title")
                                gr.Markdown(
                                    "Click generate to create your final document. Export in multiple formats and regenerate anytime with updated content.",
                                    elem_classes="start-step-description",
                                )

                    # Right side - Visual placeholder
                    with gr.Column(scale=1, elem_classes="start-process-visual"):
                        gr.HTML(
                            """
                            <div class="process-visual-placeholder">
                                <div class="visual-content">
                                    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                                        <!-- Document icon -->
                                        <rect x="100" y="50" width="200" height="250" rx="8" fill="#f0f9f9" stroke="#4a9d9e" stroke-width="2"/>

                                        <!-- Lines representing text -->
                                        <rect x="120" y="80" width="160" height="8" rx="4" fill="#4a9d9e" opacity="0.3"/>
                                        <rect x="120" y="100" width="140" height="8" rx="4" fill="#4a9d9e" opacity="0.3"/>
                                        <rect x="120" y="120" width="150" height="8" rx="4" fill="#4a9d9e" opacity="0.3"/>

                                        <!-- AI sparkle -->
                                        <g transform="translate(250, 70)">
                                            <path d="M0,-10 L3,-3 L10,0 L3,3 L0,10 L-3,3 L-10,0 L-3,-3 Z" fill="#4a9d9e" opacity="0.8"/>
                                        </g>

                                        <!-- Sections -->
                                        <rect x="120" y="150" width="160" height="40" rx="4" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="1"/>
                                        <rect x="120" y="200" width="160" height="40" rx="4" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="1"/>
                                        <rect x="120" y="250" width="160" height="40" rx="4" fill="#e8f5f5" stroke="#4a9d9e" stroke-width="1"/>
                                    </svg>
                                    <p class="visual-caption">Your document takes shape with AI assistance</p>
                                </div>
                            </div>
                        """,
                            elem_classes="start-process-visual-content",
                        )

    start_tab_example_code_readme_btn.click(
        fn=load_code_readme_example,
        inputs=[session_state],
        outputs=[start_tab_prompt_input, start_resources_state, session_state, start_tab_attached_references_display],
        queue=False,
    )

    start_tab_example_product_launch_btn.click(
        fn=load_product_launch_example,
        inputs=[session_state],
        outputs=[start_tab_prompt_input, start_resources_state, session_state, start_tab_attached_references_display],
        queue=False,
    )

    start_tab_example_performance_review_btn.click(
        fn=load_performance_review_example,
        inputs=[session_state],
        outputs=[start_tab_prompt_input, start_resources_state, session_state, start_tab_attached_references_display],
        queue=False,
    )