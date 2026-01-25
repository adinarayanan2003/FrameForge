/**
 * Editor Toolbar
 * 
 * Main toolbar with undo/redo, editing tools, and export.
 */

'use client'

import React, { useState } from 'react'
import { useEditorStore, selectCanUndo, selectCanRedo, selectSelectedClip } from '@/store/editorStore'
import {
    Undo2,
    Redo2,
    Scissors,
    Trash2,
    Download,
    Save,
    Volume2,
    VolumeX,
    Lock,
    Unlock,
    X,
    Monitor,
    Smartphone,
    FilePlus2
} from 'lucide-react'

interface EditorToolbarProps {
    onSave?: () => void
    onExport?: () => void
    onClose?: () => void
    onUpload?: (file: File) => Promise<string>
    isSaving?: boolean
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    onSave,
    onExport,
    onClose,
    onUpload,
    isSaving = false,
}) => {
    const {
        selectedClipId,
        isDirty,
        undo,
        redo,
        deleteClip,
        updateClip,
        splitClipAtPlayhead,
        exportSettings,
        toggleAspectRatio,
        addCustomVideoClip,
        addAudioClip,
        addOverlayClip,
    } = useEditorStore()

    const canUndo = useEditorStore(selectCanUndo)
    const canRedo = useEditorStore(selectCanRedo)
    const selectedClip = useEditorStore(selectSelectedClip)

    const [showExportMenu, setShowExportMenu] = useState(false)

    const handleSplit = () => {
        if (selectedClipId) {
            splitClipAtPlayhead(selectedClipId)
        }
    }

    const handleDelete = () => {
        if (selectedClipId) {
            deleteClip(selectedClipId)
        }
    }

    const handleToggleLock = () => {
        if (selectedClipId && selectedClip) {
            updateClip(selectedClipId, { locked: !selectedClip.locked })
        }
    }

    const handleToggleMute = () => {
        if (selectedClipId && selectedClip?.type === 'audio') {
            updateClip(selectedClipId, { muted: !selectedClip.muted })
        }
    }

    const handleImportMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // 1. Create a temporary blob URL for instant feedback
        const blobUrl = URL.createObjectURL(file)
        let clipId: string | null = null

        // 2. Add the clip to the store immediately (optimistic UI)
        if (file.type.startsWith('image/')) {
            const type = file.type.includes('svg') || file.type.includes('png') ? 'logo' : 'image'
            clipId = addOverlayClip(blobUrl, type)
        } else if (file.type.startsWith('audio/')) {
            const audio = document.createElement('audio')
            audio.src = blobUrl
            await new Promise((resolve) => {
                audio.onloadedmetadata = () => {
                    clipId = addAudioClip(blobUrl, audio.duration, 'sfx')
                    audio.remove()
                    resolve(null)
                }
            })
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video')
            video.src = blobUrl
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    clipId = addCustomVideoClip(blobUrl, video.duration, video.videoWidth, video.videoHeight)
                    video.remove()
                    resolve(null)
                }
            })
        }

        // 3. Trigger background upload and update the clip path
        if (clipId && onUpload) {
            onUpload(file).then((serverUrl) => {
                if (file.type.startsWith('image/')) {
                    updateClip(clipId!, { content: serverUrl })
                } else if (file.type.startsWith('audio/')) {
                    updateClip(clipId!, { source: serverUrl })
                } else if (file.type.startsWith('video/')) {
                    updateClip(clipId!, { customVideoUrl: serverUrl })
                }
                URL.revokeObjectURL(blobUrl)
                console.log('✅ Background upload complete:', serverUrl)
            }).catch((err) => {
                console.error('❌ Background upload failed:', err)
                // We keep the blob URL so it still works in the session
            })
        }

        // Reset input
        e.target.value = ''
    }

    return (
        <div className="flex items-center justify-between px-4 py-2 bg-card/30 border-b border-border/20">
            {/* Left section: Close and title */}
            <div className="flex items-center gap-4">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors"
                        title="Close editor"
                    >
                        <X size={20} />
                    </button>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">Video Editor</span>
                    {isDirty && (
                        <span className="text-xs text-secondary italic">• Unsaved changes</span>
                    )}
                </div>
            </div>

            {/* Center section: Editing tools */}
            <div className="flex items-center gap-1">
                {/* Undo/Redo */}
                <div className="flex items-center border-r border-border/20 pr-2 mr-2">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="p-2 text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Undo (Cmd+Z)"
                    >
                        <Undo2 size={18} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="p-2 text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Redo (Cmd+Shift+Z)"
                    >
                        <Redo2 size={18} />
                    </button>
                </div>

                {/* Clip tools */}
                <button
                    onClick={handleSplit}
                    disabled={!selectedClipId}
                    className="p-2 text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Split at playhead (S)"
                >
                    <Scissors size={18} />
                </button>

                <button
                    onClick={handleDelete}
                    disabled={!selectedClipId}
                    className="p-2 text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Delete clip (Delete)"
                >
                    <Trash2 size={18} />
                </button>

                <button
                    onClick={handleToggleLock}
                    disabled={!selectedClipId}
                    className="p-2 text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={selectedClip?.locked ? 'Unlock clip' : 'Lock clip'}
                >
                    {selectedClip?.locked ? <Lock size={18} /> : <Unlock size={18} />}
                </button>

                {selectedClip?.type === 'audio' && (
                    <button
                        onClick={handleToggleMute}
                        className="p-2 text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors"
                        title={selectedClip.muted ? 'Unmute' : 'Mute'}
                    >
                        {selectedClip.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                )}

                <div className="w-[1px] h-4 bg-border/20 mx-2" />

                {/* Import Media */}
                <label className="p-2 text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors cursor-pointer" title="Import media file">
                    <FilePlus2 size={18} />
                    <input
                        type="file"
                        accept="video/*, audio/*, image/*"
                        className="hidden"
                        onChange={handleImportMedia}
                    />
                </label>

                {/* Aspect Ratio Toggle */}
                <button
                    onClick={toggleAspectRatio}
                    className="flex items-center gap-2 px-3 py-1.5 text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors"
                    title={`Switch to ${exportSettings.aspectRatio === '16:9' ? '9:16' : '16:9'} aspect ratio`}
                >
                    {exportSettings.aspectRatio === '16:9' ? <Monitor size={18} /> : <Smartphone size={18} />}
                    <span className="text-xs font-medium">{exportSettings.aspectRatio}</span>
                </button>
            </div>

            {/* Right section: Save and Export */}
            <div className="flex items-center gap-2">
                {onSave && (
                    <button
                        onClick={onSave}
                        disabled={!isDirty || isSaving}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-secondary hover:text-foreground hover:bg-card/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Save edits"
                    >
                        <Save size={16} />
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                )}

                {onExport && (
                    <button
                        onClick={onExport}
                        className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                        <Download size={16} />
                        <span>Export</span>
                    </button>
                )}
            </div>
        </div>
    )
}
