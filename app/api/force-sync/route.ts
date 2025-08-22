import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  try {
    console.log('Force sync requested at', new Date().toISOString())
    
    // Вызываем полную синхронизацию
    const syncResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://etsmo.vercel.app'}/api/sync-all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!syncResponse.ok) {
      throw new Error(`Sync failed: ${syncResponse.statusText}`)
    }
    
    const syncResult = await syncResponse.json()
    
    return NextResponse.json({
      success: true,
      message: 'Force sync completed',
      syncResult: {
        transactionsCreated: syncResult.stats?.transactionsCreated || 0,
        totalGross: syncResult.stats?.totalGross || 0,
        message: syncResult.message
      }
    })
    
  } catch (error: any) {
    console.error('Force sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Force sync failed'
    }, { status: 500 })
  }
}