import { SubtitleStyle } from './editor'

export enum AgentActionType {
    CUT_CLIP = 'cut_clip',
    TRIM_CLIP = 'trim',
    ADD_CLIP = 'add_clip',
    ADD_CAPTION = 'add_caption',
    REORDER_CLIPS = 'reorder_clips',
    CHANGE_SPEED = 'change_speed',
    ADD_EFFECT = 'add_effect',
    MODIFY_AUDIO = 'modify_audio',
    REMOVE_RANGE = 'remove_range',
    SPLIT = 'split',
    DELETE = 'delete',
    MOVE_PLAYHEAD = 'move_playhead',
    ADD_OVERLAY = 'add_overlay',
    ADD_TEXT = 'text_overlay',
    ADD_TRANSITION = 'add_transition',
}

export interface AgentAction {
    actionType: AgentActionType | string
    clipId?: string
    trackId?: string
    startTime?: number
    endTime?: number
    duration?: number
    text?: string
    assetUrl?: string
    speed?: number
    volume?: number
    effectType?: string
    reasoning?: string
    style?: SubtitleStyle
    transitionType?: string
    beforeClipId?: string
}

export interface AgentResponse {
    agentId: string
    actions: AgentAction[]
    reasoning: string
    status?: AgentStatus
    statusMessage?: string
}

export enum AgentStatus {
    IDLE = 'idle',
    ROUTING = 'routing',
    CONTEXT_BUILDING = 'context_building',
    PERCEIVING = 'perceiving',
    PLANNING = 'planning',
    VALIDATING = 'validating',
    READY = 'ready',
    ERROR = 'error',
}

export interface AgentRequest {
    prompt: string
    manifest: unknown
    context?: Record<string, unknown>
}

export interface AgentHistoryEntry {
    role: string
    content: string
    timestamp: number
}
