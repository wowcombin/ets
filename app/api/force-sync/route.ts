import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  try {
    console.log('🔄 Force sync requested at', new Date().toISOString())
    
    // Вызываем полную синхронизацию
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'https://etsmo.vercel.app'
    
    console.log(`📡 Calling sync-all at: ${baseUrl}/api/sync-all`)
    
    const syncResponse = await fetch(`${baseUrl}/api/sync-all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!syncResponse.ok) {
      const errorText = await syncResponse.text()
      console.error('❌ Sync failed:', syncResponse.status, errorText)
      throw new Error(`Sync failed: ${syncResponse.statusText}`)
    }
    
    const syncResult = await syncResponse.json()
    console.log('✅ Sync result:', syncResult)
    
    return NextResponse.json({
      success: true,
      message: 'Force sync completed',
      timestamp: new Date().toISOString(),
      syncResult: {
        transactionsCreated: syncResult.stats?.transactionsCreated || 0,
        totalGross: syncResult.stats?.totalGross || 0,
        message: syncResult.message,
        details: syncResult.stats
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