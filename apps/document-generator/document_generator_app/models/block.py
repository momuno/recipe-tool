"""
Block data model for content blocks in the Document Generator app.
Defines the Block dataclass with serialization utilities.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import uuid


@dataclass
class Block:
    """Represents a content block in the document."""

    id: str
    type: str  # "ai", "text", "heading"
    heading: str
    content: str
    resources: List[str] = field(default_factory=list)  # Resource keys for AI blocks
    collapsed: bool = True
    indent_level: int = 0

    @classmethod
    def create_ai_block(cls, heading: str = "", content: str = "", indent_level: int = 0) -> "Block":
        """Create a new AI block with default values."""
        return cls(
            id=str(uuid.uuid4()),
            type="ai",
            heading=heading,
            content=content,
            resources=[],
            collapsed=True,
            indent_level=indent_level,
        )

    @classmethod
    def create_text_block(cls, heading: str = "", content: str = "", indent_level: int = 0) -> "Block":
        """Create a new text block with default values."""
        return cls(
            id=str(uuid.uuid4()),
            type="text",
            heading=heading,
            content=content,
            resources=[],
            collapsed=True,
            indent_level=indent_level,
        )

    @classmethod
    def create_heading_block(cls, content: str = "Heading", indent_level: int = 0) -> "Block":
        """Create a new heading block with default values."""
        return cls(
            id=str(uuid.uuid4()),
            type="heading",
            heading="",  # Heading blocks don't use the heading field
            content=content,
            resources=[],
            collapsed=True,
            indent_level=indent_level,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert block to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "type": self.type,
            "heading": self.heading,
            "content": self.content,
            "resources": self.resources,
            "collapsed": self.collapsed,
            "indent_level": self.indent_level,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Block":
        """Create Block instance from dictionary."""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            type=data.get("type", "text"),
            heading=data.get("heading", ""),
            content=data.get("content", ""),
            resources=data.get("resources", []),
            collapsed=data.get("collapsed", True),
            indent_level=data.get("indent_level", 0),
        )
