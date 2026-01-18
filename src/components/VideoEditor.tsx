/**
 * Video Editor
 * 
 * Main video editor component that integrates all parts.
 * This is the primary export for the owly_editor module.
 */

'use client'

import React, { useEffect, useCallback, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { SourceVideo, SourceShot, EditManifest } from '@/types/editor'
import { EditorToolbar } from './Toolbar'
import { VideoPreview } from './Preview'
import { Timeline } from './Timeline'
import { PropertiesPanel } from './Panels/PropertiesPanel'

// ============================================================================
// TYPES
// ============================================================================

export interface VideoEditorProps {
    /** Source video data */
    video: SourceVideo
    /** Original storyboard shots for subtitle/timing data */
    shots?: SourceShot[]
    /** Called when user saves edits (returns JSON manifest) */
    onSave?: (manifest: EditManifest) => Promise<void>
    /** Called when user exports final video */
    onExport?: (manifest: EditManifest) => Promise<void>
    /** Called when user closes the editor */
    onClose?: () => void
    /** Additional CSS classes */
    className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export const VideoEditor: React.FC<VideoEditorProps> = ({
    video,
    shots = [],
    onSave,
    onExport,
    onClose,
    className = '',
}) => {
    const {
        setSource,
        setShots,
        initializeFromShots,
        generateManifest,
        markSaved,
        reset,
        isDirty,
    } = useEditorStore()

    const [isSaving, setIsSaving] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Initialize editor state from props
    useEffect(() => {
        setSource(video)
        setShots(shots)
        initializeFromShots()

        // Cleanup on unmount
        return () => {
            reset()
        }
    }, [video, shots, setSource, setShots, initializeFromShots, reset])

    // Handle save
    const handleSave = useCallback(async () => {
        if (!onSave) return

        const manifest = generateManifest()
        if (!manifest) {
            setError('Failed to generate edit manifest')
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            await onSave(manifest)
            markSaved()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setIsSaving(false)
        }
    }, [onSave, generateManifest, markSaved])

    // Handle export
    const handleExport = useCallback(async () => {
        if (!onExport) return

        const manifest = generateManifest()
        if (!manifest) {
            setError('Failed to generate edit manifest')
            return
        }

        setIsExporting(true)
        setError(null)

        try {
            await onExport(manifest)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export')
        } finally {
            setIsExporting(false)
        }
    }, [onExport, generateManifest])

    // Handle close with unsaved changes warning
    const handleClose = useCallback(() => {
        if (isDirty) {
            const confirmed = window.confirm(
                'You have unsaved changes. Are you sure you want to close?'
            )
            if (!confirmed) return
        }
        onClose?.()
    }, [isDirty, onClose])

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).tagName === 'TEXTAREA') return

            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault()
                if (e.shiftKey) {
                    useEditorStore.getState().redo()
                } else {
                    useEditorStore.getState().undo()
                }
            }

            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleSave])

    return (
        <div className={`flex flex-col h-full bg-background ${className}`}>
            {/* Toolbar */}
            <EditorToolbar
                onSave={onSave ? handleSave : undefined}
                onExport={onExport ? handleExport : undefined}
                onClose={onClose ? handleClose : undefined}
                isSaving={isSaving}
            />

            {/* Error message */}
            {error && (
                <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            {/* Main content area */}
            <div className="flex-1 flex min-h-0">
                {/* Preview */}
                <div className="flex-1 flex flex-col min-w-0">
                    <VideoPreview className="flex-1 min-h-0" />
                </div>

                {/* Properties panel */}
                <PropertiesPanel className="w-80 border-l border-border/20" />
            </div>

            {/* Timeline */}
            <Timeline className="flex-shrink-0" />

            {/* Export loading overlay */}
            {isExporting && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-foreground font-medium">Exporting video...</p>
                        <p className="text-sm text-secondary mt-1">This may take a few minutes</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default VideoEditor
