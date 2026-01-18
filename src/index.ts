/**
 * Owly Video Editor
 * 
 * A modular timeline-based video editor for post-processing AI-generated videos.
 * 
 * @example
 * ```tsx
 * import { VideoEditor } from '@owly/editor'
 * 
 * function EditPage({ video, shots }) {
 *   const handleSave = async (manifest) => {
 *     await fetch('/api/save-edits', {
 *       method: 'POST',
 *       body: JSON.stringify(manifest)
 *     })
 *   }
 * 
 *   const handleExport = async (manifest) => {
 *     // Send to Remotion render service
 *     await fetch('/api/render', {
 *       method: 'POST',
 *       body: JSON.stringify(manifest)
 *     })
 *   }
 * 
 *   return (
 *     <VideoEditor
 *       video={video}
 *       shots={shots}
 *       onSave={handleSave}
 *       onExport={handleExport}
 *       onClose={() => router.back()}
 *     />
 *   )
 * }
 * ```
 */

// Main component
export { VideoEditor, type VideoEditorProps } from './components/VideoEditor'

// Sub-components for custom layouts
export * from './components'

// State management
export { useEditorStore } from './store/editorStore'
export * from './store/editorStore'

// Types
export * from './types/editor'

// Remotion composition (for render backend)
export { VideoComposition, getCompositionConfig } from './remotion'
