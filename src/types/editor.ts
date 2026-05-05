/**
 * Owly Editor Type Definitions
 * 
 * Core types for the timeline-based video editor.
 * The EditManifest is the JSON output sent to the Remotion render backend.
 */

// ============================================================================
// SOURCE DATA TYPES (from Owly Studio)
// ============================================================================

export interface SourceVideo {
    /** Unique ID of the completed job */
    jobId: string
    /** Pre-signed URL to the source video */
    videoUrl: string
    /** Total duration in seconds */
    duration: number
    /** Video dimensions */
    width: number
    height: number
    /** Frame rate */
    fps: number
    /** Aspect ratio: '16:9' or '9:16' */
    aspectRatio: '16:9' | '9:16'
    /** Optional: Voiceover audio URL */
    voiceoverUrl?: string
    /** Optional: Background music URL */
    bgmUrl?: string
    /** Optional: SFX/extracted audio URL */
    sfxUrl?: string
}

export interface SourceShot {
    /** Shot ID from storyboard */
    shotId: string
    /** Shot number (1-indexed) */
    shotNumber: number
    /** Voiceover/narration text */
    voiceover: string
    /** Scene description */
    sceneDescription: string
    /** Start time in source video (seconds) */
    startTime: number
    /** End time in source video (seconds) */
    endTime: number
    /** Duration in seconds */
    duration: number
    /** First frame thumbnail URL */
    thumbnailUrl?: string
    /** Optional: Split video file for this specific shot (performance optimization) */
    videoUrl?: string
}

export interface SourceAudio {
    /** Audio track URL (if separate from video) */
    audioUrl?: string
    /** Whether video has embedded audio */
    hasEmbeddedAudio: boolean
}

// ============================================================================
// TIMELINE CLIP TYPES
// ============================================================================

export type ClipType = 'video' | 'audio' | 'subtitle' | 'overlay'

export interface BaseClip {
    /** Unique clip ID */
    id: string
    /** Clip type */
    type: ClipType
    /** Track index (0 = primary video, 1+ = overlay tracks) */
    track: number
    /** Start position on timeline (seconds) */
    timelineStart: number
    /** End position on timeline (seconds) */
    timelineEnd: number
    /** Locked (cannot be moved/edited) */
    locked: boolean
}

export interface VideoClip extends BaseClip {
    type: 'video'
    /** Source shot ID */
    shotId: string
    /** Custom video URL (for imported clips, otherwise uses source.videoUrl) */
    customVideoUrl?: string
    /** Trim: start offset in source (seconds) */
    sourceStart: number
    /** Trim: end offset in source (seconds) */
    sourceEnd: number
    /** Playback speed (1.0 = normal) */
    speed: number
    /** Video filters */
    filters: VideoFilters
    /** Volume (0-1) for integrated audio */
    volume: number
    /** Muted state for integrated audio */
    muted: boolean
}

/** Audio track types for multi-track architecture */
export type AudioTrackType = 'voiceover' | 'bgm' | 'sfx' | 'custom'

export interface AudioClip extends BaseClip {
    type: 'audio'
    /** Audio track type for production workflow */
    trackType: AudioTrackType
    /** Source: 'original' or custom audio URL */
    source: 'original' | string
    /** Trim: start offset in source */
    sourceStart: number
    /** Trim: end offset in source */
    sourceEnd: number
    /** Volume (0-1) */
    volume: number
    /** Fade in duration (seconds) */
    fadeIn: number
    /** Fade out duration (seconds) */
    fadeOut: number
    /** Muted */
    muted: boolean
}

export interface SubtitleClip extends BaseClip {
    type: 'subtitle'
    /** Subtitle text */
    text: string
    /** Text style */
    style: SubtitleStyle
}

export interface OverlayClip extends BaseClip {
    type: 'overlay'
    /** Overlay type */
    overlayType: 'text' | 'image' | 'logo'
    /** Content (text or image URL) */
    content: string
    /** Position and size */
    position: OverlayPosition
    /** Opacity (0-1) */
    opacity: number
}

export type Clip = VideoClip | AudioClip | SubtitleClip | OverlayClip

// ============================================================================
// STYLE TYPES
// ============================================================================

export interface VideoFilters {
    /** Brightness (-100 to 100) */
    brightness: number
    /** Contrast (-100 to 100) */
    contrast: number
    /** Saturation (-100 to 100) */
    saturation: number
}

export interface SubtitleStyle {
    /** Font family */
    fontFamily: string
    /** Font size in pixels */
    fontSize: number
    /** Font color (hex) */
    color: string
    /** Background color (hex with alpha) */
    backgroundColor: string
    /** Text alignment */
    textAlign: 'left' | 'center' | 'right'
    /** Vertical position (0 = top, 1 = bottom) */
    verticalPosition: number
    /** Bold */
    bold: boolean
    /** Italic */
    italic: boolean
    /** Text shadow */
    shadow: boolean
    /** Optional text stroke color */
    stroke?: string
    /** Optional text stroke width */
    strokeWidth?: number
    /** Optional highlighted-word color */
    highlightColor?: string
    /** Optional caption animation name */
    animation?: string
}

