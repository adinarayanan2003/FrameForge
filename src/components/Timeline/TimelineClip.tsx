/**
 * Timeline Clip
 * 
 * A draggable/resizable clip on the timeline.
 * Supports drag to move, edge handles to trim.
 */

'use client'

import React, { useCallback, useState, useRef } from 'react'
import { Clip, VideoClip, AudioClip, SubtitleClip } from '@/types/editor'
import { useEditorStore } from '@/store/editorStore'

interface TimelineClipProps {
    clip: Clip
    color: string
    zoom: number
    isSelected: boolean
}

export const TimelineClip: React.FC<TimelineClipProps> = ({
    clip,
    color,
    zoom,
    isSelected,
}) => {
    const { selectClip, moveClip, trimClip } = useEditorStore()

    const [isDragging, setIsDragging] = useState(false)
    const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null)
    const dragStartRef = useRef<{ x: number; originalStart: number; originalEnd: number } | null>(null)

    // Calculate position and width
    const left = clip.timelineStart * zoom
    const width = (clip.timelineEnd - clip.timelineStart) * zoom
    const minWidth = 10 // Minimum clip width in pixels

    // Handle click to select
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        selectClip(clip.id)
    }, [clip.id, selectClip])

    // Handle drag start
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (clip.locked) return
        e.stopPropagation()
        e.preventDefault()

        setIsDragging(true)
        selectClip(clip.id)
        dragStartRef.current = {
            x: e.clientX,
            originalStart: clip.timelineStart,
            originalEnd: clip.timelineEnd,
        }

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!dragStartRef.current) return

            const deltaX = moveEvent.clientX - dragStartRef.current.x
            const deltaTime = deltaX / zoom
            const newStart = Math.max(0, dragStartRef.current.originalStart + deltaTime)

            moveClip(clip.id, newStart)
        }

        const handleMouseUp = () => {
            setIsDragging(false)
            dragStartRef.current = null
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [clip, zoom, selectClip, moveClip])

    // Handle trim start
    const handleTrimStart = useCallback((edge: 'start' | 'end') => (e: React.MouseEvent) => {
        if (clip.locked) return
        e.stopPropagation()
        e.preventDefault()

        setIsTrimming(edge)
        selectClip(clip.id)
        dragStartRef.current = {
            x: e.clientX,
            originalStart: clip.timelineStart,
            originalEnd: clip.timelineEnd,
        }

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!dragStartRef.current) return

            const deltaX = moveEvent.clientX - dragStartRef.current.x
            const deltaTime = deltaX / zoom

            if (edge === 'start') {
                const newStart = Math.max(0, dragStartRef.current.originalStart + deltaTime)
                // Don't allow start to go past end
                if ((dragStartRef.current.originalEnd - newStart) * zoom >= minWidth) {
                    trimClip(clip.id, 'start', newStart)
                }
            } else {
                const newEnd = dragStartRef.current.originalEnd + deltaTime
                // Don't allow end to go before start
                if ((newEnd - clip.timelineStart) * zoom >= minWidth) {
                    trimClip(clip.id, 'end', newEnd)
                }
            }
        }

        const handleMouseUp = () => {
            setIsTrimming(null)
            dragStartRef.current = null
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [clip, zoom, selectClip, trimClip])

    // Get clip label
    const getClipLabel = () => {
        switch (clip.type) {
            case 'video':
                return `Shot ${(clip as VideoClip).shotId.split('-').pop()}`
            case 'audio':
                const audioClip = clip as AudioClip
                if (audioClip.trackType === 'sfx') return '🔊 SFX'
                if (audioClip.trackType === 'voiceover') return '🎙️ Voiceover'
                if (audioClip.trackType === 'bgm') return '🎵 BGM'
                return audioClip.muted ? '🔇 Audio' : '🔊 Audio'
            case 'subtitle':
                const text = (clip as SubtitleClip).text
                return text.length > 20 ? text.slice(0, 20) + '...' : text
            case 'overlay':
                const overlay = clip as any // Cast as any to avoid import cycle if needed, or proper type
                return overlay.overlayType === 'text' ? '🔤 Text' : '🖼️ Image'
            default:
                return 'Clip'
        }
    }

    return (
        <div
            className={`
        absolute top-1 bottom-1 rounded-md overflow-hidden cursor-pointer
        transition-shadow duration-150
        ${color}
        ${isSelected ? 'ring-2 ring-white/80 shadow-lg' : 'hover:ring-1 hover:ring-white/40'}
        ${isDragging || isTrimming ? 'opacity-80' : ''}
        ${clip.locked ? 'opacity-50 cursor-not-allowed' : ''}
      `}
            style={{ left, width: Math.max(width, minWidth) }}
            onClick={handleClick}
            onMouseDown={handleDragStart}
        >
            {/* Clip content */}
            <div className="h-full px-2 py-1 flex flex-col justify-center overflow-hidden">
                <span className="text-[11px] font-medium text-white truncate drop-shadow-sm">
                    {getClipLabel()}
                </span>
                {clip.type === 'video' && width > 60 && (
                    <span className="text-[9px] text-white/70 truncate">
                        {formatDuration(clip.timelineEnd - clip.timelineStart)}
                    </span>
                )}
            </div>

            {/* Trim handles */}
            {!clip.locked && (
                <>
                    {/* Left trim handle */}
                    <div
                        className={`
              absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize
              bg-white/0 hover:bg-white/30 transition-colors
              ${isTrimming === 'start' ? 'bg-white/40' : ''}
            `}
                        onMouseDown={handleTrimStart('start')}
                    >
                        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" />
                    </div>

                    {/* Right trim handle */}
                    <div
                        className={`
              absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize
              bg-white/0 hover:bg-white/30 transition-colors
              ${isTrimming === 'end' ? 'bg-white/40' : ''}
            `}
                        onMouseDown={handleTrimStart('end')}
                    >
                        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" />
                    </div>
                </>
            )}
        </div>
    )
}

// Helper
const formatDuration = (seconds: number) => {
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
    return `${seconds.toFixed(1)}s`
}
