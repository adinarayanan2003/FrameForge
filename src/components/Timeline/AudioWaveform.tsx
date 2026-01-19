/**
 * Audio Waveform Component
 * 
 * Displays a simple audio waveform visualization inside timeline clips.
 * Uses Web Audio API to analyze audio files.
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'

interface AudioWaveformProps {
    audioUrl: string
    width: number
    height: number
    color?: string
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
    audioUrl,
    width,
    height,
    color = 'rgba(255, 255, 255, 0.6)'
}) => {
    const [waveformData, setWaveformData] = useState<number[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Analyze audio and extract waveform data
    useEffect(() => {
        if (!audioUrl) return

        const analyzeAudio = async () => {
            try {
                setIsLoading(true)
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

                const response = await fetch(audioUrl)
                const arrayBuffer = await response.arrayBuffer()
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

                // Get the audio data from the first channel
                const channelData = audioBuffer.getChannelData(0)

                // Sample the waveform data to get a reasonable number of points
                const samples = Math.min(Math.floor(width / 2), 200) // 2px per bar minimum
                const blockSize = Math.floor(channelData.length / samples)
                const filteredData: number[] = []

                for (let i = 0; i < samples; i++) {
                    const blockStart = blockSize * i
                    let sum = 0
                    for (let j = 0; j < blockSize; j++) {
                        sum += Math.abs(channelData[blockStart + j] || 0)
                    }
                    filteredData.push(sum / blockSize)
                }

                // Normalize to 0-1 range
                const maxVal = Math.max(...filteredData, 0.01)
                const normalized = filteredData.map(d => d / maxVal)

                setWaveformData(normalized)
                audioContext.close()
            } catch (err) {
                console.warn('Failed to analyze audio waveform:', err)
                // Generate placeholder bars on error
                setWaveformData(Array(20).fill(0).map(() => 0.3 + Math.random() * 0.4))
            } finally {
                setIsLoading(false)
            }
        }

        analyzeAudio()
    }, [audioUrl, width])

    // Draw waveform on canvas
    useEffect(() => {
        if (!canvasRef.current || waveformData.length === 0) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Clear canvas
        ctx.clearRect(0, 0, width, height)

        // Draw bars
        const barWidth = Math.max(1, (width / waveformData.length) - 1)
        const barSpacing = 1

        ctx.fillStyle = color

        waveformData.forEach((value, index) => {
            const x = index * (barWidth + barSpacing)
            const barHeight = Math.max(2, value * (height - 4))
            const y = (height - barHeight) / 2

            // Draw rounded bar
            ctx.beginPath()
            ctx.roundRect(x, y, barWidth, barHeight, 1)
            ctx.fill()
        })
    }, [waveformData, width, height, color])

    if (isLoading) {
        // Loading skeleton
        return (
            <div
                className="flex items-center justify-center gap-0.5 opacity-30"
                style={{ width, height }}
            >
                {Array(Math.min(10, Math.floor(width / 6))).fill(0).map((_, i) => (
                    <div
                        key={i}
                        className="bg-white/40 rounded-full animate-pulse"
                        style={{
                            width: 2,
                            height: 4 + Math.random() * 12,
                            animationDelay: `${i * 0.1}s`
                        }}
                    />
                ))}
            </div>
        )
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="pointer-events-none"
        />
    )
}
