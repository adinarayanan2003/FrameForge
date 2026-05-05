'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
    AlertCircle,
    ArrowUp,
    Check,
    CheckCircle2,
    Loader2,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react'
import { clearAgentHistory, getAgentHistory, interactWithAgent } from '@/lib/api'
import { useAgentActionHandler } from '@/hooks/useAgentActionHandler'
import { useEditorStore } from '@/store/editorStore'
import { AgentAction, AgentRequest, AgentStatus } from '@/types/agent'
import { Clip } from '@/types/editor'

interface AgentChatWindowProps {
    isOpen: boolean
    onClose?: () => void
}

interface ChatMessage {
    role: 'user' | 'agent'
    content: string
    timestamp: number
}

const formatSeconds = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '--'
    return `${value.toFixed(2)}s`
}

const shortClipId = (clipId?: string) => {
    if (!clipId) return 'timeline'
    return clipId.length > 18 ? `${clipId.slice(0, 18)}...` : clipId
}

const describeAction = (action: AgentAction, clips: Clip[]) => {
    const actionType = String(action.actionType || '').toLowerCase()
    const targetClip = action.clipId ? clips.find((clip) => clip.id === action.clipId) : undefined
    const warnings: string[] = []
    let title = String(action.actionType || 'Action')
    let summary = 'Apply timeline change'
    let impact = 'Timeline edit'

    if (action.clipId && !targetClip && !['add_caption', 'add_overlay', 'add_clip', 'text_overlay', 'add_text', 'move_playhead'].includes(actionType)) {
        warnings.push(`Clip ${shortClipId(action.clipId)} not found`)
    }

    switch (actionType) {
        case 'split':
        case 'split_clip':
            title = 'Split Clip'
            summary = `Split ${shortClipId(action.clipId)} at ${formatSeconds(action.startTime)}`
            impact = 'Creates a second clip from the split point'
            if (!action.clipId) warnings.push('Missing clipId')
            if (action.startTime === undefined) warnings.push('Missing split time')
            break
        case 'trim':
        case 'trim_clip':
            title = 'Trim Clip'
            summary = `Use source ${formatSeconds(action.startTime)} to ${formatSeconds(action.endTime)}`
            impact = 'Changes the visible source range'
            if (!action.clipId) warnings.push('Missing clipId')
            if (action.startTime === undefined) warnings.push('Missing start time')
            if (action.startTime !== undefined && action.endTime !== undefined && action.endTime <= action.startTime) {
                warnings.push('End time must be after start time')
            }
            break
        case 'remove_range':
            title = 'Remove Range'
            summary = `Remove ${formatSeconds(action.startTime)} to ${formatSeconds(action.endTime)}`
            impact = 'Splits and deletes the matching timeline segment'
            if (!action.clipId) warnings.push('Missing clipId')
            break
        case 'delete':
        case 'delete_clip':
            title = 'Delete Clip'
            summary = `Delete ${shortClipId(action.clipId)}`
            impact = 'Removes one clip'
            if (!action.clipId) warnings.push('Missing clipId')
            break
        case 'add_caption':
            title = 'Add Caption'
            summary = action.text || 'Caption text'
            impact = `${formatSeconds(action.startTime)} to ${formatSeconds(action.endTime)}`
            if (!action.text?.trim()) warnings.push('Missing caption text')
            break
        case 'add_transition':
            title = 'Add Transition'
            summary = `${action.transitionType || 'fade'} after ${shortClipId(action.clipId)}`
            impact = `Duration ${formatSeconds(action.duration || 0.5)}`
            if (!action.clipId) warnings.push('Missing clipId')
            break
        case 'text_overlay':
        case 'add_text':
            title = 'Add Text Overlay'
            summary = action.text || 'Text overlay'
            impact = 'Adds a text overlay clip'
            if (!action.text?.trim()) warnings.push('Missing text')
            break
        case 'add_overlay':
        case 'add_clip':
            title = 'Add Overlay'
            summary = action.assetUrl || 'Overlay asset'
            impact = 'Adds an overlay clip'
            if (!action.assetUrl) warnings.push('Missing assetUrl')
            break
        case 'move_playhead':
            title = 'Move Playhead'
            summary = `Move to ${formatSeconds(action.startTime)}`
            impact = 'Changes the edit focus'
            break
        default:
            title = `Unsupported: ${action.actionType}`
            warnings.push('Unknown action type')
    }

    return { title, summary, impact, warnings }
}

