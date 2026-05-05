import { NextRequest, NextResponse } from 'next/server'

const AGENT_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://127.0.0.1:5001'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }

        if (process.env.AGENT_API_KEY) {
            headers['X-API-Key'] = process.env.AGENT_API_KEY
        }

        const response = await fetch(`${AGENT_BACKEND_URL}/api/agent/interact`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })

        const data = await response.json().catch(() => ({}))
        return NextResponse.json(data, { status: response.status })
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to reach agent backend',
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 502 }
        )
    }
}