export interface OverlayPosition {
    /** X position (0-1, relative to video width) */
    x: number
    /** Y position (0-1, relative to video height) */
    y: number
    /** Width (0-1, relative to video width) */
    width: number
    /** Height (0-1, relative to video height) */
    height: number
    /** Rotation in degrees */
    rotation: number
}

// ============================================================================
// TRANSITION TYPES
// ============================================================================

export type TransitionType = 'none' | 'fade' | 'dissolve' | 'wipe' | 'slide'

export interface Transition {
    /** Unique transition ID */
    id: string
    /** Transition type */
    type: TransitionType
    /** Duration in seconds */
    duration: number
    /** Clip ID this transition applies after */
    afterClipId: string
    /** Optional incoming clip ID */
    beforeClipId?: string
}

// ============================================================================
// EDIT MANIFEST (JSON OUTPUT FOR REMOTION)
// ============================================================================

export interface EditManifest {
    /** Schema version for backwards compatibility */
    version: '1.0'
    /** Original job ID */
    jobId: string
    /** Created timestamp */
    createdAt: string
    /** Last modified timestamp */
    modifiedAt: string

    /** Source video metadata */
    source: SourceVideo

    /** Timeline configuration */
    timeline: {
        /** Total duration after edits (seconds) */
        duration: number
        /** Frame rate */
        fps: number
        /** Output dimensions */
        width: number
        height: number
        /** Output aspect ratio */
        aspectRatio: '16:9' | '9:16'
    }

    /** All clips on the timeline */
    clips: Clip[]

    /** Transitions between clips */
    transitions: Transition[]

    /** Global audio settings */
    audio: {
        /** Master volume (0-1) */
        masterVolume: number
        /** Normalize audio levels */
        normalize: boolean
    }

    /** Export settings */
    export: {
        /** Output format */
        format: 'mp4' | 'webm'
        /** Quality preset */
        quality: 'draft' | 'standard' | 'high'
        /** Include audio */
        includeAudio: boolean
        /** Aspect ratio */
        aspectRatio: '16:9' | '9:16'
        /** Width */
        width: number
        /** Height */
        height: number
    }
}

// ============================================================================
// EDITOR STATE TYPES
// ============================================================================

export interface EditorState {
    /** Source video data */
    source: SourceVideo | null
    /** Source shots from storyboard */
    shots: SourceShot[]
    /** Current timeline clips */
    clips: Clip[]
    /** Transitions */
    transitions: Transition[]
    /** Currently selected clip ID */
    selectedClipId: string | null
    /** Currently selected clip IDs */
    selectedClipIds: string[]
    /** Playhead position (seconds) */
    playheadPosition: number
    /** Playing state */
    isPlaying: boolean
    /** Timeline zoom level (pixels per second) */
    zoom: number
    /** Timeline scroll position */
    scrollX: number
    /** Undo/redo history */
    history: {
        past: EditorState[]
        future: EditorState[]
    }
    /** Global audio settings */
    audio: {
        masterVolume: number
        normalize: boolean
    }
    /** Export settings */
    exportSettings: {
        format: 'mp4' | 'webm'
        quality: 'draft' | 'standard' | 'high'
        includeAudio: boolean
        aspectRatio: '16:9' | '9:16'
        width: number
        height: number
    }
    /** Whether there are unsaved changes */
    isDirty: boolean
    /** Clipboard for copy/paste */
    clipboard: Clip | null
    /** Whether to show safe zone overlays */
    showSafeZones: boolean
    /** Non-persistent preview clips proposed by the agent */
    phantomClips: Clip[]
    /** Editor loading flag */
    isLoading?: boolean
    /** Editor error message */
    error?: string | null
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export type EditorAction =
    | { type: 'SET_SOURCE'; payload: SourceVideo }
    | { type: 'SET_SHOTS'; payload: SourceShot[] }
    | { type: 'ADD_CLIP'; payload: Clip }
    | { type: 'UPDATE_CLIP'; payload: { id: string; updates: Partial<Clip> } }
    | { type: 'DELETE_CLIP'; payload: string }
    | { type: 'SELECT_CLIP'; payload: string | null }
    | { type: 'MOVE_CLIP'; payload: { id: string; timelineStart: number } }
    | { type: 'TRIM_CLIP'; payload: { id: string; sourceStart?: number; sourceEnd?: number } }
    | { type: 'SPLIT_CLIP'; payload: { id: string; splitAt: number } }
    | { type: 'SET_PLAYHEAD'; payload: number }
    | { type: 'SET_PLAYING'; payload: boolean }
    | { type: 'SET_ZOOM'; payload: number }
    | { type: 'SET_SCROLL_X'; payload: number }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'SET_AUDIO'; payload: Partial<EditorState['audio']> }
    | { type: 'SET_EXPORT_SETTINGS'; payload: Partial<EditorState['exportSettings']> }
    | { type: 'MARK_SAVED' }
