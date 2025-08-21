import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Автоматическая синхронизация в фоне
export async function POST() {
  try {
    console.log('=== AUTO SYNC STARTED ===', new Date().toISOString())
    
    // Вызываем основной endpoint синхронизации
    const syncResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://etsmo.vercel.app'}/api/sync-all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!syncResponse.ok) {
      throw new Error(`Auto sync failed with status: ${syncResponse.status}`)
    }
    
    const syncData = await syncResponse.json()
    console.log('=== AUTO SYNC COMPLETED ===', {
      success: syncData.success,
      transactionsCreated: syncData.stats?.transactionsCreated || 0,
      employeesProcessed: syncData.stats?.employeesProcessed || 0,
      timestamp: new Date().toISOString()
    })
    
    return NextResponse.json({
      success: true,
      message: 'Автоматическая синхронизация завершена',
      data: {
        transactionsCreated: syncData.stats?.transactionsCreated || 0,
        employeesProcessed: syncData.stats?.employeesProcessed || 0,
        workSessionsAnalyzed: syncData.workSessionsAnalyzed || 0,
        timestamp: new Date().toISOString(),
        nextSyncIn: '5 minutes'
      }
    })
    
  } catch (error: any) {
    console.error('Auto sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Auto sync failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  return POST() // Поддерживаем GET для тестирования
}
