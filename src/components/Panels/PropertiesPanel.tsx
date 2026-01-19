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
                {selectedClip.type === 'overlay' && (
                    <OverlayClipProperties
                        clip={selectedClip as OverlayClip}
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
            <div className="space-y-4 pt-4 border-t border-border/20">
                <p className="text-xs text-secondary font-medium">Color Correction</p>

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
                        step="0.05"
                        value={clip.volume}
                        onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
                        className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-foreground w-12 text-right">
                        {Math.round(clip.volume * 100)}%
                    </span>
                </div>
            </div>

            {/* Mute logic */}
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

            {/* Auto Ducking (Only for BGM/SFX) */}
            {clip.trackType !== 'voiceover' && (
                <div className="flex items-center justify-between pt-2 border-t border-border/20">
                    <label className="text-xs text-secondary">Auto-Duck against Voice</label>
                    {/* Placeholder for future implementation */}
                    <div className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded">
                        Recommended
                    </div>
                </div>
            )}

            {/* Fades */}
            <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                    <label className="text-xs text-secondary">Fade In (s)</label>
                    <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={clip.fadeIn}
                        onChange={(e) => onUpdate({ fadeIn: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full bg-card/50 border border-border/30 rounded px-2 py-1 text-sm"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-secondary">Fade Out (s)</label>
                    <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={clip.fadeOut}
                        onChange={(e) => onUpdate({ fadeOut: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full bg-card/50 border border-border/30 rounded px-2 py-1 text-sm"
                    />
                </div>
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

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
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

                <div className="space-y-2">
                    <label className="text-xs text-secondary">Background</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={clip.style.backgroundColor}
                            onChange={(e) => onUpdate({
                                style: { ...clip.style, backgroundColor: e.target.value }
                            })}
                            className="w-8 h-8 rounded border-0 cursor-pointer"
                        />
                    </div>
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

// ============================================================================
// OVERLAY CLIP PROPERTIES
// ============================================================================

interface OverlayClipPropertiesProps {
    clip: OverlayClip
    onUpdate: (updates: Partial<OverlayClip>) => void
}

const OverlayClipProperties: React.FC<OverlayClipPropertiesProps> = ({ clip, onUpdate }) => {
    // Helper to update position
    const updatePosition = (key: keyof OverlayClip['position'], value: number) => {
        onUpdate({
            position: {
                ...clip.position,
                [key]: value
            }
        })
    }

    return (
        <>
            {/* Opacity */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Opacity</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={clip.opacity}
                        onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
                        className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-foreground w-10 text-right">
                        {Math.round(clip.opacity * 100)}%
                    </span>
                </div>
            </div>

            <div className="w-full h-[1px] bg-border/20 my-2" />

            {/* Scale (Width/Height linked for now) */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Scale</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.05"
                        value={clip.position.width} // Assuming aspect ratio lock for simple UI
                        onChange={(e) => {
                            const scale = parseFloat(e.target.value)
                            onUpdate({
                                position: {
                                    ...clip.position,
                                    width: scale,
                                    height: scale // Maintain video aspect ratio roughly
                                }
                            })
                        }}
                        className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-foreground w-10 text-right">
                        {clip.position.width.toFixed(1)}x
                    </span>
                </div>
            </div>

            {/* Rotation */}
            <div className="space-y-2">
                <label className="text-xs text-secondary">Rotation</label>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="-180"
                        max="180"
                        step="5"
                        value={clip.position.rotation}
                        onChange={(e) => updatePosition('rotation', parseInt(e.target.value))}
                        className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-foreground w-10 text-right">
                        {clip.position.rotation}°
                    </span>
                </div>
            </div>

            {/* Position X/Y */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs text-secondary">Position X</label>
                    <input
                        type="number"
                        step="0.05"
                        value={clip.position.x}
                        onChange={(e) => updatePosition('x', parseFloat(e.target.value))}
                        className="w-full bg-card/50 border border-border/30 rounded px-2 py-1 text-xs text-foreground"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-secondary">Position Y</label>
                    <input
                        type="number"
                        step="0.05"
                        value={clip.position.y}
                        onChange={(e) => updatePosition('y', parseFloat(e.target.value))}
                        className="w-full bg-card/50 border border-border/30 rounded px-2 py-1 text-xs text-foreground"
                    />
                </div>
            </div>

            <p className="text-[10px] text-secondary/50 pt-2">
                * Drag preview to move (Coming Soon)
            </p>
        </>
    )
}
