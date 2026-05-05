import subprocess
import re
import math
from typing import List, Tuple
import os

def detect_silence_ranges(
    audio_path: str, 
    threshold_db: str = "-30dB", 
    min_duration: float = 0.5
) -> List[Tuple[float, float]]:
    """
    Analyze audio file to find silent segments using ffmpeg silencedetect.
    
    Args:
        audio_path: Path to the audio/video file.
        threshold_db: Audio threshold for silence (e.g. "-30dB").
        min_duration: Minimum duration of silence to detect (seconds).
        
    Returns:
        List of (start, end) timestamps for silent segments.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"File not found: {audio_path}")

    # Construct ffmpeg command
    cmd = [
        "ffmpeg",
        "-i", audio_path,
        "-af", f"silencedetect=noise={threshold_db}:d={min_duration}",
        "-f", "null",
        "-"
    ]

    try:
        # Run ffmpeg (output is in stderr)
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            check=True
        )
        output = result.stderr
        
        silence_ranges = []
        current_start = None
        
        # Parse output line by line
        # Sample output:
        # [silencedetect @ 0x...] silence_start: 4.234
        # [silencedetect @ 0x...] silence_end: 5.678 | silence_duration: 1.444
        
        for line in output.split('\n'):
            line = line.strip()
            if "silence_start:" in line:
                match = re.search(r"silence_start: ([\d\.]+)", line)
                if match:
                    current_start = float(match.group(1))
            
            elif "silence_end:" in line:
                match = re.search(r"silence_end: ([\d\.]+)", line)
                if match and current_start is not None:
                    end_time = float(match.group(1))
                    
                    # Ensure valid range
                    if end_time > current_start:
                        silence_ranges.append((current_start, end_time))
                    
                    current_start = None
                    
        return silence_ranges

    except subprocess.CalledProcessError as e:
        print(f"Error running ffmpeg: {e.stderr}")
        raise RuntimeError("Failed to analyze audio for silence") from e
    except Exception as e:
        print(f"Error parsing silence detection: {e}")
        return []
