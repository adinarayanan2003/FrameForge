/**
 * Remotion Video Composition
 *
 * This composition renders the edited video preview.
 * Used by @remotion/player for in-browser preview.
 * Same composition used by Remotion CLI/Lambda for final render.
 */

import {
    AbsoluteFill,
    Sequence,
    Video,
    Audio,
    useVideoConfig,
    interpolate,
    OffthreadVideo,
    useCurrentFrame,
    staticFile,
} from 'remotion'
import { EditManifest, VideoClip, AudioClip, SubtitleClip, OverlayClip, Clip } from '../types/editor'

// Fonts are now loaded lazily based on usage within the manifest
// avoiding keeping this at module level prevents unnecessary network requests

interface VideoCompositionProps {
    manifest: EditManifest
}

/**
 * Helper to resolve assets correctly.
 * If the URL is a local blob (from the browser), we return it as is.
 * Otherwise, we wrap it with staticFile() for Remotion rendering.
 */
const resolveAsset = (url: string) => {
    if (!url) return '';
    if (url.startsWith('blob:')) return url;
    return staticFile(url);
};

export const VideoComposition: React.FC<VideoCompositionProps> = ({ manifest }) => {
    const frame = useCurrentFrame()
    const { fps, width, height } = useVideoConfig()
    const currentTime = frame / fps

    // Get clips at current time
    const activeClips = manifest.clips.filter(
        (clip) => currentTime >= clip.timelineStart && currentTime < clip.timelineEnd
    )

    // Separate by type
    const videoClips = activeClips.filter((c): c is VideoClip => c.type === 'video')
    const audioClips = manifest.clips.filter((c): c is AudioClip => c.type === 'audio')
    const subtitleClips = activeClips.filter((c): c is SubtitleClip => c.type === 'subtitle')
    const overlayClips = activeClips.filter((c): c is OverlayClip => c.type === 'overlay')

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* Video layer */}
            {videoClips.map((clip) => (
                <VideoClipRenderer
                    key={clip.id}
                    clip={clip}
                    source={manifest.source}
                    fps={fps}
                />
            ))}

            {/* Audio layer */}
            {audioClips.map((clip) => (
                <AudioClipRenderer
                    key={clip.id}
                    clip={clip}
                    source={manifest.source}
                    masterVolume={manifest.audio.masterVolume}
                    fps={fps}
                />
            ))}

            {/* Subtitle layer */}
            {subtitleClips.map((clip) => (
                <SubtitleRenderer key={clip.id} clip={clip} />
            ))}

            {/* Overlay layer */}
            {overlayClips.map((clip) => (
                <OverlayRenderer key={clip.id} clip={clip} />
            ))}
        </AbsoluteFill>
    )
}

// ============================================================================
// VIDEO CLIP RENDERER
// ============================================================================

interface VideoClipRendererProps {
    clip: VideoClip
    source: EditManifest['source']
    fps: number
}

const VideoClipRenderer: React.FC<VideoClipRendererProps> = ({ clip, source, fps }) => {
    const startFrame = Math.round(clip.timelineStart * fps)
    const durationFrames = Math.round((clip.timelineEnd - clip.timelineStart) * fps)

    // Apply video filters only if changed
    const hasFilters = clip.filters.brightness !== 0 || clip.filters.contrast !== 0 || clip.filters.saturation !== 0

    const filterStyle = hasFilters ? {
        filter: `
      brightness(${100 + clip.filters.brightness}%)
      contrast(${100 + clip.filters.contrast}%)
      saturate(${100 + clip.filters.saturation}%)
    `.trim(),
    } : {}

    return (
        <Sequence from={startFrame} durationInFrames={durationFrames} premountFor={60}>
            <AbsoluteFill style={filterStyle}>
                <OffthreadVideo
                    src={resolveAsset(clip.customVideoUrl || source.videoUrl)}
                    startFrom={Math.max(0, Math.round(clip.sourceStart * fps))}
                    endAt={Math.max(0, Math.round(clip.sourceEnd * fps))}
                    playbackRate={clip.speed}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                    volume={clip.volume}
                    muted={clip.muted}
                    pauseWhenBuffering
                    onError={(e) => {
                        console.error(`❌ [Render Error] Video failed to load for clip ${clip.id}`);
                        const resolvedUrl = resolveAsset(clip.customVideoUrl || source.videoUrl);
                        console.error(`❌ [Render Error] Source URL: ${clip.customVideoUrl || source.videoUrl}`);
                        console.error(`❌ [Render Error] Resolved URL (resolveAsset): ${resolvedUrl}`);
                    }}
                />
            </AbsoluteFill>
        </Sequence>
    )
}

