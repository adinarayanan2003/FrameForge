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
            className="h-1 bg-card/50 rounded-full mb-3 cursor-pointer group"
            onClick={handleProgressClick}
        >
            <div
                className="h-full bg-primary rounded-full relative will-change-transform"
                style={{ width: `${progress}%` }}
            >
                {/* Scrubber handle */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
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
        <div className="px-4 py-3 bg-card/30 border-t border-border/20">
            {/* Progress bar */}
            <ProgressBar />

            {/* Controls row */}
            <div className="flex items-center justify-between">
                {/* Time display */}
                <div className="text-xs text-secondary font-mono w-24">
                    <TimeDisplay />
                </div>

                {/* Playback controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={seekToStart}
                        className="p-2 text-secondary hover:text-foreground transition-colors"
                        title="Jump to start (Home)"
                    >
                        <SkipBack size={18} />
                    </button>

                    <button
                        onClick={stepBackward}
                        className="p-2 text-secondary hover:text-foreground transition-colors"
                        title="Previous frame (←)"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <button
                        onClick={togglePlayback}
                        className="p-3 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
                        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                    </button>

                    <button
                        onClick={stepForward}
                        className="p-2 text-secondary hover:text-foreground transition-colors"
                        title="Next frame (→)"
                    >
                        <ChevronRight size={18} />
                    </button>

                    <button
                        onClick={seekToEnd}
                        className="p-2 text-secondary hover:text-foreground transition-colors"
                        title="Jump to end (End)"
                    >
                        <SkipForward size={18} />
                    </button>
                </div>

                {/* Duration display */}
                <div className="text-xs text-secondary font-mono w-24 text-right">
                    {formatTime(duration)}
                </div>
            </div>
        </div>
    )
}
