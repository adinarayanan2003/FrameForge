/**
 * Timeline Track
 * 
 * A single track in the timeline (video, audio, or subtitles).
 * Contains draggable/resizable clips.
 */

'use client'

import React from 'react'
import { Clip } from '@/types/editor'
import { TimelineClip } from './TimelineClip'

interface TimelineTrackProps {
    trackId: string
    label: string
    clips: Clip[]
    color: string
    zoom: number
    selectedClipId: string | null
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
    trackId,
    label,
    clips,
    color,
    zoom,
    selectedClipId,
}) => {
    return (
        <div
            className="h-12 relative border-b border-border/10 flex items-center"
            data-track-id={trackId}
        >
            {/* Sticky Track Label */}
            <div className="sticky left-0 z-10 w-24 h-full flex items-center px-3 bg-slate-900/95 backdrop-blur-sm border-r border-border/20 text-xs text-secondary font-medium shrink-0">
                {label}
            </div>

            {/* Track background grid */}
            <div
                className="absolute inset-0 opacity-5"
                style={{
                    left: 96, // Offset by label width (w-24 = 96px)
                    backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)`,
                    backgroundSize: `${zoom}px 100%`,
                }}
            />

            {/* Clips Container (Offset by label width) */}
            <div className="absolute inset-0" style={{ left: 96 }}>
                {clips.map((clip) => (
                    <TimelineClip
                        key={clip.id}
                        clip={clip}
                        color={color}
                        zoom={zoom}
                        isSelected={clip.id === selectedClipId}
                    />
                ))}
            </div>
        </div>
    )
}
