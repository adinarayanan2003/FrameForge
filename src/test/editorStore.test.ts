import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { SourceVideo, SourceShot } from '../types/editor'

// Mock data
const mockSource: SourceVideo = {
    jobId: 'test-job',
    videoUrl: 'http://example.com/video.mp4',
    duration: 60,
    width: 1920,
    height: 1080,
    fps: 30,
    aspectRatio: '16:9',
}

const mockShots: SourceShot[] = [
    {
        shotId: 'shot-1',
        shotNumber: 1,
        voiceover: 'Voiceover 1',
        sceneDescription: 'Scene 1',
        startTime: 0,
        endTime: 10,
        duration: 10,
    },
    {
        shotId: 'shot-2',
        shotNumber: 2,
        voiceover: 'Voiceover 2',
        sceneDescription: 'Scene 2',
        startTime: 10,
        endTime: 20,
        duration: 10,
    },
]

describe('Editor Store', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
    })

    // Helper to initialize store
    const initStore = () => {
        const actions = useEditorStore.getState()
        actions.setSource(mockSource)
        actions.setShots(mockShots)
        actions.initializeFromShots()
    }

    it('initializes from shots correctly', () => {
        initStore()
        const state = useEditorStore.getState()

        expect(state.clips).toHaveLength(5)

        const videoClips = state.clips.filter(c => c.type === 'video')
        expect(videoClips).toHaveLength(2)
        expect(videoClips[0].timelineStart).toBe(0)
        expect(videoClips[0].timelineEnd).toBe(10)
        expect(videoClips[1].timelineStart).toBe(10)
        expect(videoClips[1].timelineEnd).toBe(20)

        const audioClip = state.clips.find(c => c.type === 'audio')
        expect(audioClip).toBeDefined()
        expect(audioClip?.timelineEnd).toBe(60)
    })

    it('selects a clip', () => {
        initStore()
        const state = useEditorStore.getState()
        const clipId = state.clips[0].id

        useEditorStore.getState().selectClip(clipId)

        expect(useEditorStore.getState().selectedClipId).toBe(clipId)
    })

    it('moves a clip', () => {
        initStore()
        const clip = useEditorStore.getState().clips[0] // 0-10s

        useEditorStore.getState().moveClip(clip.id, 5) // Move to 5s

        const updatedClip = useEditorStore.getState().clips.find(c => c.id === clip.id)
        expect(updatedClip?.timelineStart).toBe(5)
        expect(updatedClip?.timelineEnd).toBe(15) // Duration 10s -> 5+10=15
        expect(useEditorStore.getState().isDirty).toBe(true)
    })

    it('trims a clip start', () => {
        initStore()
        const clip = useEditorStore.getState().clips[0] // 0-10s

        // Trim start to 2s
        useEditorStore.getState().trimClip(clip.id, 'start', 2)

        const updatedClip = useEditorStore.getState().clips.find(c => c.id === clip.id) as any
        expect(updatedClip.timelineStart).toBe(2)
        expect(updatedClip.timelineEnd).toBe(10)
        expect(updatedClip.sourceStart).toBe(2)
    })

    it('trims a clip end', () => {
        initStore()
        const clip = useEditorStore.getState().clips[0] // 0-10s

        // Trim end to 8s
        useEditorStore.getState().trimClip(clip.id, 'end', 8)

        const updatedClip = useEditorStore.getState().clips.find(c => c.id === clip.id) as any
        expect(updatedClip.timelineStart).toBe(0)
        expect(updatedClip.timelineEnd).toBe(8)
        expect(updatedClip.sourceEnd).toBe(8)
    })

    it('splits a clip at playhead', () => {
        initStore()
        const clip = useEditorStore.getState().clips[0] // 0-10s

        useEditorStore.getState().setPlayheadPosition(5)
        useEditorStore.getState().splitClipAtPlayhead(clip.id)

        const state = useEditorStore.getState()
        expect(state.clips).toHaveLength(6) // 5 + 1

        const original = state.clips.find(c => c.id === clip.id) as any
        const newClip = state.clips.find(c => c.id.startsWith(clip.id) && c.id !== clip.id) as any

        // Original split at 5
        expect(original.timelineEnd).toBe(5)
        expect(original.sourceEnd).toBe(5)

        // New clip from 5 to 10
        expect(newClip.timelineStart).toBe(5)
        expect(newClip.timelineEnd).toBe(10)
        expect(newClip.sourceStart).toBe(5)
        expect(newClip.sourceEnd).toBe(10)
    })

    it('handles undo/redo', () => {
        initStore()
        const initialCount = useEditorStore.getState().clips.length
        const clipToDelete = useEditorStore.getState().clips[0]

        // Action: Delete
        useEditorStore.getState().deleteClip(clipToDelete.id)
        expect(useEditorStore.getState().clips).toHaveLength(initialCount - 1)

        // Undo
        useEditorStore.getState().undo()
        expect(useEditorStore.getState().clips).toHaveLength(initialCount)
        expect(useEditorStore.getState().clips.find(c => c.id === clipToDelete.id)).toBeDefined()

        // Redo
        useEditorStore.getState().redo()
        expect(useEditorStore.getState().clips).toHaveLength(initialCount - 1)
    })
})
