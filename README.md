# Owly Video Editor

A modular timeline-based video editor for post-processing AI-generated videos from [Owly Studio](https://owly.studio).

## Overview

Owly Editor is a standalone React component library that provides timeline-based video editing capabilities. It integrates with the existing Owly Studio platform as a post-processing step after AI video generation.

## Architecture & Data Flow

Owly Editor uses a **"Write Once, Render Anywhere"** philosophy powered by Remotion.

### 1. The Edit Manifest (Single Source of Truth)
Everything transforms into a lightweight JSON object called the `EditManifest`. This JSON contains:
- Cut points (start/end times)
- Subtitle text and timing
- Audio levels and styling
- *No video data, only references to URLs*

### 2. Client-Side: The Preview (Instant)
**Where**: Browser (`/dashboard/editor/[id]`)
**What**: `@remotion/player`
**How**: 
- The React components (`VideoComposition`) read the JSON Manifest.
- They render HTML/CSS on top of a `<video>` tag.
- **Result**: Instant playback. No "rendering" or encoding happens here. It's just a web page updating in real-time.

### 3. Server-Side: The Render (High Quality)
**Where**: Backend / Cloud (AWS Lambda or Render Service)
**What**: `@remotion/cli` or `@remotion/lambda`
**How**:
- The **exact same** React components (`VideoComposition`) are loaded in a headless browser.
- Remotion steps through frame-by-frame, takes a screenshot of the DOM, and feeds it to FFmpeg.
- **Result**: A real MP4 file (`final_output.mp4`) where all your React components (subtitles, overlays) are burned into the pixels.

```mermaid
graph TD
    User[User Edits in UI] -->|Generates| JSON[EditManifest JSON]
    JSON -->|React Props| Player[Client Preview (Remotion Player)]
    JSON -->|API POST| Backend[Backend Workflow]
    Backend -->|Input| Lambda[Remotion Lambda/Renderer]
    Lambda -->|Uses| Comp[VideoComposition.tsx]
    Comp -->|Renders| MP4[Final .mp4 File]
```

## Features

### Core Editing
- **Timeline View**: Multi-track timeline with video, audio, and subtitle tracks
- **Clip Trimming**: Drag edges to trim clips with frame-accurate precision
- **Split & Delete**: Split clips at playhead (S key), delete unwanted sections
- **Reordering**: Drag & drop to reorder clips (logic implemented, UI pending)

### Video Preview
- **Real-time Preview**: Powered by Remotion Player
- **Playback Controls**: Play/pause, step frames, seek to position
- **Keyboard Shortcuts**: Space to play, arrow keys to navigate

### State Management
- **Undo/Redo**: Full history support for all editing actions
- **Edit Manifest**: Generates a JSON manifest describing all edits for backend rendering

## Installation

```bash
# From the owly_editor directory
npm install
```

## Development

```bash
# Start development server (Demo page)
npm run dev
# Open http://localhost:3001
```

## Testing

This module uses Vitest for unit testing core logic.

```bash
# Run tests
npm test
```

## Usage

```tsx
import { VideoEditor } from '@owly/editor'

function EditorPage({ video, shots }) {
  const handleSave = async (manifest) => {
    // Send manifest to backend
  }

  return (
    <VideoEditor
      video={video}
      shots={shots}
      onSave={handleSave}
      onClose={() => router.back()}
    />
  )
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `← / →` | Previous/Next frame |
| `Shift + ← / →` | Back/Forward 1 second |
| `S` | Split clip at playhead |
| `Delete` | Delete selected clip |
| `Cmd + Z` | Undo |
| `Cmd + Shift + Z` | Redo |

## Documentation

For more detailed information on setup and planning, see the following:
- [**System Design**](./docs/system_design.md) - How the backend integration works.
- [**Deployment Plan**](./docs/deployment_plan.md) - Step-by-step GCS and Cloud Run setup.
- [**Upcoming Features**](./docs/upcoming_plan.md) - Future roadmap and business value.

## Tech Stack

- **React 18**
- **Remotion**
- **Zustand** (with Immer)
- **Vitest**
- **Tailwind CSS**
