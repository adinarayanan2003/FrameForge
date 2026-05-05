import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent

_ENV_LOADED = False


def load_agent_env() -> None:
    """Load env files used by both the Next proxy and Python backend."""
    global _ENV_LOADED
    if _ENV_LOADED:
        return

    for env_file in (
        ROOT_DIR / ".env",
        ROOT_DIR / ".env.local",
        BACKEND_DIR / ".env",
        BACKEND_DIR / ".env.local",
    ):
        load_dotenv(env_file, override=False)

    _ENV_LOADED = True


def get_openai_api_key() -> Optional[str]:
    load_agent_env()
    return os.getenv("OPENAI_API_KEY")


def get_openai_model() -> str:
    load_agent_env()
    return os.getenv("OPENAI_MODEL", "gpt-5.2")


def get_openai_client():
    api_key = get_openai_api_key()
    if not api_key:
        return None

    from openai import OpenAI

    return OpenAI(api_key=api_key)
