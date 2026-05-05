# Owly Agent Backend

Standalone Flask service for the agentic video editor.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Install FFmpeg separately for silence detection:

```bash
brew install ffmpeg
```

## Environment

```bash
GEMINI_API_KEY=...
API_KEY=optional-shared-secret
PORT=5001
```

## Run

```bash
python app.py
```
