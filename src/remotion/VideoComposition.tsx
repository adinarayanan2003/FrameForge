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
} from 'remotion'
import { EditManifest, VideoClip, AudioClip, SubtitleClip, OverlayClip, Clip } from '../types/editor'

// Fonts are now loaded lazily based on usage within the manifest
// avoiding keeping this at module level prevents unnecessary network requests

interface VideoCompositionProps {
    manifest: EditManifest
}

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
                    src={clip.customVideoUrl || source.videoUrl}
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
                        console.error(`❌ [Render Error] URL: ${clip.customVideoUrl || source.videoUrl}`);
                        // console.error(JSON.stringify(e));
                    }}
                    onLoadStart={() => {
                        console.log(`🎬 [Render] Loading video for clip ${clip.id}: ${clip.customVideoUrl || source.videoUrl}`);
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
    const isVideoSource = audioSrc.startsWith('blob:') ||
        audioSrc.endsWith('.mp4') ||
        audioSrc.endsWith('.mov') ||
        clip.trackType === 'sfx' // SFX layer often uses video source

    return (
        <Sequence from={startFrame} durationInFrames={durationFrames} premountFor={60}>
            {isVideoSource ? (
                <OffthreadVideo
                    src={audioSrc}
                    startFrom={Math.max(0, Math.round(clip.sourceStart * fps))}
                    endAt={Math.max(0, Math.round(clip.sourceEnd * fps))}
                    volume={volume}
                    // Hide the video, we only want audio
                    style={{ opacity: 0, width: 0, height: 0 }}
                    pauseWhenBuffering
                />
            ) : (
                <Audio
                    src={audioSrc}
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
    const { style } = clip
    const { fps } = useVideoConfig()
    const startFrame = Math.round(clip.timelineStart * fps)
    const durationFrames = Math.round((clip.timelineEnd - clip.timelineStart) * fps)

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
                            padding: '8px 16px',
                            borderRadius: 4,
                            fontWeight: clip.style.bold ? 'bold' : 'normal',
                            fontStyle: clip.style.italic ? 'italic' : 'normal',
                            textShadow: clip.style.shadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
                        }}
                    >
                        {clip.text}
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
                    src={clip.content}
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
    id: 'OwlyVideoComposition',
    component: VideoComposition,
    durationInFrames: Math.ceil(manifest.timeline.duration * manifest.timeline.fps),
    fps: manifest.timeline.fps,
    width: manifest.timeline.width,
    height: manifest.timeline.height,
    defaultProps: {
        manifest,
    },
})
