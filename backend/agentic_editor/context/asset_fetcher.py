import os
import hashlib
import aiohttp
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class AssetFetcher:
    """
    Downloads remote assets (GCS/HTTP) to a local cache directory 
    so they can be processed by tools like ffmpeg or Whisper.
    """
    
    def __init__(self, cache_dir: str = "/tmp/agentic_editor_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
    def _get_cache_path(self, url: str) -> Path:
        """Generate a deterministic cache path based on URL hash."""
        # Use SHA256 of URL to create a unique filename
        url_hash = hashlib.sha256(url.encode()).hexdigest()
        # Preserve extension if possible, else default to .bin
        ext = os.path.splitext(url.split("?")[0])[-1]
        if not ext:
            ext = ".bin"
        return self.cache_dir / f"{url_hash}{ext}"

    async def fetch_asset(self, url: str) -> str:
        """
        Download asset if not already cached. Returns absolute local path.
        """
        if not url:
            raise ValueError("Url cannot be empty")
            
        # If it's already a local path, just return it
        if os.path.exists(url):
            return url
            
        local_path = self._get_cache_path(url)
        
        if local_path.exists():
            logger.info(f"Asset cache hit: {local_path}")
            return str(local_path)
            
        logger.info(f"Downloading asset to {local_path}")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    response.raise_for_status()
                    with open(local_path, "wb") as f:
                        while True:
                            chunk = await response.content.read(8192)
                            if not chunk:
                                break
                            f.write(chunk)
                            
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
