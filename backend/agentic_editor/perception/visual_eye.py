import logging
import os
import cv2
import base64
from io import BytesIO
from typing import List, Optional, Dict
from dataclasses import dataclass
from agentic_editor.config import get_openai_client, get_openai_model

logger = logging.getLogger(__name__)

@dataclass
class FrameAnalysis:
    timestamp: float
    description: str
    objects: List[str]
    scene_type: str  # "talking_head", "b-roll", "screencast", "title_card", "other"

class VisualEye:
    """
    Perception module for seeing video content.
    Uses OpenAI vision-capable models to analyze frames.
    """
    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name

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

    def _image_to_data_url(self, image) -> str:
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=88)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

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

        client = get_openai_client()
        if client is None:
            raise RuntimeError("OPENAI_API_KEY is not configured.")

        model = self.model_name or get_openai_model()
        results = []

        for ts in timestamps:
            image = self._extract_frame(video_path, ts)
            if not image:
                logger.warning(f"Could not extract frame at {ts}s")
                continue
                
            try:
                response = client.responses.create(
                    model=model,
                    input=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": (
                                    prompt +
                                    "\nOutput JSON only with keys: description, objects, scene_type."
                                ),
                            },
                            {
                                "type": "input_image",
                                "image_url": self._image_to_data_url(image),
                            },
                        ],
                    }],
                )
                
                text = response.output_text
                
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
