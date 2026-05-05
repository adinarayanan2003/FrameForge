import { useCallback } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { AgentAction } from '@/types/agent'
import { Clip, EditorState, SubtitleStyle, TransitionType } from '@/types/editor'

type EditorRollbackSnapshot = Pick<
    EditorState,
    | 'source'
    | 'shots'
    | 'clips'
    | 'transitions'
    | 'selectedClipId'
    | 'selectedClipIds'
    | 'playheadPosition'
    | 'isPlaying'
    | 'zoom'
    | 'scrollX'
    | 'history'
    | 'audio'
    | 'exportSettings'
    | 'isDirty'
    | 'clipboard'
    | 'showSafeZones'
    | 'phantomClips'
>

const captureEditorSnapshot = (): EditorRollbackSnapshot => {
    const state = useEditorStore.getState()
    return {
        source: state.source,
        shots: state.shots,
        clips: state.clips,
        transitions: state.transitions,
        selectedClipId: state.selectedClipId,
        selectedClipIds: state.selectedClipIds,
        playheadPosition: state.playheadPosition,
        isPlaying: state.isPlaying,
        zoom: state.zoom,
        scrollX: state.scrollX,
        history: state.history,
        audio: state.audio,
        exportSettings: state.exportSettings,
        isDirty: state.isDirty,
        clipboard: state.clipboard,
        showSafeZones: state.showSafeZones,
        phantomClips: state.phantomClips,
    }
}

const restoreEditorSnapshot = (snapshot: EditorRollbackSnapshot) => {
    useEditorStore.setState((state) => ({
        ...state,
        ...snapshot,
    }))
}

