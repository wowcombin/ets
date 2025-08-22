import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 Testing sync-all...')
    
    // Вызываем sync-all напрямую
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'https://etsmo.vercel.app'}/api/sync-all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      syncResult: data,
      stats: data.stats || {},
      message: data.message || 'No message'
    })
    
  } catch (error: any) {
    console.error('Test sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Test sync failed'
    }, { status: 500 })
  }
}