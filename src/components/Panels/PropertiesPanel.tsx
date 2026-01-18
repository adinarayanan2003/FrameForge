/**
 * Properties Panel
 * 
 * Shows and allows editing of selected clip properties.
 */

'use client'

import React from 'react'
import { useEditorStore, selectSelectedClip } from '@/store/editorStore'
import { VideoClip, AudioClip, SubtitleClip, OverlayClip } from '@/types/editor'

interface PropertiesPanelProps {
    className?: string
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ className = '' }) => {
    const selectedClip = useEditorStore(selectSelectedClip)
    const { updateClip } = useEditorStore()

    if (!selectedClip) {
        return (
            <div className={`p-4 ${className}`}>
                <p className="text-sm text-secondary text-center py-8">
                    Select a clip to edit its properties
                </p>
            </div>
        )
    }

    return (
        <div className={`flex flex-col overflow-y-auto ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-border/20">
                <h3 className="text-sm font-medium text-foreground capitalize">
                    {selectedClip.type} Properties
                </h3>
            </div>

            {/* Content based on clip type */}
            <div className="p-4 space-y-4">
                {selectedClip.type === 'video' && (
                    <VideoClipProperties
                        clip={selectedClip as VideoClip}
                        onUpdate={(updates) => updateClip(selectedClip.id, updates)}
                    />
                )}
                {selectedClip.type === 'audio' && (
                    <AudioClipProperties
                        clip={selectedClip as AudioClip}
                        onUpdate={(updates) => updateClip(selectedClip.id, updates)}
                    />
                )}
                {selectedClip.type === 'subtitle' && (
                    <SubtitleClipProperties
                        clip={selectedClip as SubtitleClip}
                        onUpdate={(updates) => updateClip(selectedClip.id, updates)}
                    />
                )}
            </div>
        </div>
    )
}

// ============================================================================
// VIDEO CLIP PROPERTIES
// ============================================================================

interface VideoClipPropertiesProps {
    clip: VideoClip
    onUpdate: (updates: Partial<VideoClip>) => void
}

const VideoClipProperties: React.FC<VideoClipPropertiesProps> = ({ clip, onUpdate }) => {
    const duration = clip.timelineEnd - clip.timelineStart

    return (
        <>
            {/* Duration info */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Duration</label>
                <p className="text-sm text-foreground">{duration.toFixed(2)}s</p>
            </div>

            {/* Speed */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Speed</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="0.25"
                        max="2"
                        step="0.25"
                        value={clip.speed}
                        onChange={(e) => onUpdate({ speed: parseFloat(e.target.value) })}
                        className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-foreground w-12 text-right">{clip.speed}x</span>
                </div>
            </div>

            {/* Filters */}
            <div className="space-y-3 pt-2 border-t border-border/20">
                <p className="text-xs text-secondary font-medium">Filters</p>

                <div className="space-y-2">
                    <label className="text-xs text-secondary">Brightness</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="-50"
                            max="50"
                            value={clip.filters.brightness}
                            onChange={(e) => onUpdate({
                                filters: { ...clip.filters, brightness: parseInt(e.target.value) }
                            })}
                            className="flex-1 accent-primary"
                        />
                        <span className="text-xs text-foreground w-8 text-right">{clip.filters.brightness}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-secondary">Contrast</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="-50"
                            max="50"
                            value={clip.filters.contrast}
                            onChange={(e) => onUpdate({
                                filters: { ...clip.filters, contrast: parseInt(e.target.value) }
                            })}
                            className="flex-1 accent-primary"
                        />
                        <span className="text-xs text-foreground w-8 text-right">{clip.filters.contrast}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-secondary">Saturation</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="-50"
                            max="50"
                            value={clip.filters.saturation}
                            onChange={(e) => onUpdate({
                                filters: { ...clip.filters, saturation: parseInt(e.target.value) }
                            })}
                            className="flex-1 accent-primary"
                        />
                        <span className="text-xs text-foreground w-8 text-right">{clip.filters.saturation}</span>
                    </div>
                </div>
            </div>
        </>
    )
}

// ============================================================================
// AUDIO CLIP PROPERTIES
// ============================================================================

interface AudioClipPropertiesProps {
    clip: AudioClip
    onUpdate: (updates: Partial<AudioClip>) => void
}

const AudioClipProperties: React.FC<AudioClipPropertiesProps> = ({ clip, onUpdate }) => {
    return (
        <>
            {/* Volume */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Volume</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={clip.volume}
                        onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
                        className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-foreground w-12 text-right">
                        {Math.round(clip.volume * 100)}%
                    </span>
                </div>
            </div>

            {/* Mute toggle */}
            <div className="flex items-center justify-between">
                <label className="text-xs text-secondary">Muted</label>
                <button
                    onClick={() => onUpdate({ muted: !clip.muted })}
                    className={`w-10 h-5 rounded-full transition-colors ${clip.muted ? 'bg-destructive' : 'bg-accent'
                        }`}
                >
                    <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform ${clip.muted ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                    />
                </button>
            </div>

            {/* Fade in */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Fade In (seconds)</label>
                <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={clip.fadeIn}
                    onChange={(e) => onUpdate({ fadeIn: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-card/50 border border-border/30 rounded-lg px-3 py-1.5 text-sm text-foreground"
                />
            </div>

            {/* Fade out */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Fade Out (seconds)</label>
                <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={clip.fadeOut}
                    onChange={(e) => onUpdate({ fadeOut: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-card/50 border border-border/30 rounded-lg px-3 py-1.5 text-sm text-foreground"
                />
            </div>
        </>
    )
}

// ============================================================================
// SUBTITLE CLIP PROPERTIES
// ============================================================================

interface SubtitleClipPropertiesProps {
    clip: SubtitleClip
    onUpdate: (updates: Partial<SubtitleClip>) => void
}

const SubtitleClipProperties: React.FC<SubtitleClipPropertiesProps> = ({ clip, onUpdate }) => {
    return (
        <>
            {/* Text */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Text</label>
                <textarea
                    value={clip.text}
                    onChange={(e) => onUpdate({ text: e.target.value })}
                    className="w-full bg-card/50 border border-border/30 rounded-lg px-3 py-2 text-sm text-foreground min-h-[80px] resize-none"
                    placeholder="Subtitle text..."
                />
            </div>

            {/* Font size */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Font Size</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="12"
                        max="48"
                        value={clip.style.fontSize}
                        onChange={(e) => onUpdate({
                            style: { ...clip.style, fontSize: parseInt(e.target.value) }
                        })}
                        className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-foreground w-10 text-right">{clip.style.fontSize}px</span>
                </div>
            </div>

            {/* Text color */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Text Color</label>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={clip.style.color}
                        onChange={(e) => onUpdate({
                            style: { ...clip.style, color: e.target.value }
                        })}
                        className="w-8 h-8 rounded border-0 cursor-pointer"
                    />
                    <span className="text-xs text-secondary font-mono">{clip.style.color}</span>
                </div>
            </div>

            {/* Position */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Vertical Position</label>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onUpdate({ style: { ...clip.style, verticalPosition: 0.1 } })}
                        className={`flex-1 py-1.5 text-xs rounded ${clip.style.verticalPosition < 0.5
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card/50 text-secondary'
                            }`}
                    >
                        Top
                    </button>
                    <button
                        onClick={() => onUpdate({ style: { ...clip.style, verticalPosition: 0.9 } })}
                        className={`flex-1 py-1.5 text-xs rounded ${clip.style.verticalPosition >= 0.5
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card/50 text-secondary'
                            }`}
                    >
                        Bottom
                    </button>
                </div>
            </div>

            {/* Style toggles */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onUpdate({ style: { ...clip.style, bold: !clip.style.bold } })}
                    className={`px-3 py-1.5 text-sm font-bold rounded ${clip.style.bold
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card/50 text-secondary'
                        }`}
                >
                    B
                </button>
                <button
                    onClick={() => onUpdate({ style: { ...clip.style, italic: !clip.style.italic } })}
                    className={`px-3 py-1.5 text-sm italic rounded ${clip.style.italic
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card/50 text-secondary'
                        }`}
                >
                    I
                </button>
                <button
                    onClick={() => onUpdate({ style: { ...clip.style, shadow: !clip.style.shadow } })}
                    className={`px-3 py-1.5 text-sm rounded ${clip.style.shadow
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card/50 text-secondary'
                        }`}
                >
                    Shadow
                </button>
            </div>
        </>
    )
}
