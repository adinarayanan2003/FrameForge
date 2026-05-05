import type { Metadata } from 'next'
import '../styles/globals.css'

export const metadata: Metadata = {
    title: 'FrameForge',
    description: 'Timeline-based video editor for AI video pipelines',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="dark">
            <body className="antialiased">
                {children}
            </body>
        </html>
    )
}
