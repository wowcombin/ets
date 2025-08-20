import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const runtime = 'nodejs'

// Vercel Cron Job для автоматической синхронизации каждые 4 часа
export async function GET(request: Request) {
  try {
    // Проверяем, что запрос пришел от Vercel Cron (для безопасности)
    const headersList = headers()
    const authHeader = headersList.get('authorization')
    
    // В production можно добавить проверку токена
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }
    
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    
    console.log(`[CRON] Starting automatic sync at ${new Date().toISOString()}`)
    
    // Выполняем синхронизацию
    const syncResponse = await fetch(`${baseUrl}/api/sync-all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!syncResponse.ok) {
      throw new Error(`Sync failed with status: ${syncResponse.status}`)
    }
    
    const syncData = await syncResponse.json()
    
    // Если синхронизация прошла успешно, рассчитываем зарплаты
    if (syncData.success && syncData.stats?.transactionsCreated > 0) {
      console.log(`[CRON] Sync successful, calculating salaries...`)
      
      const salariesResponse = await fetch(`${baseUrl}/api/calculate-salaries`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const salariesData = await salariesResponse.json()
      
      if (salariesData.success) {
        console.log(`[CRON] Salaries calculated successfully`)
      } else {
        console.error(`[CRON] Failed to calculate salaries:`, salariesData.error)
      }
    }
    
    const endTime = new Date().toISOString()
    const result = {
      success: true,
      timestamp: endTime,
      sync: {
        success: syncData.success,
        employeesProcessed: syncData.stats?.employeesProcessed || 0,
        transactionsCreated: syncData.stats?.transactionsCreated || 0,
        totalGross: syncData.stats?.totalGross || 0,
        totalNet: syncData.stats?.totalNet || 0,
      },
      message: `Automatic sync completed at ${endTime}`
    }
    
    console.log(`[CRON] Completed:`, result)
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('[CRON] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Cron job failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
