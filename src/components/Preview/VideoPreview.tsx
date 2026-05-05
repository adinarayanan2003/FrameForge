/**
 * Video Preview
 * 
 * Shows the video composition using Remotion Player for real-time preview.
 */

'use client'

import React, { useCallback, useEffect, useRef, useMemo } from 'react'
import { Player, PlayerRef } from '@remotion/player'
import { prefetch } from 'remotion'
import { useEditorStore } from '@/store/editorStore'
import { VideoComposition } from '@/remotion/VideoComposition'
import { PreviewControls } from './PreviewControls'

interface VideoPreviewProps {
    className?: string
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ className = '' }) => {
    const playerRef = useRef<PlayerRef>(null)

    const source = useEditorStore((state) => state.source)
    const clips = useEditorStore((state) => state.clips)
    const audio = useEditorStore((state) => state.audio)
    const transitions = useEditorStore((state) => state.transitions)
    const exportSettings = useEditorStore((state) => state.exportSettings)
    const isPlaying = useEditorStore((state) => state.isPlaying)
    const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition)
    const setIsPlaying = useEditorStore((state) => state.setIsPlaying)

    // Memoize manifest to prevent player re-initialization on playhead updates
    const manifest = useMemo(() => {
        if (!source) return null
        return {
            version: '1.0' as const,
            jobId: source.jobId,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            source,
            timeline: {
                duration: Math.max(...clips.map((c) => c.timelineEnd), source.duration),
                fps: source.fps,
                width: exportSettings.width,
                height: exportSettings.height,
                aspectRatio: exportSettings.aspectRatio,
            },
            clips,
            transitions,
            audio,
            export: exportSettings,
        }
    }, [source, clips, audio, transitions, exportSettings])

    // Sync playhead store with player frame
    useEffect(() => {
        const player = playerRef.current
        if (!player || !manifest || !isPlaying) return

        const handleFrameUpdate = () => {
            const currentFrame = player.getCurrentFrame()
            if (currentFrame !== null && manifest.timeline.fps) {
                // Only update the store if we are playing
                // Note: This updates other components (Playhead, Timer) but not VideoPreview anymore
                useEditorStore.getState().setPlayheadPosition(currentFrame / manifest.timeline.fps)
            }
        }

        const interval = setInterval(handleFrameUpdate, 1000 / 30) // 30fps update rate
        return () => clearInterval(interval)
    }, [isPlaying, manifest])

    // Handle external seeks (e.g. from timeline clicks) without re-rendering VideoPreview
    useEffect(() => {
        const player = playerRef.current
        if (!player || !manifest) return

        // Manually subscribe to playheadPosition
        const unsubscribe = useEditorStore.subscribe((state) => {
            const currentIsPlaying = state.isPlaying
            // Only seek if we're NOT playing (e.g. manual scrubbing)
            if (currentIsPlaying) return

            const pos = state.playheadPosition
            const targetFrame = Math.round(pos * manifest.timeline.fps)
            const currentFrame = player.getCurrentFrame()

            if (currentFrame !== null && Math.abs(currentFrame - targetFrame) > 1) {
                player.seekTo(targetFrame)
            }
        })

        return unsubscribe
    }, [manifest])

    // Play/pause sync
    useEffect(() => {
        const player = playerRef.current
        if (!player) return

        if (isPlaying) {
            player.play()
        } else {
            player.pause()
        }
    }, [isPlaying])

    // Preload video assets when source changes
    useEffect(() => {
        if (source?.videoUrl) {
            const { free } = prefetch(source.videoUrl)
            return () => free()
        }
    }, [source?.videoUrl])

    // Handle play state changes from player (e.g. user clicks video or it ends)
    const handlePlay = useCallback(() => setIsPlaying(true), [setIsPlaying])
    const handlePause = useCallback(() => setIsPlaying(false), [setIsPlaying])
    const handleEnded = useCallback(() => setIsPlaying(false), [setIsPlaying])

    // Subscribe to player events via ref
    useEffect(() => {
        const player = playerRef.current
        if (!player) return

        player.addEventListener('play', handlePlay)
        player.addEventListener('pause', handlePause)
        player.addEventListener('ended', handleEnded)

        return () => {
            player.removeEventListener('play', handlePlay)
            player.removeEventListener('pause', handlePause)
            player.removeEventListener('ended', handleEnded)
        }
    }, [handlePlay, handlePause, handleEnded])

    // Memoize inputProps for the player to maintain object identity
    const inputProps = useMemo(() => ({ manifest }), [manifest])

    if (!manifest || !source) {
        return (
            <div className={`flex items-center justify-center bg-[#050608] ${className}`}>
                <div className="rounded-md border border-primary/10 bg-[#080b10]/80 px-4 py-3 text-sm text-secondary">
                    No video loaded
                </div>
            </div>
        )
    }

    // Determine aspect ratio class
    const aspectClass = exportSettings.aspectRatio === '9:16'
        ? 'aspect-[9/16] max-h-full'
        : 'aspect-video max-h-full'

    return (
        <div className={`flex flex-col bg-[#050608]/95 ${className}`}>
            {/* Preview container */}
            <div className="flex min-h-0 flex-1 items-center justify-center p-5">
                <div className="flex h-full w-full items-center justify-center rounded-lg border border-primary/10 bg-[radial-gradient(circle_at_center,rgba(139,216,255,0.08),transparent_58%),#050608] p-4 shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]">
                    <div className={`${aspectClass} h-full w-auto max-w-full overflow-hidden rounded-md border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.65)]`}>
                    <Player
                        ref={playerRef}
                        component={VideoComposition as any}
                        inputProps={inputProps}
                        durationInFrames={Math.ceil(manifest.timeline.duration * manifest.timeline.fps)}
                        fps={manifest.timeline.fps}
                        compositionWidth={manifest.timeline.width}
                        compositionHeight={manifest.timeline.height}
                        style={{ width: '100%', height: '100%' }}
                        controls={false}
                        loop={false}
                        clickToPlay={false}
                        acknowledgeRemotionLicense={true}
                    />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <PreviewControls />
        </div>
    )
}
