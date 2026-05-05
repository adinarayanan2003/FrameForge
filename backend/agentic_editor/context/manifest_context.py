from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from agentic_editor.types import EditManifest
from agentic_editor.context.asset_fetcher import AssetFetcher
import logging

logger = logging.getLogger(__name__)

@dataclass
class ManifestContext:
    """
    Rich context derived from the EditManifest.
    Provides easy access to clips by type, total duration, and source assets.
    """
    job_id: str
    total_duration: float
    clip_count: int
    video_clips: List[Dict[str, Any]] = field(default_factory=list)
    audio_clips: List[Dict[str, Any]] = field(default_factory=list)
    subtitle_clips: List[Dict[str, Any]] = field(default_factory=list)
    phantom_clips: List[Dict[str, Any]] = field(default_factory=list)
    
    # Source asset info
    source_video_url: Optional[str] = None
    source_video_local_path: Optional[str] = None
    
    # Derived info
    timeline_summary: str = ""
    transcript: Optional[str] = None
    visual_summary: Optional[str] = None

class ManifestContextBuilder:
    def __init__(self, asset_fetcher: AssetFetcher):
        self.asset_fetcher = asset_fetcher

    async def build(self, manifest: EditManifest) -> ManifestContext:
        """
        Construct a ManifestContext from a raw EditManifest.
        Optionally downloads the source video to a local path.
        """
        # 1. Basic Metadata
        ctx = ManifestContext(
            job_id=manifest.job_id or manifest.jobId or "unknown",
            total_duration=manifest.timeline.get("duration", 0) if manifest.timeline else 0,
            clip_count=len(manifest.clips),
        )

        # 2. Categorize Clips
        for clip in manifest.clips:
            c_type = clip.get("type", "unknown")
            if c_type == "video":
                ctx.video_clips.append(clip)
            elif c_type == "audio":
                ctx.audio_clips.append(clip)
            elif c_type == "text" or c_type == "subtitle":
                ctx.subtitle_clips.append(clip)
                
        # 3. Extract Source Video
        if manifest.source:
            # Handle source as dict or object (Pydantic model v1/v2 compat)
            source = manifest.source
            if isinstance(source, dict):
                ctx.source_video_url = source.get("videoUrl")
            else:
                ctx.source_video_url = getattr(source, "videoUrl", None)

        # 4. Generate Summary
        ctx.timeline_summary = (
            f"Timeline ('{ctx.job_id}'): {ctx.total_duration:.2f}s duration. "
            f"Contains {len(ctx.video_clips)} video clips, {len(ctx.audio_clips)} audio clips, "
            f"and {len(ctx.subtitle_clips)} text overlays."
        )

        return ctx

    async def ensure_assets_local(self, ctx: ManifestContext):
        """
        Ensure critical assets (like source video) are downloaded locally.
        Modifies ctx in-place.
        """
        if ctx.source_video_url and not ctx.source_video_local_path:
            try:
                logger.info(f"Downloading source video from {ctx.source_video_url}...")
                local_path = await self.asset_fetcher.fetch_asset(ctx.source_video_url)
                ctx.source_video_local_path = local_path
                logger.info(f"Source video available at {local_path}")
            except Exception as e:
                logger.error(f"Failed to fetch source video: {e}")
