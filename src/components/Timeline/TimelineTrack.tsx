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
    clips: Clip[]
    color: string
    zoom: number
    selectedClipId: string | null
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
    trackId,
    clips,
    color,
    zoom,
    selectedClipId,
}) => {
    return (
        <div
            className="h-16 relative border-b border-border/10"
            data-track-id={trackId}
        >
            {/* Track background grid */}
            <div
                className="absolute inset-0 opacity-5"
                style={{
                    backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px)`,
                    backgroundSize: `${zoom}px 100%`,
                }}
            />

            {/* Clips */}
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
    )
}
