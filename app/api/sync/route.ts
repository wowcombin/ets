import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Просто перенаправляем на sync-all endpoint
export async function GET(request: Request) {
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`
  
  try {
    const response = await fetch(`${baseUrl}/api/sync-all`, {
      method: 'GET',
      headers: request.headers,
    })
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Sync failed'
    }, { status: 500 })
  }
}
