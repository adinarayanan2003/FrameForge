import logging
from typing import Optional

from agentic_editor.config import get_openai_client, get_openai_model

logger = logging.getLogger(__name__)


def openai_text_response(
    prompt: str,
    *,
    instructions: Optional[str] = None,
    model: Optional[str] = None,
) -> Optional[str]:
    client = get_openai_client()
    if client is None:
        return None

    kwargs = {
        "model": model or get_openai_model(),
        "input": prompt,
    }
    if instructions:
        kwargs["instructions"] = instructions

    response = client.responses.create(**kwargs)
    return response.output_text.strip()
