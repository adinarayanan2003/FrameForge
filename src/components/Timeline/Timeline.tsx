/**
 * Timeline Component
 * 
 * Main timeline view for the video editor.
 * Shows time ruler, tracks, clips, and playhead.
 */

'use client'

import React, { useRef, useCallback, useEffect } from 'react'
import { useEditorStore, selectVideoClips, selectAudioClips, selectSubtitleClips, selectTimelineDuration } from '@/store/editorStore'
import { TimeRuler } from './TimeRuler'
import { TimelineTrack } from './TimelineTrack'
import { PlayheadCursor } from './PlayheadCursor'

interface TimelineProps {
    className?: string
}

export const Timeline: React.FC<TimelineProps> = ({ className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const {
        zoom,
        scrollX,
        selectedClipId,
        setScrollX,
        setPlayheadPosition,
        selectClip,
    } = useEditorStore()

    const videoClips = useEditorStore(selectVideoClips)
    const audioClips = useEditorStore(selectAudioClips)
    const subtitleClips = useEditorStore(selectSubtitleClips)
    const duration = useEditorStore(selectTimelineDuration)

    // Calculate timeline width based on duration and zoom
    const timelineWidth = Math.max(duration * zoom + 200, 800)

    // Handle horizontal scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollX(e.currentTarget.scrollLeft)
    }, [setScrollX])

    // Handle click on timeline to move playhead
    const handleTimelineClick = useCallback((e: React.MouseEvent) => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left + scrollX
        const time = x / zoom

        setPlayheadPosition(Math.max(0, Math.min(duration, time)))
        selectClip(null)
    }, [scrollX, zoom, duration, setPlayheadPosition, selectClip])

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if not typing in input
            if ((e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).tagName === 'TEXTAREA') return

            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    if (selectedClipId) {
                        e.preventDefault()
                        useEditorStore.getState().deleteClip(selectedClipId)
                    }
                    break
                case 's':
                    if (selectedClipId) {
                        e.preventDefault()
                        useEditorStore.getState().splitClipAtPlayhead(selectedClipId)
                    }
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedClipId])

    // Multi-track configuration (Production)
    // Track 0: Video, Track 1: Voiceover, Track 2: BGM, Track 3: SFX, Track 4: Captions
    const tracks = [
        {
            id: 'video',
            label: 'Video',
            clips: videoClips,
            color: 'bg-blue-500/80'
        },
        {
            id: 'voiceover',
            label: 'Voiceover',
            clips: audioClips.filter(c => c.trackType === 'voiceover'),
            color: 'bg-green-500/80'
        },
        {
            id: 'bgm',
            label: 'BGM',
            clips: audioClips.filter(c => c.trackType === 'bgm'),
            color: 'bg-purple-500/80'
        },
        {
            id: 'sfx',
            label: 'SFX',
            clips: audioClips.filter(c => c.trackType === 'sfx' || c.trackType === 'custom'),
            color: 'bg-orange-500/80'
        },
        {
            id: 'captions',
            label: 'Captions',
            clips: subtitleClips,
            color: 'bg-yellow-500/80'
        },
    ]

    return (
        <div
            className={`flex flex-col bg-card/30 border-t border-border/20 ${className}`}
            style={{ height: 420 }}
        >
            {/* Timeline header with zoom controls */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
                <span className="text-xs text-secondary font-medium">Timeline</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => useEditorStore.getState().zoomOut()}
                        className="p-1 text-secondary hover:text-foreground transition-colors"
                        title="Zoom Out"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35M8 11h6" />
                        </svg>
                    </button>
                    <span className="text-xs text-secondary w-12 text-center">{Math.round(zoom)}px/s</span>
                    <button
                        onClick={() => useEditorStore.getState().zoomIn()}
                        className="p-1 text-secondary hover:text-foreground transition-colors"
                        title="Zoom In"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Timeline content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Track labels */}
                <div className="w-24 flex-shrink-0 border-r border-border/20">
                    {/* Ruler spacer */}
                    <div className="h-6 border-b border-border/20" />
                    {/* Track labels */}
                    {tracks.map((track) => (
                        <div
                            key={track.id}
                            className="h-16 flex items-center px-3 border-b border-border/10"
                        >
                            <span className="text-xs text-secondary font-medium">{track.label}</span>
                        </div>
                    ))}
                </div>

                {/* Scrollable timeline area */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide"
                    onScroll={handleScroll}
                >
                    <div
                        ref={containerRef}
                        className="relative"
                        style={{ width: timelineWidth, minHeight: '100%' }}
                        onClick={handleTimelineClick}
                    >
                        {/* Time ruler */}
                        <TimeRuler
                            duration={duration}
                            zoom={zoom}
                            width={timelineWidth}
                        />

                        {/* Tracks */}
                        <div className="relative">
                            {tracks.map((track, index) => (
                                <TimelineTrack
                                    key={track.id}
                                    trackId={track.id}
                                    clips={track.clips}
                                    color={track.color}
                                    zoom={zoom}
                                    selectedClipId={selectedClipId}
                                />
                            ))}
                        </div>

                        {/* Playhead */}
                        {/* No longer passing position prop, it self-subscribes */}
                        <PlayheadCursor
                            zoom={zoom}
                            height={tracks.length * 64 + 24} // tracks + ruler
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
