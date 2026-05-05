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
            className="relative flex h-12 items-center border-b border-primary/10"
            data-track-id={trackId}
        >
            {/* Sticky Track Label */}
            <div className="sticky left-0 z-10 flex h-full w-24 shrink-0 items-center border-r border-primary/10 bg-[#080b10]/95 px-3 text-xs font-medium text-secondary backdrop-blur">
                <span className="truncate">{label}</span>
            </div>

            {/* Track background grid */}
            <div
                className="absolute inset-0 opacity-[0.12]"
                style={{
                    left: 96, // Offset by label width (w-24 = 96px)
                    backgroundImage: `linear-gradient(to right, rgba(139, 216, 255, 0.18) 1px, transparent 1px)`,
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