// ============================================================================
// AUDIO CLIP RENDERER
// ============================================================================

interface AudioClipRendererProps {
    clip: AudioClip
    source: EditManifest['source']
    masterVolume: number
    fps: number
}

const AudioClipRenderer: React.FC<AudioClipRendererProps> = ({ clip, source, masterVolume, fps }) => {
    const frame = useCurrentFrame()
    const startFrame = Math.round(clip.timelineStart * fps)
    const durationFrames = Math.round((clip.timelineEnd - clip.timelineStart) * fps)

    if (clip.muted) return null

    // Calculate volume with fade in/out
    const fadeInFrames = clip.fadeIn * fps
    const fadeOutFrames = clip.fadeOut * fps
    const localFrame = frame - startFrame

    let volume = clip.volume * masterVolume

    // Fade in
    if (fadeInFrames > 0 && localFrame < fadeInFrames) {
        volume = interpolate(localFrame, [0, fadeInFrames], [0, volume], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        })
    }

    // Fade out
    if (fadeOutFrames > 0 && localFrame > durationFrames - fadeOutFrames) {
        volume = interpolate(
            localFrame,
            [durationFrames - fadeOutFrames, durationFrames],
            [volume, 0],
            {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
            }
        )
    }

    const audioSrc = clip.source === 'original' ? source.videoUrl : clip.source

    // Check if source is a video file (blob or url)
    // For video files used as audio, we must use OffthreadVideo to get the sound
    const audioSrcClean = audioSrc.split('?')[0].toLowerCase()
    const isVideoExtension = audioSrcClean.endsWith('.mp4') || audioSrcClean.endsWith('.mov') || audioSrcClean.endsWith('.webm')
    const isAudioExtension = audioSrcClean.endsWith('.mp3') || audioSrcClean.endsWith('.wav') || audioSrcClean.endsWith('.aac') || audioSrcClean.endsWith('.m4a')

    const isVideoSource = (
        audioSrc.startsWith('blob:') ||
        isVideoExtension ||
        (clip.trackType === 'sfx' && !isAudioExtension)
    )

    return (
        <Sequence from={startFrame} durationInFrames={durationFrames} premountFor={60}>
            {isVideoSource ? (
                <OffthreadVideo
                    src={resolveAsset(audioSrc)}
                    startFrom={Math.max(0, Math.round(clip.sourceStart * fps))}
                    volume={volume}
                    // Hide the video, we only want audio
                    style={{ opacity: 0, width: 0, height: 0 }}
                    pauseWhenBuffering
                />
            ) : (
                <Audio
                    src={resolveAsset(audioSrc)}
                    startFrom={Math.max(0, Math.round(clip.sourceStart * fps))}
                    volume={volume}
                    pauseWhenBuffering
                />
            )}
        </Sequence>
    )
}

// ============================================================================
// SUBTITLE RENDERER
// ============================================================================

interface SubtitleRendererProps {
    clip: SubtitleClip
}

