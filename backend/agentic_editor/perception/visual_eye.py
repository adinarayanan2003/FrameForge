import logging
import os
import cv2
import base64
from typing import List, Optional, Dict
from dataclasses import dataclass
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Configure API key
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    logger.warning("GEMINI_API_KEY not found. VisualEye will fail.")

@dataclass
class FrameAnalysis:
    timestamp: float
    description: str
    objects: List[str]
    scene_type: str  # "talking_head", "b-roll", "screencast", "title_card", "other"

class VisualEye:
    """
    Perception module for seeing video content.
    Uses Gemini 3 Flash (Vision) to analyze frames.
    """
    def __init__(self, model_name: str = "gemini-3-flash-preview"):
        self.model_name = model_name
        self._model = None

    def _get_model(self):
        if self._model is None:
            # Fallback to standard 2.0 flash if preview ID fails or changes
            try:
                self._model = genai.GenerativeModel(self.model_name)
            except Exception:
                logger.warning(f"Model {self.model_name} not found, falling back to gemini-3-flash-preview")
                self._model = genai.GenerativeModel("gemini-3-flash-preview")
        return self._model

    def _extract_frame(self, video_path: str, timestamp: float) -> Optional[Dict]:
        """Extract a single frame as a PIL Image or bytes."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return None
            
        # Jump to timestamp
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_no = int(timestamp * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_no)
        
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return None
            
        # Convert BGR (OpenCV) to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        from PIL import Image
        return Image.fromarray(frame_rgb)

    async def analyze_frames(
        self, 
        video_path: str, 
        timestamps: List[float], 
        prompt: str = "Describe this scene in detail. Identify objects and scene type."
    ) -> List[FrameAnalysis]:
        """
        Analyze frames at specific timestamps.
        Optimized to send batch request if possible, or sequential.
        Gemini 1.5 Pro handles video natively, but here we simulate 'watching' specific points.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        model = self._get_model()
        results = []

        # For now, analyze one by one (or batch if we refactor)
        # TODO: Upgrade to use Gemini's native video capability (uploadFile) for whole-video understanding
        
        for ts in timestamps:
            image = self._extract_frame(video_path, ts)
            if not image:
                logger.warning(f"Could not extract frame at {ts}s")
                continue
                
            try:
                # Prompt for structured output
                # We can use JSON mode or just careful prompting
                response = model.generate_content([
                    prompt + 
                    "\nOutput format: JSON with keys 'description', 'objects' (list), 'scene_type'.",
                    image
                ])
                
                # Parse logic here (simplified for now)
                # In production, use strict JSON parsing or function calling
                text = response.text
                
                # Mock parsing - replace with regex or json.loads
                # This is a placeholder for robust parsing
                import json
                import re
                
                json_match = re.search(r"\{.*\}", text, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group(0))
                    results.append(FrameAnalysis(
                        timestamp=ts,
                        description=data.get("description", text[:50]),
                        objects=data.get("objects", []),
                        scene_type=data.get("scene_type", "unknown")
                    ))
                else:
                     results.append(FrameAnalysis(
                        timestamp=ts,
                        description=text,
                        objects=[],
                        scene_type="unknown"
                    ))

            except Exception as e:
                logger.error(f"Gemini analysis failed at {ts}s: {e}")
        
        return results
