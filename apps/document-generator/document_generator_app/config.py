"""Configuration settings for the Document Generator V2 app."""

import os


class Settings:
    """Configuration settings for the Document Generator app."""

    # App settings
    app_title: str = "Document Generator"
    app_description: str = "Create structured documents with AI assistance"

    # LLM Configuration
    llm_provider: str = os.getenv("LLM_PROVIDER", "anthropic")  # "anthropic", "openai", or "azure"
    default_model: str = os.getenv("DEFAULT_MODEL", "claude-sonnet-4-20250514")

    @property
    def model_id(self) -> str:
        """Get the full model ID for recipe-executor."""
        return f"{self.llm_provider}/{self.default_model}"


# Create global settings instance
settings = Settings()
