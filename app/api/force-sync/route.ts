import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Принудительная синхронизация (публичный для диагностики)
export async function GET() {
  try {
    console.log('=== FORCE SYNC START ===')
    
    // Сначала синхронизируем данные
    const syncResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://etsmo.vercel.app'}/api/sync-all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!syncResponse.ok) {
      const errorText = await syncResponse.text()
      throw new Error(`Sync failed: ${syncResponse.status} - ${errorText}`)
    }
    
    const syncData = await syncResponse.json()
    console.log('=== SYNC COMPLETED ===')
    
    // Затем рассчитываем зарплаты
    console.log('=== STARTING SALARY CALCULATION ===')
    const calcResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://etsmo.vercel.app'}/api/calculate-salaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    let calcData = null
    if (calcResponse.ok) {
      calcData = await calcResponse.json()
      console.log('=== SALARY CALCULATION COMPLETED ===')
    } else {
      console.error('Salary calculation failed:', calcResponse.status)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Принудительная синхронизация и расчет зарплат завершены',
      data: {
        sync: {
          success: syncData.success,
          transactionsCreated: syncData.stats?.transactionsCreated || 0,
          employeesProcessed: syncData.stats?.employeesProcessed || 0
        },
        salaries: calcData ? {
          success: calcData.success,
          salariesCalculated: calcData.stats?.salariesCalculated || 0
        } : { success: false, error: 'Salary calculation failed' }
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Force sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Force sync failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
