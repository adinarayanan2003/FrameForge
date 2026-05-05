import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

@dataclass
class WordTimestamp:
    word: str
    start: float
    end: float
    probability: float

@dataclass
class Segment:
    start: float
    end: float
    text: str
    words: List[WordTimestamp] = field(default_factory=list)

@dataclass
class TranscriptResult:
    full_text: str
    segments: List[Segment]
    words: List[WordTimestamp]

class AudioEar:
    """
    Perception module for hearing audio.
    Uses local 'faster-whisper' for transcription with word-level timestamps.
    """
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self._model = None

    def _load_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                # 'cpu' or 'cuda' - auto-detect?
                device = "cuda" if os.environ.get("USE_CUDA") == "1" else "cpu"
                compute_type = "float16" if device == "cuda" else "int8"
                
                logger.info(f"Loading faster-whisper model '{self.model_size}' on {device}...")
                self._model = WhisperModel(self.model_size, device=device, compute_type=compute_type)
                logger.info("Model loaded.")
            except ImportError:
                logger.error("faster-whisper not installed. AudioEar will fail.")
                raise ImportError("Please install 'faster-whisper' to use AudioEar.")

    def transcribe(self, audio_path: str) -> TranscriptResult:
        """
        Transcribe audio file and return structured result.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        self._load_model()
        
        segments, info = self._model.transcribe(
            audio_path, 
            beam_size=5,
            word_timestamps=True
        )

        all_segments = []
        all_words = []
        full_text_parts = []

        logger.info(f"Transcribing {audio_path}...")
        
        for segment in segments:
            # Convert faster-whisper segment to our Segment dataclass
            seg_words = []
            if segment.words:
                for w in segment.words:
                    word_ts = WordTimestamp(
                        word=w.word,
                        start=w.start,
                        end=w.end,
                        probability=w.probability
                    )
                    seg_words.append(word_ts)
                    all_words.append(word_ts)
            
            all_segments.append(Segment(
                start=segment.start,
                end=segment.end,
                text=segment.text,
                words=seg_words
            ))
            full_text_parts.append(segment.text)

        return TranscriptResult(
            full_text=" ".join(full_text_parts),
            segments=all_segments,
            words=all_words
        )
