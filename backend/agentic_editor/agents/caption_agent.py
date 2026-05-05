from typing import Dict, Any, List
import logging
import json
import os
import tempfile
from agentic_editor.base_agent import BaseAgent, AgentState
from agentic_editor.types import AgentAction, AgentActionType, SubtitleStyle
from agentic_editor.perception.audio_ear import AudioEar
from agentic_editor.llm import openai_text_response

# Setup logger
logger = logging.getLogger(__name__)


# ============================================================================
# STYLE CONFIGURATIONS
# ============================================================================

STYLES = {
    "hormozi": {
        "style": SubtitleStyle(
            fontFamily="Impact, Arial Black, sans-serif",
            fontSize=64,
            color="#FFFFFF",
            stroke="#000000",
            strokeWidth=5,
            highlightColor="#FACC15",
            backgroundColor="transparent",
            textAlign="center",
            verticalPosition=0.72,
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

    def _style_with_highlights(self, base_style: SubtitleStyle, highlight_words: List[str]) -> Dict[str, Any]:
        style = base_style.model_dump()
        style["highlightWords"] = [word.strip("* ").upper() for word in highlight_words if word.strip("* ")]
        return style

    def _filter_transcript_words(self, words: List[Dict]) -> List[Dict]:
        clean_words = []
        for word in words:
            text = str(word.get("text", "")).strip()
            probability = float(word.get("probability") or 0)
            start = word.get("start")
            end = word.get("end")
            if not text or start is None or end is None:
                continue
            if probability < 0.25:
                continue
            if text.lower() in {"music", "[music]", "(music)", "♪"}:
                continue
            clean_words.append({
                **word,
                "text": text,
            })
        return clean_words

    def _extract_frame(self, video_path: str, timestamp: float) -> str | None:
        import cv2

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return None

        fps = cap.get(cv2.CAP_PROP_FPS) or 24
        frame_no = max(0, int(timestamp * fps))
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
        ok, frame = cap.read()
        cap.release()
        if not ok:
            return None

        frame_path = os.path.join(tempfile.gettempdir(), f"frameforge-caption-frame-{os.getpid()}-{int(timestamp * 1000)}.jpg")
        cv2.imwrite(frame_path, frame)
        return frame_path

    def _fallback_visual_captions(self, video_path: str, duration: float, style_key: str) -> List[Dict]:
        midpoint = max(0.1, duration * 0.5)
        frame_path = self._extract_frame(video_path, midpoint)

        default_captions = [
            {"text": "NEW DROP", "startTime": max(0, duration * 0.10), "endTime": min(duration, duration * 0.32)},
            {"text": "BUILT TO STAND OUT", "startTime": max(0, duration * 0.40), "endTime": min(duration, duration * 0.63)},
            {"text": "MAKE A STATEMENT", "startTime": max(0, duration * 0.70), "endTime": min(duration, duration * 0.92)},
        ]

        if not frame_path:
            return default_captions

        try:
            from agentic_editor.config import get_openai_client, get_openai_model
            import base64

            client = get_openai_client()
            if client is None:
                return default_captions

            with open(frame_path, "rb") as image_file:
                data_url = "data:image/jpeg;base64," + base64.b64encode(image_file.read()).decode("ascii")

            response = client.responses.create(
                model=get_openai_model(),
                input=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Create 3 short, punchy caption overlays for this video frame. "
                                "This is visual/product captioning, not transcription. "
                                "Use 1-4 words each. Return JSON only as "
                                "{\"captions\":[{\"text\":\"...\"},{\"text\":\"...\"},{\"text\":\"...\"}]}."
                            ),
                        },
                        {"type": "input_image", "image_url": data_url},
                    ],
                }],
            )

            parsed = json.loads(response.output_text)
            texts = [str(item.get("text", "")).strip().upper() for item in parsed.get("captions", []) if item.get("text")]
            if not texts:
                return default_captions

            windows = [
                (max(0, duration * 0.10), min(duration, duration * 0.32)),
                (max(0, duration * 0.40), min(duration, duration * 0.63)),
                (max(0, duration * 0.70), min(duration, duration * 0.92)),
            ]
            return [
                {"text": text, "startTime": start, "endTime": end}
                for text, (start, end) in zip(texts[:3], windows)
                if end > start
            ]
        except Exception as exc:
            logger.warning("Visual fallback caption generation failed: %s", exc)
            return default_captions
        finally:
            try:
                os.unlink(frame_path)
            except OSError:
                pass

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
            words = self._filter_transcript_words([
                {"text": w.word, "start": w.start, "end": w.end, "probability": w.probability}
                for w in transcript.words
            ])
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

        # 3. Build segments from actual Whisper words.
        # Keep this deterministic by default so captions never invent text.
        visual_captions = []
        if len(words) < 2:
            logger.info("[%s] Transcript too sparse for captions; generating visual captions.", self.agent_id)
            visual_captions = self._fallback_visual_captions(ctx.source_video_local_path, ctx.total_duration, style_key)

        llm_segments = self._segment_words(words, style_key) if not visual_captions else []
        
        # 4. Generate Actions
        delete_actions = [
            AgentAction(actionType=AgentActionType.DELETE_CLIP, clipId=clip.get("id"))
            for clip in state["manifest"].clips
            if clip.get("type") in {"subtitle", "text"} and clip.get("id")
        ]
        actions = list(delete_actions)
        for visual_caption in visual_captions:
            text = visual_caption["text"].replace("*", "").strip().upper()
            highlight_words = []
            if "Impact" in base_style.fontFamily or base_style.fontFamily == "Montserrat":
                parts = text.split()
                if parts:
                    highlight_words = [parts[-1]]
                text = " ".join(parts).upper()

            actions.append(AgentAction(
                actionType=AgentActionType.ADD_CAPTION,
                startTime=visual_caption["startTime"],
                endTime=visual_caption["endTime"],
                text=text,
                style=self._style_with_highlights(base_style, highlight_words),
            ))

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
                        formatted_words.append(text.strip())
                    segment_text_parts.append(text)
            
            if not segment_text_parts: continue
            
            full_text = " ".join(segment_text_parts)
            
            if "Impact" in base_style.fontFamily or base_style.fontFamily == "Montserrat":
                 full_text = full_text.upper()

            action = AgentAction(
                actionType=AgentActionType.ADD_CAPTION,
                startTime=seg_start,
                endTime=seg_end,
                text=full_text,
                style=base_style.model_dump()
            )
            action.style = self._style_with_highlights(base_style, formatted_words)
            actions.append(action)

        return {
            "reasoning": f"Replaced existing captions and generated {len(actions) - len(delete_actions)} captions in '{style_key}' style.",
            "actions": actions
        }

    def _segment_words(self, words: List[Dict], style_key: str) -> List[Dict]:
        if not words:
            return []

        if style_key == "hormozi":
            chunk_size = 2
        elif style_key == "minimalist":
            chunk_size = 5
        elif style_key == "cinematic":
            chunk_size = 7
        elif style_key == "beast":
            chunk_size = 1
        else:
            chunk_size = 3

        segments = []
        for i in range(0, len(words), chunk_size):
            chunk = words[i:i + chunk_size]
            highlight_index = len(chunk) - 1 if style_key in {"hormozi", "beast"} else -1
            segments.append({
                "words": [
                    {"index": i + j, "highlight": j == highlight_index}
                    for j, _ in enumerate(chunk)
                ]
            })

        return segments

    def _get_segments_from_llm(self, words: List[Dict], style_key: str) -> List[Dict]:
        """
        Asks LLM to group words into natural segments and identify highlights.
        Returns strict JSON structure.
        """
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
            logger.info(f"[{self.agent_id}] Requesting segmentation from LLM...")

            response_text = openai_text_response(
                f"Transcript:\n{word_list_str}",
                instructions=system_prompt,
            )
            if response_text is None:
                logger.warning("OPENAI_API_KEY is not configured. Using fallback caption segmentation.")
                return self._fallback_segmentation(words, style_key)
            
            import re

            cleaned = response_text.strip()
            fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
            if fence_match:
                cleaned = fence_match.group(1).strip()

            result = json.loads(cleaned)
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
