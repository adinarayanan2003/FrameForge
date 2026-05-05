import { AgentHistoryEntry, AgentRequest, AgentResponse } from '@/types/agent'

export async function interactWithAgent(request: AgentRequest): Promise<AgentResponse> {
    const response = await fetch('/api/agent/interact', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to interact with agent')
    }

    const raw = await response.json()
    return {
        ...raw,
        agentId: raw.agentId ?? raw.agent_id,
        statusMessage: raw.statusMessage ?? raw.status_message,
    } as AgentResponse
}

export async function getAgentHistory(jobId: string): Promise<AgentHistoryEntry[]> {
    const response = await fetch(`/api/agent/history?job_id=${encodeURIComponent(jobId)}`)
    if (!response.ok) {
        throw new Error('Failed to fetch agent history')
    }

    const data = await response.json()
    return (data.history || []) as AgentHistoryEntry[]
}

export async function clearAgentHistory(jobId: string): Promise<void> {
    const response = await fetch(`/api/agent/history?job_id=${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
    })

    if (!response.ok) {
        throw new Error('Failed to clear agent history')
    }
}
