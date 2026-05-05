from typing import Dict, Any, List
import logging
import json
from agentic_editor.base_agent import BaseAgent, AgentState
from agentic_editor.types import AgentAction, AgentActionType, SubtitleStyle
from agentic_editor.perception.audio_ear import AudioEar

# Setup logger
logger = logging.getLogger(__name__)


# ============================================================================
# STYLE CONFIGURATIONS
# ============================================================================

STYLES = {
    "hormozi": {
        "style": SubtitleStyle(
            fontFamily="Komika Axis",
            fontSize=60,
            color="#FFFFFF",
            stroke="#000000",
            strokeWidth=4,
            highlightColor="#FACC15",
            backgroundColor="transparent",
            textAlign="center",
            verticalPosition=0.8,
            bold=True,
            italic=False,
            shadow=True,
            animation="pop_in"
        )
    },
    "minimalist": {
        "style": SubtitleStyle(
            fontFamily="Inter",
            fontSize=40,
            color="#FFFFFF",
            stroke="transparent",
            strokeWidth=0,
            highlightColor="#E5E7EB", # Light gray bold
            backgroundColor="#00000066", # Semi-transparent black
            textAlign="center",
            verticalPosition=0.85,
            bold=False,
            italic=False,
            shadow=False,
            animation="fade_in"
        )
    },
    "cinematic": {
        "style": SubtitleStyle(
            fontFamily="Playfair Display",
            fontSize=46,
            color="#FDE68A", # Light gold
            stroke="transparent",
            strokeWidth=0,
            highlightColor="#FFFFFF",
            backgroundColor="transparent",
            textAlign="center",
            verticalPosition=0.8,
            bold=False,
            italic=True,
            shadow=True,
            animation="slide_up"
        )
    },
    "beast": {
         "style": SubtitleStyle(
            fontFamily="Montserrat",
            fontSize=70,
            color="#FFFFFF",
            stroke="#000000",
            strokeWidth=6,
            highlightColor="#EF4444", # Red
            backgroundColor="transparent",
            textAlign="center",
            verticalPosition=0.5, # Center screen
            bold=True,
            italic=True,
            shadow=True,
            animation="pop_in"
        )
    }
}