const buildPhantomClips = (actions: AgentAction[], clips: Clip[]): Clip[] => {
    return actions.flatMap((action, index) => {
        const actionType = String(action.actionType || '').toLowerCase()
        const targetClip = action.clipId ? clips.find((clip) => clip.id === action.clipId) : undefined

        if (actionType === 'add_caption' && action.text && action.startTime !== undefined && action.endTime !== undefined) {
            return [{
                id: `phantom-caption-${index}`,
                type: 'subtitle',
                track: 4,
                timelineStart: action.startTime,
                timelineEnd: action.endTime,
                locked: true,
                text: action.text,
                style: action.style || {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 30,
                    color: '#FFFFFF',
                    backgroundColor: 'transparent',
                    textAlign: 'center',
                    verticalPosition: 0.8,
                    bold: true,
                    italic: false,
                    shadow: true,
                },
            } as Clip]
        }

        if ((actionType === 'split' || actionType === 'split_clip') && action.startTime !== undefined) {
            return [{
                id: `phantom-split-${index}`,
                type: 'overlay',
                track: targetClip?.track ?? 0,
                timelineStart: Math.max(0, action.startTime - 0.05),
                timelineEnd: action.startTime + 0.05,
                locked: true,
                overlayType: 'text',
                content: 'SPLIT',
                opacity: 0.85,
                position: { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
            } as Clip]
        }

        if (actionType === 'remove_range' && action.startTime !== undefined && action.endTime !== undefined) {
            return [{
                id: `phantom-remove-${index}`,
                type: 'overlay',
                track: targetClip?.track ?? 0,
                timelineStart: Math.min(action.startTime, action.endTime),
                timelineEnd: Math.max(action.startTime, action.endTime),
                locked: true,
                overlayType: 'text',
                content: 'REMOVE',
                opacity: 0.65,
                position: { x: 0, y: 0, width: 1, height: 1, rotation: 0 },
            } as Clip]
        }

        return []
    })
}

export const AgentChatWindow: React.FC<AgentChatWindowProps> = ({ isOpen, onClose }) => {
    const [prompt, setPrompt] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'agent', content: 'How can I help you edit today?', timestamp: Date.now() },
    ])
    const [isProcessing, setIsProcessing] = useState(false)
    const [pendingActions, setPendingActions] = useState<AgentAction[]>([])
    const [currentStatus, setCurrentStatus] = useState<AgentStatus | null>(null)
    const [error, setError] = useState<string | null>(null)
    const chatRef = useRef<HTMLDivElement>(null)

    const selectedClipIds = useEditorStore((state) => state.selectedClipIds)
    const selectedClipId = useEditorStore((state) => state.selectedClipId)
    const playheadPosition = useEditorStore((state) => state.playheadPosition)
    const clips = useEditorStore((state) => state.clips)
    const source = useEditorStore((state) => state.source)
    const generateManifest = useEditorStore((state) => state.generateManifest)
    const setPhantomClips = useEditorStore((state) => state.setPhantomClips)
    const clearPhantomClips = useEditorStore((state) => state.clearPhantomClips)
    const { applyActions, applyAction } = useAgentActionHandler()

    const actionPlan = useMemo(
        () => pendingActions.map((action) => ({ action, ...describeAction(action, clips) })),
        [pendingActions, clips]
    )

    useEffect(() => {
        if (!isOpen || !source?.jobId) return
        getAgentHistory(source.jobId)
            .then((history) => {
                if (!history.length) return
                setMessages(history.map((entry) => ({
                    role: entry.role === 'assistant' ? 'agent' : 'user',
                    content: entry.content,
                    timestamp: entry.timestamp * 1000,
                })))
            })
            .catch(() => {
                // History is convenience state; failures should not block editing.
            })
    }, [isOpen, source?.jobId])

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight
        }
    }, [messages, pendingActions, isOpen])

    const submitPrompt = async (event: React.FormEvent) => {
        event.preventDefault()
        const userPrompt = prompt.trim()
        if (!userPrompt || isProcessing) return

        setPrompt('')
        setError(null)

        if (userPrompt.toLowerCase() === '/clear') {
            if (source?.jobId) {
                await clearAgentHistory(source.jobId).catch(() => undefined)
            }
            setMessages([{ role: 'agent', content: 'Chat history cleared.', timestamp: Date.now() }])
            setPendingActions([])
            clearPhantomClips()
            return
        }

        const manifest = generateManifest()
        if (!manifest) {
            setError('Editor is not ready yet.')
            return
        }

        setIsProcessing(true)
        setCurrentStatus(AgentStatus.ROUTING)
        setPendingActions([])
        clearPhantomClips()
        setMessages((prev) => [...prev, { role: 'user', content: userPrompt, timestamp: Date.now() }])

        try {
            const request: AgentRequest = {
                prompt: userPrompt,
                manifest: {
                    ...manifest,
                    job_id: manifest.jobId,
                    audio: manifest.clips.filter((clip) => clip.type === 'audio'),
                },
                context: {
                    selectedClipId,
                    selectedClipIds,
                    playheadPosition,
                    timestamp: new Date().toISOString(),
                },
            }

            const response = await interactWithAgent(request)
            setCurrentStatus(response.status || AgentStatus.READY)
            setMessages((prev) => [...prev, {
                role: 'agent',
                content: response.reasoning || 'I planned the requested edit.',
                timestamp: Date.now(),
            }])

            if (response.actions?.length) {
                setPendingActions(response.actions)
                setPhantomClips(buildPhantomClips(response.actions, manifest.clips))
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Agent failed to respond.'
            setError(message)
            setCurrentStatus(AgentStatus.ERROR)
            setMessages((prev) => [...prev, { role: 'agent', content: message, timestamp: Date.now() }])
        } finally {
            setIsProcessing(false)
            setTimeout(() => setCurrentStatus(null), 1500)
        }
    }

    const applyAll = async () => {
        if (!pendingActions.length) return
        setError(null)
        try {
            await applyActions(pendingActions)
            setPendingActions([])
            clearPhantomClips()
            setMessages((prev) => [...prev, { role: 'agent', content: 'Applied all planned edits.', timestamp: Date.now() }])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply planned edits.')
        }
    }

    const applyNext = async () => {
        const [nextAction, ...remaining] = pendingActions
        if (!nextAction) return
        setError(null)
        try {
            await applyAction(nextAction)
            setPendingActions(remaining)
            setPhantomClips(buildPhantomClips(remaining, useEditorStore.getState().clips))
            if (!remaining.length) {
                clearPhantomClips()
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply this step.')
        }
    }

    const rejectPlan = () => {
        setPendingActions([])
        clearPhantomClips()
        setMessages((prev) => [...prev, { role: 'agent', content: 'Cancelled the planned edits.', timestamp: Date.now() }])
    }

    if (!isOpen) return null

    return (
        <div className="flex h-full flex-col bg-card text-foreground">
            <div className="flex items-center justify-between border-b border-border/20 px-3 py-2">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    <span className="text-sm font-medium">Agent Editor</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className="rounded-md p-1 text-secondary hover:bg-card/60 hover:text-foreground">
                        <X size={16} />
                    </button>
                )}
            </div>

            <div ref={chatRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                {messages.map((message) => (
                    <div key={`${message.timestamp}-${message.role}`} className={message.role === 'user' ? 'text-right' : 'text-left'}>
                        <div className={`inline-block max-w-[92%] rounded-md px-3 py-2 text-sm ${
                            message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background/70 text-foreground'
                        }`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}

                {currentStatus && (
                    <div className="flex items-center gap-2 rounded-md border border-border/20 bg-background/50 px-3 py-2 text-xs text-secondary">
                        {currentStatus === AgentStatus.ERROR ? <AlertCircle size={14} /> : <Loader2 size={14} className="animate-spin" />}
                        <span>{currentStatus.replace(/_/g, ' ')}</span>
                    </div>
                )}

                {error && (
                    <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {error}
                    </div>
                )}

                {actionPlan.length > 0 && (
                    <div className="space-y-2 rounded-md border border-border/20 bg-background/40 p-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-secondary">Planned Edits</span>
                            <span className="text-[11px] text-secondary">{actionPlan.length} action{actionPlan.length === 1 ? '' : 's'}</span>
                        </div>

                        <div className="max-h-44 space-y-2 overflow-y-auto">
                            {actionPlan.map((item, index) => (
                                <div key={`${index}-${item.title}`} className="rounded-md bg-card/60 p-2 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-foreground">{item.title}</span>
                                        {item.warnings.length ? (
                                            <AlertCircle size={13} className="shrink-0 text-yellow-300" />
                                        ) : (
                                            <CheckCircle2 size={13} className="shrink-0 text-green-300" />
                                        )}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-secondary">{item.summary}</p>
                                    <p className="mt-1 text-[11px] text-secondary/80">{item.impact}</p>
                                    {item.warnings.length > 0 && (
                                        <p className="mt-1 text-[11px] text-yellow-300">{item.warnings.join(', ')}</p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={applyNext} className="rounded-md border border-border/20 px-2 py-1.5 text-xs hover:bg-card/70">
                                Apply Step
                            </button>
                            <button onClick={applyAll} className="rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground hover:opacity-90">
                                <Check size={13} className="mr-1 inline" />
                                Apply All
                            </button>
                            <button onClick={rejectPlan} className="rounded-md border border-border/20 px-2 py-1.5 text-xs hover:bg-card/70">
                                <Trash2 size={13} className="mr-1 inline" />
                                Reject
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={submitPrompt} className="flex gap-2 border-t border-border/20 p-2">
                <input
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask for an edit..."
                    className="min-w-0 flex-1 rounded-md border border-border/20 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    disabled={isProcessing}
                />
                <button
                    type="submit"
                    disabled={isProcessing || !prompt.trim()}
                    className="rounded-md bg-primary p-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    title="Send"
                >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
                </button>
            </form>
        </div>
    )
}
