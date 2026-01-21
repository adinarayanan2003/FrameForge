import { registerRoot, Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';
import { EditManifest } from '../types/editor';

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="OwlyVideoComposition"
            component={VideoComposition as any}
            durationInFrames={300} // Default, will be overridden by props
            fps={30}
            width={1920}
            height={1080}
            defaultProps={{
                manifest: {
                    clips: [],
                    source: {
                        videoUrl: '',
                        width: 1920,
                        height: 1080,
                        fps: 30,
                        duration: 10,
                        jobId: 'default',
                    },
                    timeline: {
                        duration: 10,
                        fps: 30,
                        width: 1920,
                        height: 1080
                    },
                    audio: {
                        masterVolume: 1
                    },
                    version: '1.0.0',
                    jobId: 'default',
                    createdAt: new Date().toISOString(),
                    modifiedAt: new Date().toISOString()
                } as unknown as EditManifest
            }}
        />
    );
};

registerRoot(RemotionRoot);
