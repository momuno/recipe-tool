# Claude-Generated Architecture Diagram

```mermaid
classDiagram
    class DocumentGeneratorApp {
        +generate_document(outline, session_id)
        +markdown_to_docx(markdown_content)
        +extract_text_from_url(url)
    }

    class Outline {
        +title: str
        +general_instruction: str
        +resources: List[Resource]
        +sections: List[Section]
        +to_dict()
        +from_dict()
    }

    class Resource {
        +key: str
        +path: str
        +title: str
        +description: str
        +merge_mode: str
        +txt_path: Optional[str]
        +resource_type: Optional[str]
        +source_url: Optional[str]
    }

    class Section {
        +title: str
        +prompt: Optional[str]
        +refs: List[str]
        +resource_key: Optional[str]
        +sections: List[Section]
        +to_dict()
    }

    class RecipeExecutor {
        +execute(recipe, context)
    }

    class ResourceResolver {
        +resolve_all_resources(outline_data, session_id)
    }

    class SessionManager {
        +get_session_dir(session_id)
    }

    DocumentGeneratorApp --> Outline: uses
    DocumentGeneratorApp --> ResourceResolver: uses
    DocumentGeneratorApp --> SessionManager: uses
    DocumentGeneratorApp --> RecipeExecutor: invokes

    Outline "1" *-- "many" Resource: contains
    Outline "1" *-- "many" Section: contains
    Section "1" *-- "many" Section: recursive composition

    note "Data Flow:\n1. Create Outline\n2. Resolve Resources\n3. Execute Recipe\n4. Generate Document" as N1
```

## Generation Details
- Generated at: 2025-09-11 16:08:13
- Files analyzed: 12
- Model: claude-3-5-haiku-20241022

## Files Included
- apps/document-generator/document_generator_app
- apps/document-generator/document_generator_app/app.py
- apps/document-generator/document_generator_app/static
- apps/document-generator/document_generator_app/static/css
- apps/document-generator/document_generator_app/static/images
- apps/document-generator/document_generator_app/static/js
- apps/document-generator/document_generator_app/executor
- apps/document-generator/document_generator_app/executor/__init__.py
- apps/document-generator/document_generator_app/executor/runner.py
- apps/document-generator/document_generator_app/models
- apps/document-generator/document_generator_app/models/__init__.py
- apps/document-generator/document_generator_app/models/outline.py

## View Online
- [Mermaid Live Editor](https://mermaid.live)
- [GitHub](https://github.com) - supports Mermaid in README files
