import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure public/uploads directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Save file to public/uploads
        const filename = file.name.replace(/\s+/g, '_'); // Basic sanitization
        const filePath = path.join(uploadDir, filename);

        fs.writeFileSync(filePath, buffer);

        console.log('📤 File uploaded to:', filePath);

        // Return the relative path for use in the manifest
        const relativePath = path.join('uploads', filename);

        return NextResponse.json({
            success: true,
            url: relativePath,
            filename: filename
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        return NextResponse.json({
            error: 'Upload failed',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
