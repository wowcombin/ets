import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const runtime = 'nodejs'

// Этот endpoint просто перенаправляет на sync-all для совместимости
export async function GET(request: Request) {
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`
  
  try {
    // Вызываем основной endpoint синхронизации
    const response = await fetch(`${baseUrl}/api/sync-all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Sync failed with status: ${response.status}`)
    }
    
    const data = await response.json()
    return NextResponse.json(data)
    
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Sync failed',
      details: error.stack
    }, { status: 500 })
  }
}

// POST метод для будущих расширений
export async function POST(request: Request) {
  return GET(request)
}
