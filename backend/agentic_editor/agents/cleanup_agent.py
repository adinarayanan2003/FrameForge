from typing import Dict, Any, List
import logging
from agentic_editor.base_agent import BaseAgent, AgentState
from agentic_editor.types import AgentAction
from agentic_editor.tools.audio_analysis import detect_silence_ranges
from agentic_editor.tools.edit_ops import compute_remove_ranges_actions

# Setup logger
logger = logging.getLogger(__name__)

class CleanupAgent(BaseAgent):
    """
    Agent responsible for cleaning up video/audio, specifically removing silence.
    Uses local asset cache for analysis.
    """
    
    async def plan_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Analyze request to remove silence and generate edit actions.
        """
        prompt = state['request'].prompt
        logger.info(f"CleanupAgent planning: {prompt}")
        
        ctx = state.get("context")
        if not ctx:
            return {
                "reasoning": "Context not built. Cannot analyze media.",
                "actions": []
            }
            
        if not ctx.source_video_local_path:
            return {
                "reasoning": "Source video not available locally for analysis. Check AssetFetcher logs.",
                "actions": []
            }
            
        # Identify target clip (naive: first video clip)
        if not ctx.video_clips:
             return {"reasoning": "No video clips found.", "actions": []}
             
        main_clip = ctx.video_clips[0]
        main_clip_id = main_clip.get("id")

        try:
            # Detect silence using local file
            logger.info(f"Analyzing silence in {ctx.source_video_local_path}...")
            
            # Use ffmpeg silence detection (-30dB, >0.5s)
            # Future: Use AudioEar VAD if word-level precision needed
            silence_ranges = detect_silence_ranges(
                ctx.source_video_local_path, 
                threshold_db="-30dB", 
                min_duration=0.5
            )
            
            if not silence_ranges:
                return {
                    "reasoning": "No significant silence detected (-30dB, >0.5s).",
                    "actions": []
                }
                
            # Generate REMOVE_RANGE actions
            actions = compute_remove_ranges_actions(silence_ranges, main_clip_id)
            
            count = len(actions)
            total_removed = sum(e - s for s, e in silence_ranges)
            
            return {
                "reasoning": f"Found {count} silent segments totaling {total_removed:.2f}s. Generated remove actions.",
                "actions": actions
            }

        except Exception as e:
            logger.error(f"Error in CleanupAgent: {e}")
            return {
                "reasoning": f"Failed to analyze audio: {str(e)}",
                "actions": []
            }
