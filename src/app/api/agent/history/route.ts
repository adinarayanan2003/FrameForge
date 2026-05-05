import { NextRequest, NextResponse } from 'next/server'

const AGENT_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://127.0.0.1:5001'

function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    if (process.env.AGENT_API_KEY) {
        headers['X-API-Key'] = process.env.AGENT_API_KEY
    }

    return headers
}

export async function GET(req: NextRequest) {
    return proxyHistory(req, 'GET')
}

export async function DELETE(req: NextRequest) {
    return proxyHistory(req, 'DELETE')
}

async function proxyHistory(req: NextRequest, method: 'GET' | 'DELETE') {
    try {
        const jobId = req.nextUrl.searchParams.get('job_id')
        if (!jobId) {
            return NextResponse.json({ error: 'Missing job_id parameter' }, { status: 400 })
        }

        const response = await fetch(
            `${AGENT_BACKEND_URL}/api/agent/history?job_id=${encodeURIComponent(jobId)}`,
            {
                method,
                headers: buildHeaders(),
            }
        )

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
