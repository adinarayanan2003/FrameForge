/**
 * Editor Toolbar
 * 
 * Main toolbar with undo/redo, editing tools, and export.
 */

'use client'

import React from 'react'
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
    FilePlus2,
    Sparkles
} from 'lucide-react'

interface EditorToolbarProps {
    onSave?: () => void
    onExport?: () => void
    onClose?: () => void
    onUpload?: (file: File) => Promise<string>
    isSaving?: boolean
    onToggleAgent?: () => void
    isAgentOpen?: boolean
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
    onSave,
    onExport,
    onClose,
    onUpload,
    isSaving = false,
    onToggleAgent,
    isAgentOpen = false,
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
        <div className="flex h-14 items-center justify-between border-b border-primary/10 bg-[#080b10]/90 px-3 backdrop-blur">
            {/* Left section: Close and title */}
            <div className="flex min-w-0 items-center gap-3">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="ff-control rounded-md p-2 text-secondary transition-colors hover:text-foreground"
                        title="Close editor"
                    >
                        <X size={18} />
                    </button>
                )}
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">FrameForge</div>
                    {isDirty && (
                        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">unsaved</div>
                    )}
                </div>
            </div>

            {/* Center section: Editing tools */}
            <div className="flex items-center gap-1">
                {/* Undo/Redo */}
                <div className="mr-2 flex items-center border-r border-primary/10 pr-2">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="rounded-md p-2 text-secondary transition-colors hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        title="Undo (Cmd+Z)"
                    >
                        <Undo2 size={18} />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="rounded-md p-2 text-secondary transition-colors hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        title="Redo (Cmd+Shift+Z)"
                    >
                        <Redo2 size={18} />
                    </button>
                </div>

                {/* Clip tools */}
                <button
                    onClick={handleSplit}
                    disabled={!selectedClipId}
                    className="rounded-md p-2 text-secondary transition-colors hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    title="Split at playhead (S)"
                >
                    <Scissors size={18} />
                </button>

                <button
                    onClick={handleDelete}
                    disabled={!selectedClipId}
                    className="rounded-md p-2 text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                    title="Delete clip (Delete)"
                >
                    <Trash2 size={18} />
                </button>

                <button
                    onClick={handleToggleLock}
                    disabled={!selectedClipId}
                    className="rounded-md p-2 text-secondary transition-colors hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                    title={selectedClip?.locked ? 'Unlock clip' : 'Lock clip'}
                >
                    {selectedClip?.locked ? <Lock size={18} /> : <Unlock size={18} />}
                </button>

                {selectedClip?.type === 'audio' && (
                    <button
                        onClick={handleToggleMute}
                        className="rounded-md p-2 text-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                        title={selectedClip.muted ? 'Unmute' : 'Mute'}
                    >
                        {selectedClip.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                )}

                <div className="mx-2 h-4 w-px bg-primary/10" />

                {onToggleAgent && (
                    <button
                        onClick={onToggleAgent}
                        className={`rounded-md p-2 transition-colors ${
                            isAgentOpen
                                ? 'border border-primary/25 bg-primary/10 text-primary shadow-[0_0_24px_rgba(139,216,255,0.12)]'
                                : 'text-secondary hover:bg-white/5 hover:text-foreground'
                        }`}
                        title="Agent editor"
                    >
                        <Sparkles size={18} />
                    </button>
                )}

                {/* Import Media */}
                <label className="cursor-pointer rounded-md p-2 text-secondary transition-colors hover:bg-white/5 hover:text-foreground" title="Import media file">
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
                    className="ff-control flex items-center gap-2 rounded-md px-3 py-1.5 text-secondary transition-colors hover:text-foreground"
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
                        className="ff-control flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-secondary transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        title="Save edits"
                    >
                        <Save size={16} />
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                )}

                {onExport && (
                    <button
                        onClick={onExport}
                        className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                        <Download size={16} />
                        <span>Export</span>
                    </button>
                )}
            </div>
        </div>
    )
}
