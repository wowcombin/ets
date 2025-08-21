import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Принудительный расчет зарплат (публичный для диагностики)
export async function GET() {
  try {
    console.log('=== FORCE SALARY CALCULATION START ===')
    
    // Вызываем endpoint расчета зарплат
    const calcResponse = await fetch(`${process.env.NEXTAUTH_URL || 'https://etsmo.vercel.app'}/api/calculate-salaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!calcResponse.ok) {
      const errorText = await calcResponse.text()
      throw new Error(`Salary calculation failed: ${calcResponse.status} - ${errorText}`)
    }
    
    const calcData = await calcResponse.json()
    console.log('=== SALARY CALCULATION COMPLETED ===', calcData)
    
    return NextResponse.json({
      success: true,
      message: 'Зарплаты принудительно рассчитаны',
      data: calcData,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Force salary calculation error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Force salary calculation failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST() {
  return GET() // Поддерживаем POST для совместимости
}
