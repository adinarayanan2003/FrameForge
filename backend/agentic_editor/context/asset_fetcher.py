import os
import hashlib
import asyncio
import logging
import shutil
from typing import Optional
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import urlopen

logger = logging.getLogger(__name__)

class AssetFetcher:
    """
    Downloads remote assets (GCS/HTTP) to a local cache directory 
    so they can be processed by tools like ffmpeg or Whisper.
    """
    
    def __init__(self, cache_dir: str = "/tmp/agentic_editor_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.project_root = Path(
            os.getenv("FRAMEFORGE_ROOT")
            or Path(__file__).resolve().parents[3]
        )
        self.public_dir = self.project_root / "public"
        
    def _get_cache_path(self, url: str) -> Path:
        """Generate a deterministic cache path based on URL hash."""
        # Use SHA256 of URL to create a unique filename
        url_hash = hashlib.sha256(url.encode()).hexdigest()
        # Preserve extension if possible, else default to .bin
        ext = os.path.splitext(url.split("?")[0])[-1]
        if not ext:
            ext = ".bin"
        return self.cache_dir / f"{url_hash}{ext}"

    def _resolve_local_asset(self, url: str) -> Optional[str]:
        parsed = urlparse(url)

        if parsed.scheme == "file":
            path = Path(unquote(parsed.path))
            return str(path) if path.exists() else None

        if parsed.scheme in {"http", "https"}:
            return None

        if parsed.scheme:
            raise ValueError(f"Unsupported asset URL scheme: {parsed.scheme}")

        candidates = []
        raw_path = Path(unquote(url))
        if raw_path.is_absolute():
            candidates.append(raw_path)
        else:
            relative = Path(unquote(url.lstrip("/")))
            candidates.append(self.public_dir / relative)
            candidates.append(self.project_root / relative)

        for candidate in candidates:
            if candidate.exists():
                return str(candidate)

        raise FileNotFoundError(
            f"Asset '{url}' is not a remote URL and was not found under {self.public_dir}"
        )

    def _download_asset_sync(self, url: str, local_path: Path) -> None:
        with urlopen(url, timeout=60) as response:
            with open(local_path, "wb") as file:
                shutil.copyfileobj(response, file)

    async def fetch_asset(self, url: str) -> str:
        """
        Download asset if not already cached. Returns absolute local path.
        """
        if not url:
            raise ValueError("Url cannot be empty")
            
        # If it's already a local path, just return it
        if os.path.exists(url):
            return url

        local_asset = self._resolve_local_asset(url)
        if local_asset:
            return local_asset
            
        local_path = self._get_cache_path(url)
        
        if local_path.exists():
            logger.info(f"Asset cache hit: {local_path}")
            return str(local_path)
            
        logger.info(f"Downloading asset to {local_path}")
        
        try:
            await asyncio.to_thread(self._download_asset_sync, url, local_path)
                            
            logger.info(f"Download complete: {local_path}")
            return str(local_path)
            
        except Exception as e:
            logger.error(f"Failed to download asset {url}: {e}")
            # Clean up partial download
            if local_path.exists():
                local_path.unlink()
            raise

    def cleanup(self):
        """Clear the cache directory."""
        try:
            for item in self.cache_dir.iterdir():
                if item.is_file():
                    item.unlink()
        except Exception as e:
            logger.error(f"Failed to cleanup cache: {e}")
