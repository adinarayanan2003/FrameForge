# Owly Editor: Upcoming Feature Roadmap

This document outlines the high-priority features identified for the next phases of development, categorized by business value and implementation complexity.

---

## ✅ Phase 2: Quick Wins (Completed)
*Focus: Essential UX improvements for a professional feel.*

### 1. Undo/Redo Visual Indicator (Toast)
- **Status**: ✅ Shipped
- **Description**: Toast notifications to give immediate feedback when actions are undone/redone.

### 2. Keyboard Shortcuts Modal
- **Status**: ✅ Shipped
- **Description**: Press `?` to see a cheatsheet of all available shortcuts, improving discoverability.

### 3. Audio Waveform Visualization
- **Status**: ✅ Shipped
- **Description**: Real-time waveform rendering for audio clips to allow for precise cutting and syncing.

### 4. Copy/Paste/Cut Clips
- **Status**: ✅ Shipped
- **Description**: Full clipboard support (`Cmd+C/V/X`) for all clip types.

---

## 🎯 Phase 3: AI Differentiation (Next Priority)
*Focus: Deeply integrating the editor with the Owly Studio AI engine.*

### 1. Auto-Captions (Whisper Integration)
- **Value**: Extremely High (Social video essential)
- **Complexity**: Moderate (API + UI)
- **Description**: "Generate Captions" button that sends audio to Whisper API, creates timed subtitles, and applies premium style presets (e.g., Hormozi style).

### 2. AI Shot Regeneration
- **Value**: Extremely High (Unique Differentiator)
- **Complexity**: High (Backend required)
- **Description**: Right-click a video clip → "Regenerate Shot". Calls backend with a scene prompt to swap the clip source with a new AI generation.

### 3. Smart Silence Removal
- **Value**: High (Podcast/talking head)
- **Complexity**: Moderate
- **Description**: Automatically detect and cut silent sections of voiceover tracks to tighten the edit.

### 4. Auto-Ducking (BGM under VO)
- **Value**: High (Polish)
- **Complexity**: Low (~1 day)
- **Description**: Automatically reduce background music volume (e.g., by 70%) when a voiceover clip is active.

---

## 🔮 Phase 4: Scaling & Polish

### 1. Transitions Library
- **Description**: Cross-Dissolve, Wipe, and Slide transitions with a visual picker.

### 2. Brand Kit / Asset Library
- **Description**: Cloud-synced library for saved logos, colors, and fonts for quick access.

### 3. Multi-Ratio Export (Batch)
- **Description**: Export 16:9, 9:16, and 1:1 versions of the same edit in a single click with AI smart reframing.

### 4. Collaborative Editing
- **Description**: Real-time multi-user editing and timeline comments.

---

## ❌ Deprioritized
- **One-Click LUTs**: Lower priority compared to AI features.
- **B-Roll AI Suggester**: High complexity, deferred to future research.
