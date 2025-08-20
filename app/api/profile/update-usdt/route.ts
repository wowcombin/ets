// app/api/profile/update-usdt/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { getUserFromSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Не авторизован'
      }, { status: 401 })
    }
    
    const { usdt_address } = await request.json()
    
    // Валидация USDT адреса (BEP20 начинается с 0x)
    if (!usdt_address || !usdt_address.startsWith('0x') || usdt_address.length !== 42) {
      return NextResponse.json({
        success: false,
        error: 'Неверный формат USDT BEP20 адреса'
      }, { status: 400 })
    }
    
    const supabase = getServiceSupabase()
    
    const { error } = await supabase
      .from('employees')
      .update({
        usdt_address,
        usdt_network: 'BEP20',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({
      success: true,
      message: 'USDT адрес успешно обновлен'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// app/api/payments/mark-paid/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { getUserFromSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    
    if (!user || !user.is_manager) {
      return NextResponse.json({
        success: false,
        error: 'Доступ запрещен. Только для менеджеров.'
      }, { status: 403 })
    }
    
    const { salary_id, payment_hash, notes } = await request.json()
    
    if (!salary_id) {
      return NextResponse.json({
        success: false,
        error: 'ID зарплаты обязателен'
      }, { status: 400 })
    }
    
    const supabase = getServiceSupabase()
    
    // Проверяем существование зарплаты
    const { data: salary, error: fetchError } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, usdt_address)')
      .eq('id', salary_id)
      .single()
    
    if (fetchError || !salary) {
      return NextResponse.json({
        success: false,
        error: 'Зарплата не найдена'
      }, { status: 404 })
    }
    
    if (salary.is_paid) {
      return NextResponse.json({
        success: false,
        error: 'Эта зарплата уже оплачена'
      }, { status: 400 })
    }
    
    // Обновляем статус оплаты
    const { error: updateError } = await supabase
      .from('salaries')
      .update({
        is_paid: true,
        payment_date: new Date().toISOString(),
        payment_hash,
        paid_by: user.username,
        payment_notes: notes
      })
      .eq('id', salary_id)
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      message: `Зарплата ${salary.employee.username} успешно отмечена как оплаченная`
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// app/api/leaderboard/route.ts
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { getUserFromSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getUserFromSession()
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Не авторизован'
      }, { status: 401 })
    }
    
    const supabase = getServiceSupabase()
    const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    
    // Получаем данные о сотрудниках (только не менеджеры)
    const { data: salaries, error } = await supabase
      .from('salaries')
      .select('*, employee:employees(username, is_manager, is_active)')
      .eq('month', currentMonth)
      .order('total_salary', { ascending: false })
    
    if (error) {
      throw error
    }
    
    // Фильтруем только работников (не менеджеров)
    const workersLeaderboard = salaries
      ?.filter(s => !s.employee.is_manager)
      .map(s => ({
        username: s.employee.username,
        total_salary: s.total_salary,
        base_salary: s.base_salary,
        bonus: s.bonus,
        leader_bonus: s.leader_bonus,
        is_paid: s.is_paid,
        payment_date: s.payment_date
      }))
    
    // Получаем общий профит без расходов
    const { data: transactions } = await supabase
      .from('transactions')
      .select('gross_profit_usd')
      .eq('month', currentMonth)
    
    const totalGross = transactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
    
    // Статистика по казино
    const { data: casinoStats } = await supabase
      .from('transactions')
      .select('casino_name, gross_profit_usd')
      .eq('month', currentMonth)
    
    const casinoProfit: Record<string, number> = {}
    casinoStats?.forEach(t => {
      if (t.casino_name) {
        casinoProfit[t.casino_name] = (casinoProfit[t.casino_name] || 0) + (t.gross_profit_usd || 0)
      }
    })
    
    const sortedCasinos = Object.entries(casinoProfit)
      .map(([name, profit]) => ({ name, profit }))
      .sort((a, b) => b.profit - a.profit)
    
    return NextResponse.json({
      success: true,
      data: {
        month: currentMonth,
        totalGross,
        leaderboard: workersLeaderboard,
        casinoStats: sortedCasinos,
        user: {
          username: user.username,
          is_manager: user.is_manager
        }
      }
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
