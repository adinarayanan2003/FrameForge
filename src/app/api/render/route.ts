import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { manifest } = body;

        if (!manifest) {
            console.error('❌ Missing manifest in request body');
            return NextResponse.json({ error: 'Manifest is required' }, { status: 400 });
        }

        console.log('🎬 Starting local render for jobId:', manifest.jobId);
        console.log('📄 Manifest source videoUrl:', manifest.source.videoUrl);

        // 1. Setup paths
        const entryPoint = path.join(process.cwd(), 'src/remotion/Root.tsx');
        const outputLocation = path.join(os.tmpdir(), `render-${manifest.jobId}-${Date.now()}.mp4`);

        // 2. Bundle the project
        console.log('📦 Bundling Remotion project...');
        const bundleLocation = await bundle({
            entryPoint,
            // Use staticFile logic if needed, but here it's already handled in VideoComposition
            publicDir: path.join(process.cwd(), 'public'),
        });

        // 3. Select the composition
        console.log('🔍 Selecting composition...');
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: 'FrameForgeComposition',
            inputProps: { manifest },
        });

        // 4. Render the media
        console.log('🚀 Rendering media...');
        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation,
            inputProps: { manifest },
            // On Mac, we assume Chrome is available
        });

        console.log('✅ Render complete:', outputLocation);

        // 5. Read the file and return as a download
        const fileBuffer = fs.readFileSync(outputLocation);

        // Cleanup
        try {
            fs.unlinkSync(outputLocation);
        } catch (e) {
            console.error('Failed to cleanup temp file:', e);
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="frameforge-render-${manifest.jobId}.mp4"`,
                'Content-Length': fileBuffer.length.toString(),
            },
        });

    } catch (error) {
        console.error('❌ Render error:', error);
        return NextResponse.json({
            error: 'Render failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
