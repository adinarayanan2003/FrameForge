/**
 * Preview Controls
 * 
 * Play/pause, seek, and time display for the video preview.
 */

'use client'

import React, { useCallback, useEffect } from 'react'
import { useEditorStore, selectTimelineDuration } from '@/store/editorStore'
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react'

const TimeDisplay: React.FC = () => {
    const playheadPosition = useEditorStore((state) => state.playheadPosition)

    // Format time as MM:SS.ms
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        const ms = Math.floor((seconds % 1) * 10)
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
    }

    return <>{formatTime(playheadPosition)}</>
}

const ProgressBar: React.FC = () => {
    const playheadPosition = useEditorStore((state) => state.playheadPosition)
    const duration = useEditorStore(selectTimelineDuration)
    const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition)

    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const percentage = (e.clientX - rect.left) / rect.width
        setPlayheadPosition(percentage * duration)
    }, [duration, setPlayheadPosition])

    const progress = duration > 0 ? (playheadPosition / duration) * 100 : 0

    return (
        <div
            className="group mb-2 h-1 cursor-pointer rounded-full bg-white/[0.08]"
            onClick={handleProgressClick}
        >
            <div
                className="relative h-full rounded-full bg-primary will-change-transform"
                style={{ width: `${progress}%` }}
            >
                {/* Scrubber handle */}
                <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow-[0_0_20px_rgba(139,216,255,0.45)] transition-opacity group-hover:opacity-100" />
            </div>
        </div>
    )
}

export const PreviewControls: React.FC = () => {
    const {
        isPlaying,
        togglePlayback,
        setPlayheadPosition,
        seekToStart,
        seekToEnd,
        stepForward,
        stepBackward,
    } = useEditorStore()

    const duration = useEditorStore(selectTimelineDuration)

    // Format time helper (for duration only)
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        const ms = Math.floor((seconds % 1) * 10)
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
    }

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).tagName === 'TEXTAREA') return

            const state = useEditorStore.getState()

            switch (e.key) {
                case ' ':
                    e.preventDefault()
                    state.togglePlayback()
                    break
                case 'ArrowLeft':
                    e.preventDefault()
                    if (e.shiftKey) {
                        state.setPlayheadPosition(Math.max(0, state.playheadPosition - 1))
                    } else {
                        state.stepBackward()
                    }
                    break
                case 'ArrowRight':
                    e.preventDefault()
                    if (e.shiftKey) {
                        const duration = Math.max(...state.clips.map((c) => c.timelineEnd), state.source?.duration || 0)
                        state.setPlayheadPosition(Math.min(duration, state.playheadPosition + 1))
                    } else {
                        state.stepForward()
                    }
                    break
                case 'Home':
                    e.preventDefault()
                    state.seekToStart()
                    break
                case 'End':
                    e.preventDefault()
                    state.seekToEnd()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, []) // Empty dependency array - handlers use getState()

    return (
        <div className="border-t border-primary/10 bg-[#080b10]/90 px-4 py-2">
            {/* Progress bar */}
            <ProgressBar />

            {/* Controls row */}
            <div className="flex items-center justify-between">
                {/* Time display */}
                <div className="w-24 font-mono text-xs text-secondary">
                    <TimeDisplay />
                </div>

                {/* Playback controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={seekToStart}
                        className="rounded p-1 text-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                        title="Jump to start (Home)"
                    >
                        <SkipBack size={16} />
                    </button>

                    <button
                        onClick={stepBackward}
                        className="rounded p-1 text-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                        title="Previous frame (←)"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <button
                        onClick={togglePlayback}
                        className="rounded-full bg-primary p-2 text-primary-foreground shadow-[0_0_24px_rgba(139,216,255,0.22)] transition-opacity hover:opacity-90"
                        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                    </button>

                    <button
                        onClick={stepForward}
                        className="rounded p-1 text-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                        title="Next frame (→)"
                    >
                        <ChevronRight size={16} />
                    </button>

                    <button
                        onClick={seekToEnd}
                        className="rounded p-1 text-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                        title="Jump to end (End)"
                    >
                        <SkipForward size={16} />
                    </button>
                </div>

                {/* Duration display */}
                <div className="w-24 text-right font-mono text-xs text-secondary">
                    {formatTime(duration)}
                </div>
            </div>
        </div>
    )
}
