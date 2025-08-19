import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

function getCurrentMonthCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    const monthCode = getCurrentMonthCode()
    
    // Получаем все транзакции за месяц
    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('*')
      .eq('month', monthCode)
    
    if (transError) throw transError
    if (!transactions || transactions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No transactions found for current month'
      })
    }
    
    // Получаем всех сотрудников
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
    
    if (empError) throw empError
    if (!employees) {
      return NextResponse.json({
        success: false,
        error: 'No employees found'
      })
    }
    
    // Группируем транзакции по сотрудникам
    const employeeTransactions = new Map()
    for (const transaction of transactions) {
      if (!employeeTransactions.has(transaction.employee_id)) {
        employeeTransactions.set(transaction.employee_id, [])
      }
      employeeTransactions.get(transaction.employee_id).push(transaction)
    }
    
    // Находим лидера месяца (самый большой брутто по одной транзакции)
    let maxGrossProfit = 0
    let maxTransaction = null
    for (const transaction of transactions) {
      if (transaction.gross_profit_usd > maxGrossProfit) {
        maxGrossProfit = transaction.gross_profit_usd
        maxTransaction = transaction
      }
    }
    
    // Рассчитываем общий брутто и нетто
    const totalGross = transactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0)
    const totalNet = transactions.reduce((sum, t) => sum + (t.net_profit_usd || 0), 0)
    
    console.log(`Total gross: $${totalGross}, Total net: $${totalNet}`)
    
    // Удаляем старые зарплаты за месяц
    await supabase
      .from('salaries')
      .delete()
      .eq('month', monthCode)
    
    const salariesCreated = []
    
    // Рассчитываем зарплаты для каждого сотрудника
    for (const employee of employees) {
      const empTransactions = employeeTransactions.get(employee.id) || []
      const empGross = empTransactions.reduce((sum: number, t: any) => sum + (t.gross_profit_usd || 0), 0)
      
      let baseSalary = 0
      let bonus = 0
      let leaderBonus = 0
      
      if (employee.username === '@sobroffice') {
        // Тест менеджер: 10% от всего нетто + 10% от своих тестов
        baseSalary = totalNet * 0.1 + empGross * 0.1
      } else if (employee.is_manager) {
        // Менеджеры получают процент от общего нетто
        const percentage = (employee.profit_percentage || 10) / 100
        baseSalary = totalNet * percentage
      } else if (empGross > 0) {
        // Обычные работники: 10% от своего брутто
        baseSalary = empGross * 0.1
        
        // Бонус за результат > $200
        if (empGross > 200) {
          bonus = 200
        }
        
        // Бонус лидеру месяца
        if (maxTransaction && maxTransaction.employee_id === employee.id) {
          leaderBonus = maxGrossProfit * 0.1
        }
      }
      
      const totalSalary = baseSalary + bonus + leaderBonus
      
      // Сохраняем зарплату только если она больше 0
      if (totalSalary > 0) {
        const { data: salaryData, error: salaryError } = await supabase
          .from('salaries')
          .insert([{
            employee_id: employee.id,
            month: monthCode,
            base_salary: baseSalary,
            bonus,
            leader_bonus: leaderBonus,
            total_salary: totalSalary,
            is_paid: false,
          }])
          .select()
          .single()
        
        if (!salaryError && salaryData) {
          salariesCreated.push({
            username: employee.username,
            base: baseSalary.toFixed(2),
            bonus: bonus.toFixed(2),
            leader: leaderBonus.toFixed(2),
            total: totalSalary.toFixed(2)
          })
        } else {
          console.error(`Error creating salary for ${employee.username}:`, salaryError)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      month: monthCode,
      stats: {
        totalGross: totalGross.toFixed(2),
        totalNet: totalNet.toFixed(2),
        maxTransaction: maxGrossProfit.toFixed(2),
        leaderEmployee: maxTransaction ? employees.find(e => e.id === maxTransaction.employee_id)?.username : null,
        salariesCreated: salariesCreated.length
      },
      salaries: salariesCreated
    })
    
  } catch (error: any) {
    console.error('Calculate salaries error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
