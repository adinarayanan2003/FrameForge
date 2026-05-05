/**
 * Timeline Component
 * 
 * Main timeline view for the video editor.
 * Shows time ruler, tracks, clips, and playhead.
 */

'use client'

import React, { useRef, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
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
    const phantomClips = useEditorStore((state) => state.phantomClips)
    const duration = useEditorStore(selectTimelineDuration)

    // Calculate timeline width based on duration and zoom (plus label offset and buffer)
    const labelOffset = 96 // w-24
    const timelineWidth = Math.max(duration * zoom + 200 + labelOffset, 800)

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
            color: 'bg-sky-400/70'
        },
        {
            id: 'voiceover',
            label: 'Voiceover',
            clips: audioClips.filter(c => c.trackType === 'voiceover'),
            color: 'bg-emerald-400/60'
        },
        {
            id: 'bgm',
            label: 'BGM',
            clips: audioClips.filter(c => c.trackType === 'bgm'),
            color: 'bg-violet-400/60'
        },
        {
            id: 'sfx',
            label: 'SFX',
            clips: audioClips.filter(c => c.trackType === 'sfx' || c.trackType === 'custom' || c.track === 3),
            color: 'bg-amber-400/60'
        },
        {
            id: 'captions',
            label: 'Captions',
            clips: subtitleClips,
            color: 'bg-yellow-300/60'
        },
        {
            id: 'overlays',
            label: 'Overlays',
            // Filter for overlay clips
            clips: useEditorStore(state => state.clips.filter((c) => c.type === 'overlay')),
            color: 'bg-rose-400/60'
        },
        {
            id: 'proposed',
            label: 'Proposed',
            clips: phantomClips,
            color: 'bg-destructive/60'
        },
    ]

    return (
        <div
            className={`flex flex-col border-t border-primary/10 bg-[#080b10]/95 ${className}`}
            style={{ height: 240 }}
        >
            {/* Timeline header with zoom controls */}
            <div className="flex items-center justify-between border-b border-primary/10 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">Timeline</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => useEditorStore.getState().zoomOut()}
                        className="rounded p-1 text-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                        title="Zoom Out"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <span className="w-14 rounded border border-primary/10 bg-black/20 px-2 py-0.5 text-center font-mono text-[11px] text-secondary">{Math.round(zoom)}px/s</span>
                    <button
                        onClick={() => useEditorStore.getState().zoomIn()}
                        className="rounded p-1 text-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                        title="Zoom In"
                    >
                        <ZoomIn size={16} />
                    </button>
                </div>
            </div>

            {/* Timeline content */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto overflow-y-auto"
                onScroll={handleScroll}
            >
                <div
                    ref={containerRef}
                    className="relative"
                    style={{ width: timelineWidth, minHeight: '100%' }}
                    onClick={handleTimelineClick}
                >
                    {/* Time ruler (Sticky top, Offset by label width) */}
                    <div className="sticky top-0 z-20 ml-24 h-6 border-b border-primary/10 bg-[#080b10]/95 backdrop-blur">
                        <TimeRuler
                            duration={duration}
                            zoom={zoom}
                            width={timelineWidth - 96}
                        />
                    </div>

                    {/* Tracks */}
                    <div className="relative">
                        {tracks.map((track) => (
                            <TimelineTrack
                                key={track.id}
                                trackId={track.id}
                                label={track.label}
                                clips={track.clips}
                                color={track.color}
                                zoom={zoom}
                                selectedClipId={selectedClipId}
                            />
                        ))}
                    </div>

                    {/* Playhead (Offset by label width) */}
                    {/* No longer passing position prop, it self-subscribes */}
                    <div className="absolute top-0 h-full pointer-events-none ml-24" style={{ zIndex: 30 }}>
                        <PlayheadCursor
                            zoom={zoom}
                            height={tracks.length * 48 + 24} // tracks + ruler
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
