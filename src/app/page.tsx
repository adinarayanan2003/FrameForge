/**
 * Demo Page
 * 
 * Shows the video editor with mock data for development/testing.
 */

'use client'

import React, { useState, useMemo } from 'react'
import { VideoEditor } from '@/components/VideoEditor'
import { SourceVideo, SourceShot, EditManifest } from '@/types/editor'

// Mock data for demo
const mockVideo: SourceVideo = {
    jobId: 'demo-job-123',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 60,
    width: 1920,
    height: 1080,
    fps: 24, // Fix: Use 24fps to match source video
    aspectRatio: '16:9',
}

export default function DemoPage() {
    const [isStarted, setIsStarted] = useState(false)
    const [videoUrl, setVideoUrl] = useState(mockVideo.videoUrl)
    const [metadata, setMetadata] = useState<Partial<SourceVideo>>({ ...mockVideo })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLaunch = () => {
        setIsLoading(true)
        setError(null)

        // Create a temporary video element to get metadata
        const video = document.createElement('video')
        video.src = videoUrl
        video.crossOrigin = 'anonymous'

        video.onloadedmetadata = () => {
            const duration = video.duration
            const width = video.videoWidth
            const height = video.videoHeight
            const fps = 30 // Assume 30fps as we can't easily detect it from DOM

            setMetadata({
                ...mockVideo,
                videoUrl,
                duration,
                width,
                height,
                fps: videoUrl.includes('BigBuckBunny') ? 24 : 30, // Heuristic for demo
                aspectRatio: width > height ? '16:9' : '9:16',
                jobId: `demo-${Date.now()}`,
                // Demo: Use same video URL for all audio tracks to test multi-track
                voiceoverUrl: videoUrl,
                bgmUrl: videoUrl,
                sfxUrl: videoUrl,
            })
            setIsStarted(true)
            setIsLoading(false)
            video.remove()
        }

        video.onerror = (e) => {
            console.error('Video load error:', e)
            setError('Failed to load video. Please check the URL.')
            setIsLoading(false)
            video.remove()
        }
    }

    // Generate dynamic shots based on loaded metadata
    const dynamicShots: SourceShot[] = React.useMemo(() => {
        if (!metadata.duration) return []
        return [
            {
                shotId: `shot-initial`,
                shotNumber: 1,
                voiceover: 'Dynamic shot created from your video.',
                sceneDescription: 'Full video clip',
                startTime: 0,
                endTime: metadata.duration,
                duration: metadata.duration,
            }
        ]
    }, [metadata.duration])

    const handleSave = async (manifest: EditManifest) => {
        console.log('💾 Save manifest:', manifest)
        // In production, send to your backend API
        await new Promise((resolve) => setTimeout(resolve, 1000))
        alert('Edits saved! Check console for manifest JSON.')
    }

    const handleExport = async (manifest: EditManifest) => {
        console.log('🎬 Export manifest:', manifest)

        try {
            const response = await fetch('/api/render', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ manifest }),
            })

            if (!response.ok) {
                let errorMessage = 'Failed to export video'
                try {
                    const errorData = await response.json()
                    errorMessage = errorData.error || errorMessage
                } catch (e) {
                    // Not JSON, likely a 500 error page
                    errorMessage = `Export failed (Status ${response.status}). The server might be restarting or crashing.`
                }
                throw new Error(errorMessage)
            }

            // Get the blob from response
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)

            // Create a temporary link and click it
            const a = document.createElement('a')
            a.href = url
            a.download = `owly-edit-${manifest.jobId}.mp4`
            document.body.appendChild(a)
            a.click()

            // Cleanup
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            console.error('Export failed:', err)
            throw err // Re-throw so VideoEditor can catch and show error
        }
    }

    const handleClose = () => {
        setIsStarted(false)
        setIsLoading(false)
    }

    const uploadFile = async (file: File): Promise<string> => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            let errorMessage = 'Upload failed'
            try {
                const errorData = await response.json()
                errorMessage = errorData.error || errorMessage
            } catch (e) {
                errorMessage = `Upload failed (Status ${response.status}).`
            }
            throw new Error(errorMessage)
        }

        const data = await response.json()
        return data.url // e.g., 'uploads/filename.mp4'
    }

    const handleFileSelect = async (file: File) => {
        if (!file || !file.type.startsWith('video/')) return

        setIsLoading(true)
        setError(null)

        try {
            const uploadedUrl = await uploadFile(file)
            setVideoUrl(uploadedUrl)

            // Still need a blob URL for metadata extraction since the server path might not be ready in-DOM
            const tempBlobUrl = URL.createObjectURL(file)
            const video = document.createElement('video')
            video.src = tempBlobUrl
            video.crossOrigin = 'anonymous'

            video.onloadedmetadata = () => {
                const duration = video.duration
                const width = video.videoWidth
                const height = video.videoHeight

                setMetadata({
                    ...mockVideo,
                    videoUrl: uploadedUrl,
                    duration,
                    width,
                    height,
                    fps: 30, // Default to 30 for uploaded files
                    aspectRatio: width > height ? '16:9' : '9:16',
                    jobId: `local-${Date.now()}`,
                    voiceoverUrl: uploadedUrl,
                    bgmUrl: uploadedUrl,
                    sfxUrl: uploadedUrl,
                })
                setIsStarted(true)
                setIsLoading(false)
                video.remove()
                URL.revokeObjectURL(tempBlobUrl)
            }

            video.onerror = (e) => {
                console.error('Metadata extraction error:', e)
                setError('Failed to extract video metadata.')
                setIsLoading(false)
                video.remove()
                URL.revokeObjectURL(tempBlobUrl)
            }
        } catch (err) {
            console.error('File import failed:', err)
            setError(err instanceof Error ? err.message : 'Failed to import file')
            setIsLoading(false)
        }
    }

    if (!isStarted) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700">
                    <h1 className="text-2xl font-bold text-white mb-6">Owly Editor Demo</h1>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Video URL
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-4 pr-10 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="https://..."
                                />
                                {videoUrl && (
                                    <button
                                        onClick={() => setVideoUrl('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                        title="Clear"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Local File Upload */}
                        <div className="relative">
                            <div className="text-center text-slate-500 text-xs my-2">— or —</div>
                            <label
                                className="block w-full border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-lg p-6 cursor-pointer transition-colors text-center"
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500') }}
                                onDragLeave={(e) => { e.currentTarget.classList.remove('border-indigo-500') }}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    e.currentTarget.classList.remove('border-indigo-500')
                                    const file = e.dataTransfer.files[0]
                                    handleFileSelect(file)
                                }}
                            >
                                <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileSelect(file)
                                    }}
                                />
                                <svg className="w-8 h-8 mx-auto text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-sm text-slate-400">
                                    Drag & drop a video file, or <span className="text-indigo-400 underline">browse</span>
                                </span>
                            </label>
                            {videoUrl.startsWith('blob:') && (
                                <p className="text-xs text-green-400 mt-2 text-center">✓ Local file loaded</p>
                            )}
                            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                        </div>

                        <button
                            onClick={handleLaunch}
                            disabled={isLoading || !videoUrl}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <span>Loading Metadata...</span>
                            ) : (
                                <>
                                    <span>Launch Editor</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </>
                            )}
                        </button>

                        <div className="pt-4 border-t border-slate-700">
                            <p className="text-sm text-slate-400 mb-2">Preset Examples:</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setVideoUrl('https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')}
                                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded"
                                >
                                    Big Buck Bunny
                                </button>
                                <button
                                    onClick={() => setVideoUrl('https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4')}
                                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded"
                                >
                                    Tears of Steel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <main className="h-screen">
            <VideoEditor
                video={metadata as SourceVideo}
                shots={dynamicShots}
                onSave={handleSave}
                onExport={handleExport}
                onUpload={uploadFile}
                onClose={handleClose}
                className="h-full"
            />
        </main>
    )
}
