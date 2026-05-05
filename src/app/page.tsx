/**
 * Demo Page
 * 
 * Shows the video editor with mock data for development/testing.
 */

'use client'

import React, { useMemo, useState } from 'react'
import { ArrowRight, Cpu, Film, Link2, Loader2, UploadCloud, X } from 'lucide-react'
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
    const dynamicShots: SourceShot[] = useMemo(() => {
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
            a.download = `frameforge-edit-${manifest.jobId}.mp4`
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
            <div className="min-h-screen bg-background ff-grid flex items-center justify-center p-4 text-foreground">
                <div className="w-full max-w-[560px] ff-panel rounded-lg p-6">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                                <Cpu size={13} />
                                Agentic browser studio
                            </div>
                            <h1 className="text-[32px] font-semibold leading-tight text-foreground">
                                FrameForge
                            </h1>
                            <p className="mt-2 max-w-[440px] text-sm leading-6 text-secondary">
                                Load a source video, inspect the timeline, and hand off precise edits to the agent without leaving the browser.
                            </p>
                        </div>
                        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary sm:flex">
                            <Film size={22} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                                <Link2 size={13} />
                                Video URL
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    className="w-full rounded-md border border-primary/20 bg-[#050608]/80 py-3 pl-4 pr-10 text-sm text-foreground placeholder:text-secondary/50 outline-none transition-colors focus:border-primary/60"
                                    placeholder="https://..."
                                />
                                {videoUrl && (
                                    <button
                                        onClick={() => setVideoUrl('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-secondary hover:bg-white/5 hover:text-foreground"
                                        title="Clear"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Local File Upload */}
                        <div className="relative">
                            <div className="my-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-secondary/70">
                                <span className="h-px flex-1 bg-primary/10" />
                                <span>or</span>
                                <span className="h-px flex-1 bg-primary/10" />
                            </div>
                            <label
                                className="group block w-full cursor-pointer rounded-lg border border-dashed border-primary/20 bg-[#080b10]/70 p-6 text-center transition-colors hover:border-primary/50 hover:bg-[#0c1118]/90"
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary/50') }}
                                onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary/50') }}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    e.currentTarget.classList.remove('border-primary/50')
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
                                <UploadCloud className="mx-auto mb-3 text-secondary transition-colors group-hover:text-primary" size={32} />
                                <span className="text-sm text-secondary">
                                    Drag a video file here, or <span className="text-primary">browse media</span>
                                </span>
                            </label>
                            {videoUrl.startsWith('blob:') && (
                                <p className="mt-2 text-center text-xs text-accent">Local file loaded</p>
                            )}
                            {error && <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                        </div>

                        <button
                            onClick={handleLaunch}
                            disabled={isLoading || !videoUrl}
                            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={17} />
                                    <span>Loading metadata</span>
                                </>
                            ) : (
                                <>
                                    <span>Launch Editor</span>
                                    <ArrowRight size={17} />
                                </>
                            )}
                        </button>

                        <div className="border-t border-primary/10 pt-4">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">Preset Sources</p>
                                <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-accent">
                                    ready
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setVideoUrl('https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')}
                                    className="ff-control rounded-md px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:text-foreground"
                                >
                                    Big Buck Bunny
                                </button>
                                <button
                                    onClick={() => setVideoUrl('https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4')}
                                    className="ff-control rounded-md px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:text-foreground"
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
