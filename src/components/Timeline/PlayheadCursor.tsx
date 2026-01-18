/**
 * Playhead Cursor
 * 
 * The vertical line indicating current playback position.
 */

'use client'

import React from 'react'

import { useEditorStore } from '@/store/editorStore'

interface PlayheadCursorProps {
    zoom: number // pixels per second
    height: number
}

export const PlayheadCursor: React.FC<PlayheadCursorProps> = ({
    zoom,
    height,
}) => {
    // Subscribe only to playhead position
    const position = useEditorStore((state) => state.playheadPosition)
    // Use transform for GPU-accelerated motion (no layout thrashing)
    const translateX = position * zoom

    return (
        <div
            className="absolute top-0 pointer-events-none z-20 will-change-transform"
            style={{
                transform: `translateX(${translateX}px)`,
                height
            }}
        >
            {/* Playhead handle */}
            <div className="absolute -left-1.5 -top-0.5">
                <svg width="12" height="12" viewBox="0 0 12 12" className="fill-primary drop-shadow-md">
                    <polygon points="0,0 12,0 6,10" />
                </svg>
            </div>

            {/* Playhead line */}
            <div
                className="absolute left-0 top-0 w-0.5 bg-primary shadow-lg"
                style={{ height }}
            />
        </div>
    )
}