const SubtitleRenderer: React.FC<SubtitleRendererProps> = ({ clip }) => {
    const { fps } = useVideoConfig()
    const startFrame = Math.round(clip.timelineStart * fps)
    const durationFrames = Math.round((clip.timelineEnd - clip.timelineStart) * fps)
    const highlightWords = new Set(
        (clip.style.highlightWords || []).map((word) =>
            word.replace(/[^a-z0-9]/gi, '').toUpperCase()
        )
    )
    const parts = clip.text
        .replace(/\\\*/g, '*')
        .split(/(\*[^*]+\*)/g)
        .flatMap((part) => {
            const trimmed = part.trim()
            if (!trimmed) return []
            if (trimmed.startsWith('*') && trimmed.endsWith('*')) return [trimmed]
            return trimmed.split(/\s+/)
        })
        .filter((part) => part.trim().length > 0)

    return (
        <Sequence from={startFrame} durationInFrames={durationFrames}>
            <AbsoluteFill>
                <div
                    style={{
                        position: 'absolute',
                        top: `${clip.style.verticalPosition * 100}%`,
                        left: '50%',
                        transform: `translate(-50%, -${clip.style.verticalPosition * 100}%)`,
                        width: '80%',
                        display: 'flex',
                        justifyContent: 'center',
                        textAlign: clip.style.textAlign,
                    }}
                >
                    <div
                        style={{
                            fontFamily: clip.style.fontFamily,
                            fontSize: clip.style.fontSize,
                            color: clip.style.color,
                            backgroundColor: clip.style.backgroundColor,
                            padding: clip.style.backgroundColor === 'transparent' ? 0 : '8px 16px',
                            borderRadius: 4,
                            fontWeight: clip.style.bold ? 'bold' : 'normal',
                            fontStyle: clip.style.italic ? 'italic' : 'normal',
                            lineHeight: 1.05,
                            letterSpacing: 0,
                            textTransform: 'uppercase',
                            textShadow: clip.style.shadow ? '0 4px 14px rgba(0,0,0,0.75)' : 'none',
                            WebkitTextStroke: clip.style.strokeWidth ? `${clip.style.strokeWidth}px ${clip.style.stroke || '#000000'}` : undefined,
                            paintOrder: 'stroke fill',
                            filter: clip.style.animation === 'pop_in' ? 'drop-shadow(0 8px 18px rgba(0,0,0,0.45))' : undefined,
                        }}
                    >
                        {parts.map((part, index) => {
                            const isHighlighted = part.startsWith('*') && part.endsWith('*')
                            const text = (isHighlighted ? part.slice(1, -1) : part).replace(/\*/g, '').trim()
                            const normalized = text.replace(/[^a-z0-9]/gi, '').toUpperCase()
                            const shouldHighlight = isHighlighted || highlightWords.has(normalized)
                            return (
                                <span
                                    key={`${index}-${text}`}
                                    style={{
                                        color: shouldHighlight ? clip.style.highlightColor || '#FACC15' : clip.style.color,
                                    }}
                                >
                                    {text}
                                    {index < parts.length - 1 ? ' ' : ''}
                                </span>
                            )
                        })}
                    </div>
                </div>
            </AbsoluteFill>
        </Sequence>
    )
}

// ============================================================================
// OVERLAY RENDERER
// ============================================================================

interface OverlayRendererProps {
    clip: OverlayClip
}

const OverlayRenderer: React.FC<OverlayRendererProps> = ({ clip }) => {
    const { width, height, fps } = useVideoConfig()
    const startFrame = Math.round(clip.timelineStart * fps)
    const durationFrames = Math.round((clip.timelineEnd - clip.timelineStart) * fps)
    const { position } = clip

    const style: React.CSSProperties = {
        position: 'absolute',
        left: position.x * width,
        top: position.y * height,
        width: position.width * width,
        height: position.height * height,
        transform: `rotate(${position.rotation}deg)`,
        opacity: clip.opacity,
    }

    return (
        <Sequence from={startFrame} durationInFrames={durationFrames}>
            {clip.overlayType === 'text' && (
                <div
                    style={{
                        ...style,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 32,
                        fontWeight: 'bold',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                    }}
                >
                    {clip.content}
                </div>
            )}
            {(clip.overlayType === 'image' || clip.overlayType === 'logo') && (
                <img
                    src={resolveAsset(clip.content)}
                    alt=""
                    style={{
                        ...style,
                        objectFit: 'contain',
                    }}
                />
            )}
        </Sequence>
    )
}

// ============================================================================
// COMPOSITION CONFIG
// ============================================================================

export const getCompositionConfig = (manifest: EditManifest) => ({
    id: 'FrameForgeComposition',
    component: VideoComposition,
    durationInFrames: Math.ceil(manifest.timeline.duration * manifest.timeline.fps),
    fps: manifest.timeline.fps,
    width: manifest.timeline.width,
    height: manifest.timeline.height,
    defaultProps: {
        manifest,
    },
})
