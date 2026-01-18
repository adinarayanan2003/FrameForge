/**
 * Editor State Store
 * 
 * Zustand store for managing video editor state with undo/redo support.
 * Uses Immer for immutable updates.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
    EditorState,
    Clip,
    VideoClip,
    AudioClip,
    SubtitleClip,
    SourceVideo,
    SourceShot,
    Transition,
    EditManifest
} from '@/types/editor'

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: EditorState = {
    source: null,
    shots: [],
    clips: [],
    transitions: [],
    selectedClipId: null,
    playheadPosition: 0,
    isPlaying: false,
    zoom: 50, // pixels per second
    scrollX: 0,
    history: {
        past: [],
        future: [],
    },
    audio: {
        masterVolume: 1,
        normalize: false,
    },
    exportSettings: {
        format: 'mp4',
        quality: 'high',
        includeAudio: true,
    },
    isDirty: false,
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface EditorStore extends EditorState {
    // Source actions
    setSource: (source: SourceVideo) => void
    setShots: (shots: SourceShot[]) => void
    initializeFromShots: () => void

    // Clip actions
    addClip: (clip: Clip) => void
    updateClip: (id: string, updates: Partial<Clip>) => void
    deleteClip: (id: string) => void
    selectClip: (id: string | null) => void
    moveClip: (id: string, timelineStart: number) => void
    trimClip: (id: string, edge: 'start' | 'end', newValue: number) => void
    splitClipAtPlayhead: (id: string) => void

    // Playback actions
    setPlayheadPosition: (position: number) => void
    setIsPlaying: (playing: boolean) => void
    togglePlayback: () => void
    seekToStart: () => void
    seekToEnd: () => void
    stepForward: () => void
    stepBackward: () => void

    // Timeline view actions
    setZoom: (zoom: number) => void
    setScrollX: (scrollX: number) => void
    zoomIn: () => void
    zoomOut: () => void
    fitToView: () => void

    // History actions
    undo: () => void
    redo: () => void
    saveToHistory: () => void

    // Audio actions
    setMasterVolume: (volume: number) => void
    setNormalize: (normalize: boolean) => void

    // Export actions
    setExportSettings: (settings: Partial<EditorState['exportSettings']>) => void
    generateManifest: () => EditManifest | null

    // State actions
    markSaved: () => void
    reset: () => void
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useEditorStore = create<EditorStore>()(
    immer((set, get) => ({
        ...initialState,

        // ========== SOURCE ACTIONS ==========

        setSource: (source) => {
            set((state) => {
                state.source = source
                state.isDirty = true
            })
        },

        setShots: (shots) => {
            set((state) => {
                state.shots = shots
            })
        },

        initializeFromShots: () => {
            const { shots, source } = get()
            if (!shots.length || !source) return

            set((state) => {
                // Create video clips from shots
                const videoClips: VideoClip[] = shots.map((shot) => ({
                    id: `video-${shot.shotId}`,
                    type: 'video',
                    track: 0,
                    timelineStart: shot.startTime,
                    timelineEnd: shot.endTime,
                    locked: false,
                    shotId: shot.shotId,
                    sourceStart: shot.startTime,
                    sourceEnd: shot.endTime,
                    speed: 1,
                    filters: {
                        brightness: 0,
                        contrast: 0,
                        saturation: 0,
                    },
                    volume: 1,
                    muted: true,
                }))

                // Create subtitle clips from voiceovers
                const subtitleClips: SubtitleClip[] = shots.map((shot) => ({
                    id: `subtitle-${shot.shotId}`,
                    type: 'subtitle',
                    track: 1,
                    timelineStart: shot.startTime,
                    timelineEnd: shot.endTime,
                    locked: false,
                    text: shot.voiceover,
                    style: {
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 24,
                        color: '#FFFFFF',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        textAlign: 'center',
                        verticalPosition: 0.9,
                        bold: false,
                        italic: false,
                        shadow: true,
                    },
                }))

                // Create audio clip for entire video
                const audioClip: AudioClip = {
                    id: 'audio-main',
                    type: 'audio',
                    track: 2,
                    timelineStart: 0,
                    timelineEnd: source.duration,
                    locked: false,
                    source: 'original',
                    sourceStart: 0,
                    sourceEnd: source.duration,
                    volume: 1,
                    fadeIn: 0,
                    fadeOut: 0,
                    muted: false,
                }

                state.clips = [...videoClips, ...subtitleClips, audioClip]
                state.isDirty = false
            })
        },

        // ========== CLIP ACTIONS ==========

        addClip: (clip) => {
            get().saveToHistory()
            set((state) => {
                state.clips.push(clip)
                state.isDirty = true
            })
        },

        updateClip: (id, updates) => {
            get().saveToHistory()
            set((state) => {
                const index = state.clips.findIndex((c) => c.id === id)
                if (index !== -1) {
                    state.clips[index] = { ...state.clips[index], ...updates } as Clip
                    state.isDirty = true
                }
            })
        },

        deleteClip: (id) => {
            get().saveToHistory()
            set((state) => {
                state.clips = state.clips.filter((c) => c.id !== id)
                if (state.selectedClipId === id) {
                    state.selectedClipId = null
                }
                state.isDirty = true
            })
        },

        selectClip: (id) => {
            set((state) => {
                state.selectedClipId = id
            })
        },

        moveClip: (id, timelineStart) => {
            const clip = get().clips.find((c) => c.id === id)
            if (clip && !clip.locked && clip.timelineStart !== timelineStart) {
                // In a real app, debounce this. For tests, save on every move.
                get().saveToHistory()
                set((state) => {
                    const index = state.clips.findIndex((c) => c.id === id)
                    if (index !== -1) {
                        const c = state.clips[index]
                        const duration = c.timelineEnd - c.timelineStart
                        const start = Math.max(0, timelineStart)
                        state.clips[index].timelineStart = start
                        state.clips[index].timelineEnd = start + duration
                        state.isDirty = true
                    }
                })
            }
        },

        trimClip: (id, edge, newValue) => {
            const clip = get().clips.find((c) => c.id === id)
            if (clip && !clip.locked) {
                get().saveToHistory()
                set((state) => {
                    const index = state.clips.findIndex((c) => c.id === id)
                    if (index !== -1) {
                        const c = state.clips[index]
                        if (edge === 'start') {
                            const newStart = Math.max(0, Math.min(newValue, c.timelineEnd - 0.1))
                            const delta = newStart - c.timelineStart
                            state.clips[index].timelineStart = newStart
                            if (c.type === 'video' || c.type === 'audio') {
                                (state.clips[index] as any).sourceStart = Math.max(0, (state.clips[index] as any).sourceStart + delta)
                            }
                        } else {
                            const newEnd = Math.max(c.timelineStart + 0.1, newValue)
                            const delta = newEnd - c.timelineEnd
                            state.clips[index].timelineEnd = newEnd
                            if (c.type === 'video' || c.type === 'audio') {
                                (state.clips[index] as any).sourceEnd = Math.max(0, (state.clips[index] as any).sourceEnd + delta)
                            }
                        }
                        state.isDirty = true
                    }
                })
            }
        },

        splitClipAtPlayhead: (id) => {
            const { clips, playheadPosition } = get()
            const clip = clips.find((c) => c.id === id)

            if (!clip || clip.locked) return
            if (playheadPosition <= clip.timelineStart || playheadPosition >= clip.timelineEnd) return

            get().saveToHistory()
            set((state) => {
                const clipIndex = state.clips.findIndex((c) => c.id === id)
                const originalClip = state.clips[clipIndex]

                // Create the new clip (second half)
                const newClip: Clip = {
                    ...originalClip,
                    id: `${originalClip.id}-split-${Date.now()}`,
                    timelineStart: playheadPosition,
                }

                // Update source offsets for video/audio clips
                if ((originalClip.type === 'video' || originalClip.type === 'audio') &&
                    (newClip.type === 'video' || newClip.type === 'audio')) {
                    const splitOffset = playheadPosition - originalClip.timelineStart
                        ; (newClip as any).sourceStart = Math.max(0, (originalClip as any).sourceStart + splitOffset)
                }

                // Trim original clip
                state.clips[clipIndex].timelineEnd = playheadPosition
                if (originalClip.type === 'video' || originalClip.type === 'audio') {
                    (state.clips[clipIndex] as any).sourceEnd = Math.max(0,
                        (originalClip as any).sourceStart + (playheadPosition - originalClip.timelineStart))
                }

                // Add new clip
                state.clips.push(newClip)
                state.isDirty = true
            })
        },

        // ========== PLAYBACK ACTIONS ==========

        setPlayheadPosition: (position) => {
            set((state) => {
                state.playheadPosition = Math.max(0, position)
            })
        },

        setIsPlaying: (playing) => {
            set((state) => {
                state.isPlaying = playing
            })
        },

        togglePlayback: () => {
            set((state) => {
                state.isPlaying = !state.isPlaying
            })
        },

        seekToStart: () => {
            set((state) => {
                state.playheadPosition = 0
                state.isPlaying = false
            })
        },

        seekToEnd: () => {
            const { source } = get()
            if (!source) return
            set((state) => {
                state.playheadPosition = source.duration
                state.isPlaying = false
            })
        },

        stepForward: () => {
            const { source } = get()
            if (!source) return
            set((state) => {
                state.playheadPosition = Math.min(
                    source.duration,
                    state.playheadPosition + (1 / source.fps)
                )
            })
        },

        stepBackward: () => {
            const { source } = get()
            if (!source) return
            set((state) => {
                state.playheadPosition = Math.max(
                    0,
                    state.playheadPosition - (1 / source.fps)
                )
            })
        },

        // ========== TIMELINE VIEW ACTIONS ==========

        setZoom: (zoom) => {
            set((state) => {
                state.zoom = Math.max(10, Math.min(200, zoom))
            })
        },

        setScrollX: (scrollX) => {
            set((state) => {
                state.scrollX = Math.max(0, scrollX)
            })
        },

        zoomIn: () => {
            set((state) => {
                state.zoom = Math.min(200, state.zoom * 1.25)
            })
        },

        zoomOut: () => {
            set((state) => {
                state.zoom = Math.max(10, state.zoom / 1.25)
            })
        },

        fitToView: () => {
            // This would need the container width - implement in component
            set((state) => {
                state.zoom = 50
                state.scrollX = 0
            })
        },

        // ========== HISTORY ACTIONS ==========

        saveToHistory: () => {
            const currentState = get()
            set((state) => {
                // Don't save if already at max history
                if (state.history.past.length >= 50) {
                    state.history.past.shift()
                }
                state.history.past.push({
                    ...currentState,
                    history: { past: [], future: [] }, // Don't nest history
                })
                state.history.future = []
            })
        },

        undo: () => {
            const { history } = get()
            if (history.past.length === 0) return

            set((state) => {
                const previous = state.history.past.pop()
                if (previous) {
                    // Save current to future
                    const current = get()
                    state.history.future.push({
                        ...current,
                        history: { past: [], future: [] },
                    })

                    // Restore previous
                    state.source = previous.source
                    state.shots = previous.shots
                    state.clips = previous.clips
                    state.transitions = previous.transitions
                    state.selectedClipId = previous.selectedClipId
                    state.audio = previous.audio
                    state.exportSettings = previous.exportSettings
                    state.isDirty = true
                }
            })
        },

        redo: () => {
            const { history } = get()
            if (history.future.length === 0) return

            set((state) => {
                const next = state.history.future.pop()
                if (next) {
                    // Save current to past
                    const current = get()
                    state.history.past.push({
                        ...current,
                        history: { past: [], future: [] },
                    })

                    // Restore next
                    state.source = next.source
                    state.shots = next.shots
                    state.clips = next.clips
                    state.transitions = next.transitions
                    state.selectedClipId = next.selectedClipId
                    state.audio = next.audio
                    state.exportSettings = next.exportSettings
                    state.isDirty = true
                }
            })
        },

        // ========== AUDIO ACTIONS ==========

        setMasterVolume: (volume) => {
            set((state) => {
                state.audio.masterVolume = Math.max(0, Math.min(1, volume))
                state.isDirty = true
            })
        },

        setNormalize: (normalize) => {
            set((state) => {
                state.audio.normalize = normalize
                state.isDirty = true
            })
        },

        // ========== EXPORT ACTIONS ==========

        setExportSettings: (settings) => {
            set((state) => {
                state.exportSettings = { ...state.exportSettings, ...settings }
            })
        },

        generateManifest: () => {
            const state = get()
            if (!state.source) return null

            const manifest: EditManifest = {
                version: '1.0',
                jobId: state.source.jobId,
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                source: state.source,
                timeline: {
                    duration: Math.max(...state.clips.map((c) => c.timelineEnd), 0),
                    fps: state.source.fps,
                    width: state.source.width,
                    height: state.source.height,
                    aspectRatio: state.source.aspectRatio,
                },
                clips: state.clips,
                transitions: state.transitions,
                audio: state.audio,
                export: state.exportSettings,
            }

            return manifest
        },

        // ========== STATE ACTIONS ==========

        markSaved: () => {
            set((state) => {
                state.isDirty = false
            })
        },

        reset: () => {
            set(initialState)
        },
    }))
)

// ============================================================================
// SELECTORS
// ============================================================================

export const selectVideoClips = (state: EditorState) =>
    state.clips.filter((c): c is VideoClip => c.type === 'video')

export const selectAudioClips = (state: EditorState) =>
    state.clips.filter((c): c is AudioClip => c.type === 'audio')

export const selectSubtitleClips = (state: EditorState) =>
    state.clips.filter((c): c is SubtitleClip => c.type === 'subtitle')

export const selectSelectedClip = (state: EditorState) =>
    state.clips.find((c) => c.id === state.selectedClipId) || null

export const selectTimelineDuration = (state: EditorState) =>
    Math.max(...state.clips.map((c) => c.timelineEnd), 0)

export const selectCanUndo = (state: EditorState) =>
    state.history.past.length > 0

export const selectCanRedo = (state: EditorState) =>
    state.history.future.length > 0
