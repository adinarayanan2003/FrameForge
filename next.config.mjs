/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Enable remote images for video thumbnails
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'storage.googleapis.com',
            },
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
        ],
    },
    // Transpile Remotion packages
    transpilePackages: ['remotion', '@remotion/player'],
    // Ensure renderer and bundler remain on the server
    serverExternalPackages: ['@remotion/renderer', '@remotion/bundler'],
}

export default nextConfig