export const useAgentActionHandler = () => {
    const splitClipAtPlayhead = useEditorStore((state) => state.splitClipAtPlayhead)
    const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition)
    const updateClip = useEditorStore((state) => state.updateClip)
    const addOverlayClip = useEditorStore((state) => state.addOverlayClip)
    const addCaptionClip = useEditorStore((state) => state.addCaptionClip)
    const deleteClip = useEditorStore((state) => state.deleteClip)
    const selectClip = useEditorStore((state) => state.selectClip)
    const beginHistoryTransaction = useEditorStore((state) => state.beginHistoryTransaction)
    const endHistoryTransaction = useEditorStore((state) => state.endHistoryTransaction)

    const handleAction = useCallback(async (action: AgentAction, selectionMode: 'replace' | 'toggle' | 'append' = 'replace') => {
        const actionType = String(action.actionType || '').toLowerCase()

        switch (actionType) {
            case 'split':
            case 'split_clip': {
                if (!action.clipId || action.startTime === undefined) {
                    throw new Error('Split action is missing clipId or startTime')
                }
                setPlayheadPosition(action.startTime)
                splitClipAtPlayhead(action.clipId)
                selectClip(action.clipId, selectionMode)
                break
            }

            case 'remove_range': {
                if (!action.clipId || action.startTime === undefined || action.endTime === undefined) {
                    throw new Error('Remove range action is missing clipId, startTime, or endTime')
                }

                const start = Math.min(action.startTime, action.endTime)
                const end = Math.max(action.startTime, action.endTime)
                const clipRoot = (id: string) => id.split('-split-')[0]
                const targetRoot = clipRoot(action.clipId)
                const epsilon = 1e-3

                const splitAtTime = (time: number) => {
                    const state = useEditorStore.getState()
                    const target = state.clips.find((clip) =>
                        clipRoot(clip.id) === targetRoot &&
                        clip.timelineStart < time - epsilon &&
                        clip.timelineEnd > time + epsilon
                    )
                    if (!target) return
                    setPlayheadPosition(time)
                    splitClipAtPlayhead(target.id)
                }

                splitAtTime(start)
                splitAtTime(end)

                const toDelete = useEditorStore.getState().clips
                    .filter((clip) =>
                        clipRoot(clip.id) === targetRoot &&
                        clip.timelineStart >= start - epsilon &&
                        clip.timelineEnd <= end + epsilon
                    )
                    .map((clip) => clip.id)

                toDelete.forEach((id) => deleteClip(id))
                break
            }

            case 'trim':
            case 'trim_clip': {
                if (!action.clipId || action.startTime === undefined) {
                    throw new Error('Trim action is missing clipId or startTime')
                }

                const currentClip = useEditorStore.getState().clips.find((clip) => clip.id === action.clipId)
                if (!currentClip) {
                    throw new Error(`Clip ${action.clipId} not found`)
                }

                if (currentClip.type === 'video' || currentClip.type === 'audio') {
                    const newSourceStart = action.startTime
                    const newSourceEnd = action.endTime ?? currentClip.sourceEnd
                    const newDuration = Math.max(0.1, newSourceEnd - newSourceStart)
                    updateClip(action.clipId, {
                        sourceStart: newSourceStart,
                        sourceEnd: newSourceEnd,
                        timelineEnd: currentClip.timelineStart + newDuration,
                    } as Partial<Clip>)
                } else {
                    updateClip(action.clipId, {
                        timelineStart: action.startTime,
                        timelineEnd: action.endTime ?? currentClip.timelineEnd,
                    } as Partial<Clip>)
                }
                selectClip(action.clipId, selectionMode)
                break
            }

            case 'delete':
            case 'delete_clip': {
                if (!action.clipId) {
                    throw new Error('Delete action is missing clipId')
                }
                deleteClip(action.clipId)
                break
            }

            case 'add_caption': {
                if (!action.text || action.startTime === undefined || action.endTime === undefined) {
                    throw new Error('Add caption action is missing text, startTime, or endTime')
                }
                const legacyHighlights = Array.from(action.text.matchAll(/\*([^*]+)\*/g))
                    .map((match) => match[1].trim())
                    .filter(Boolean)
                const cleanText = action.text.replace(/\*/g, '').replace(/\s+/g, ' ').trim()
                const style = action.style
                    ? ({
                        ...action.style,
                        highlightWords: action.style.highlightWords?.length
                            ? action.style.highlightWords
                            : legacyHighlights,
                    } as SubtitleStyle)
                    : undefined
                const newId = addCaptionClip(cleanText, action.startTime, action.endTime, style)
                selectClip(newId, selectionMode)
                break
            }

            case 'text_overlay':
            case 'add_text': {
                if (!action.text) {
                    throw new Error('Add text action is missing text')
                }
                const newId = addOverlayClip(action.text, 'text')
                selectClip(newId, selectionMode)
                break
            }

            case 'add_overlay':
            case 'add_clip': {
                if (!action.assetUrl) {
                    throw new Error('Add overlay action is missing assetUrl')
                }
                const newId = addOverlayClip(action.assetUrl, 'image')
                selectClip(newId, selectionMode)
                break
            }

            case 'move_playhead': {
                if (action.startTime === undefined) {
                    throw new Error('Move playhead action is missing startTime')
                }
                setPlayheadPosition(action.startTime)
                break
            }

            case 'add_transition': {
                if (!action.clipId) {
                    throw new Error('Add transition action is missing clipId')
                }
                const validTypes: TransitionType[] = ['none', 'fade', 'dissolve', 'wipe', 'slide']
                const transitionType = validTypes.includes(action.transitionType as TransitionType)
                    ? (action.transitionType as TransitionType)
                    : 'fade'
                useEditorStore.getState().addTransition(
                    action.clipId,
                    transitionType,
                    action.duration || 0.5,
                    action.beforeClipId
                )
                break
            }

            default:
                throw new Error(`Unknown action type: ${action.actionType}`)
        }
    }, [
        addCaptionClip,
        addOverlayClip,
        deleteClip,
        selectClip,
        setPlayheadPosition,
        splitClipAtPlayhead,
        updateClip,
    ])

    const runTransaction = useCallback(async (
        actions: AgentAction[],
        options: { clearSelection: boolean; selectionMode: 'replace' | 'toggle' | 'append' }
    ) => {
        if (!actions.length) return

        const snapshot = captureEditorSnapshot()
        const transactionKey = `agent:${Date.now()}`

        beginHistoryTransaction(transactionKey)
        try {
            if (options.clearSelection) {
                selectClip(null)
            }
            for (const action of actions) {
                await handleAction(action, options.selectionMode)
            }
            endHistoryTransaction(transactionKey)
        } catch (error) {
            restoreEditorSnapshot(snapshot)
            endHistoryTransaction(transactionKey)
            throw error
        }
    }, [beginHistoryTransaction, endHistoryTransaction, handleAction, selectClip])

    const applyActions = useCallback(async (actions: AgentAction[]) => {
        await runTransaction(actions, { clearSelection: true, selectionMode: 'append' })
    }, [runTransaction])

    const applyAction = useCallback(async (action: AgentAction) => {
        await runTransaction([action], { clearSelection: false, selectionMode: 'replace' })
    }, [runTransaction])

    return { applyActions, applyAction }
}