class CaptionAgent(BaseAgent):
    """
    Agent responsible for generating captions.
    Uses AudioEar for word-level timestamps.
    Uses LLM for BOTH natural segmentation and highlight detection (via structured JSON).
    """
    def __init__(self, agent_id: str):
        super().__init__(agent_id)
        self.ear = AudioEar(model_size="base") 

    async def plan_node(self, state: AgentState) -> Dict[str, Any]:
        """
        Transcribe -> LLM (Segments + Highlights) -> Programmatic Actions
        """
        prompt = state['request'].prompt.lower()
        logger.info(f"[{self.agent_id}] Planning captions for: {prompt}")
        
        ctx = state.get("context")
        if not ctx or not ctx.source_video_local_path:
             return {
                 "reasoning": "No source video available for captioning.",
                 "actions": []
             }

        # 1. Transcribe
        logger.info(f"[{self.agent_id}] Transcribing audio...")
        try:
            transcript = self.ear.transcribe(ctx.source_video_local_path)
            words = [{"text": w.word, "start": w.start, "end": w.end} for w in transcript.words]
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            return {"reasoning": "Failed to transcribe audio.", "actions": []}
        
        # 2. Determine Style
        style_key = "hormozi" 
        
        # Check prompt first
        if "minimal" in prompt or "clean" in prompt or "professional" in prompt:
            style_key = "minimalist"
        elif "movie" in prompt or "cinema" in prompt:
            style_key = "cinematic"
        elif "beast" in prompt:
             style_key = "beast"
        elif "hormozi" in prompt or "alex" in prompt:
             style_key = "hormozi"
        else:
             # Check history for recent style requests
             history = state.get("conversation_history", [])
             for msg in reversed(history[-5:]): # Check last 5 messages
                 content = msg.get("content", "").lower()
                 if "minimal" in content: style_key = "minimalist"; break
                 if "cinematic" in content: style_key = "cinematic"; break
                 if "beast" in content: style_key = "beast"; break
                 if "hormozi" in content: style_key = "hormozi"; break
        
        logger.info(f"[{self.agent_id}] Selected style: {style_key}")
        base_style = STYLES[style_key]["style"]

        # 3. Call LLM for Natural Segmentation + Highlights
        # We send the word list and ask for a structured list of segments.
        llm_segments = self._get_segments_from_llm(words, style_key)
        
        # 4. Generate Actions
        actions = []
        for seg in llm_segments:
            # Construct styled text
            # seg is expected to be: [{"text": "word", "highlight": bool}, ...]
            formatted_words = []
            
            segment_text_parts = []
            seg_start = 100000.0
            seg_end = 0.0
            
            for word_obj in seg.get("words", []):
                # We need to find the timestamp for this word. 
                # Ideally LLM returns the index we sent it.
                idx = word_obj.get("index")
                if idx is not None and 0 <= idx < len(words):
                    original_word = words[idx]
                    seg_start = min(seg_start, original_word["start"])
                    seg_end = max(seg_end, original_word["end"])
                    
                    text = original_word["text"]
                    if word_obj.get("highlight", False):
                        text = f"*{text}*"
                    segment_text_parts.append(text)
            
            if not segment_text_parts: continue
            
            full_text = " ".join(segment_text_parts)
            
            if base_style.fontFamily == "Komika Axis" or base_style.fontFamily == "Montserrat":
                 full_text = full_text.upper()

            action = AgentAction(
                actionType=AgentActionType.ADD_CAPTION,
                startTime=seg_start,
                endTime=seg_end,
                text=full_text,
                style=base_style.model_dump()
            )
            actions.append(action)

        return {
            "reasoning": f"Generated {len(actions)} captions in '{style_key}' style.",
            "actions": actions
        }

    def _get_segments_from_llm(self, words: List[Dict], style_key: str) -> List[Dict]:
        """
        Asks LLM to group words into natural segments and identify highlights.
        Returns strict JSON structure.
        """
        from google import generativeai as genai
        import os
        
        # Input format: "0:hello 1:world 2:this ..."
        word_list_str = " ".join([f"{i}:{w['text']}" for i, w in enumerate(words)])
        
        system_prompt = f"""
        You are an expert video editor.
        Task: Group these words into natural, punchy caption segments for a "{style_key}" video.
        
        Style Guide:
        - "hormozi": Fast paced, 1-3 words max per segment. Highlight the most impactful word per segment.
        - "minimalist": Professional, 3-6 words per segment (complete phrases). Minimal highlights.
        - "cinematic": Elegant, 4-8 words per segment. No highlights usually.
        
        Input: A numbered list of words (e.g. "0:hello 1:world").
        Output: A JSON list of segments.
        
        JSON Schema:
        [
          {{
            "words": [
              {{ "index": 0, "highlight": false }},
              {{ "index": 1, "highlight": true }}
            ]
          }},
          ...
        ]
        
        Constraint: EVERY word index from input MUST be included exactly once, in order.
        """
        
        try:
            model = genai.GenerativeModel("gemini-3-flash-preview")
            logger.info(f"[{self.agent_id}] Requesting segmentation from LLM...")
            
            response = model.generate_content(
                f"{system_prompt}\n\nTranscript:\n{word_list_str}", 
                generation_config={"response_mime_type": "application/json"}
            )
            
            result = json.loads(response.text)
            # Handle list vs dict wrapper
            if isinstance(result, list): return result
            return result.get("segments", [])
            
        except Exception as e:
            logger.error(f"Failed LLM segmentation: {e}")
            # Fallback to simple programmatic chunking if LLM fails
            return self._fallback_segmentation(words, style_key)

    def _fallback_segmentation(self, words: List[Dict], style_key: str) -> List[Dict]:
        """Backup simple chunker"""
        # Default chunk size for fallback, can be made style-dependent if needed
        if style_key == "hormozi":
            chunk_size = 2
        elif style_key == "minimalist":
            chunk_size = 5
        elif style_key == "cinematic":
            chunk_size = 6
        elif style_key == "beast":
            chunk_size = 1
        else:
            chunk_size = 3 # Generic fallback

        segments = []
        for i in range(0, len(words), chunk_size):
            chunk = words[i:i+chunk_size]
            seg_words = []
            for j, _ in enumerate(chunk):
                seg_words.append({"index": i+j, "highlight": False}) # No highlights in fallback
            segments.append({"words": seg_words})
        return segments
