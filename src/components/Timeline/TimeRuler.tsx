/**
 * Time Ruler
 * 
 * Shows time scale markers at the top of the timeline.
 */

'use client'

import React, { useMemo } from 'react'

interface TimeRulerProps {
    duration: number
    zoom: number
    width: number
}

export const TimeRuler: React.FC<TimeRulerProps> = ({ duration, zoom, width }) => {
    // Calculate tick marks based on zoom level
    const ticks = useMemo(() => {
        const result: { time: number; major: boolean }[] = []

        // Determine tick interval based on zoom
        let interval = 1
        if (zoom < 20) interval = 5
        else if (zoom < 40) interval = 2
        else if (zoom > 100) interval = 0.5
        else if (zoom > 150) interval = 0.25

        // Generate ticks
        for (let t = 0; t <= duration + 1; t += interval) {
            const isMajor = t % (interval >= 1 ? Math.max(1, Math.round(5 / interval) * interval) : 1) === 0
            result.push({ time: t, major: isMajor || t === 0 })
        }

        return result
    }, [duration, zoom])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        const ms = Math.round((seconds % 1) * 10)

        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, '0')}`
        }
        if (seconds < 10 && zoom > 80) {
            return `${secs}.${ms}`
        }
        return `${secs}s`
    }

    return (
        <div
            className="h-6 border-b border-border/20 relative bg-card/20"
            style={{ width }}
        >
            {ticks.map((tick) => (
                <div
                    key={tick.time}
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: tick.time * zoom }}
                >
                    {/* Tick mark */}
                    <div
                        className={`w-px ${tick.major ? 'h-3 bg-secondary/60' : 'h-2 bg-secondary/30'}`}
                    />
                    {/* Time label (only for major ticks) */}
                    {tick.major && (
                        <span className="text-[10px] text-secondary/60 mt-0.5 select-none">
                            {formatTime(tick.time)}
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}
