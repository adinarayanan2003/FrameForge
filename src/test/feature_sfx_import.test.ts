
import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../store/editorStore'
import { VideoClip, AudioClip } from '../types/editor'

describe('Feature: SFX Audio for Imported Media', () => {
    beforeEach(() => {
        useEditorStore.getState().reset()
    })

    it('should create a video clip (track 0) and an audio clip (track 3/sfx) when importing media', () => {
        const store = useEditorStore.getState()

        // Import a custom clip
        store.addCustomVideoClip('blob:test', 10, 1920, 1080)

        const state = useEditorStore.getState()

        // Check Video Clip
        const videoClip = state.clips.find(c => c.type === 'video') as VideoClip
        expect(videoClip).toBeDefined()
        expect(videoClip.track).toBe(0)
        expect(videoClip.customVideoUrl).toBe('blob:test')
        expect(videoClip.muted).toBe(true) // Video should be muted

        // Check Audio Clip
        const audioClip = state.clips.find(c => c.type === 'audio') as AudioClip
        expect(audioClip).toBeDefined()
        expect(audioClip.track).toBe(3) // Should be on SFX track
        expect(audioClip.trackType).toBe('sfx') // Should be marked as SFX
        expect(audioClip.source).toBe('blob:test') // Using same source
        expect(audioClip.muted).toBe(false) // Audio should be active
    })
})
