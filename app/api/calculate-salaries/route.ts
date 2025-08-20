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
    
    console.log(`Calculating salaries for ${monthCode}...`)
    
    // Получаем ВСЕ транзакции за месяц с пагинацией
    let allTransactions: any[] = []
    let from = 0
    const limit = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('month', monthCode)
        .range(from, from + limit - 1)
      
      if (error) {
        console.error(`Error fetching batch: ${error.message}`)
        break
      }
      
      if (batch && batch.length > 0) {
        allTransactions = [...allTransactions, ...batch]
        from += limit
        hasMore = batch.length === limit
      } else {
        hasMore = false
      }
    }
    
    console.log(`Found ${allTransactions.length} transactions`)
    
    if (allTransactions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No transactions found for current month. Please sync data first.'
      })
    }
    
    // Получаем всех АКТИВНЫХ сотрудников (включая менеджеров)
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
    
    if (empError) throw empError
    
    if (!employees || employees.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active employees found'
      })
    }
    
    console.log(`Found ${employees.length} active employees`)
    
    // Группируем транзакции по сотрудникам
    const employeeTransactions = new Map()
    for (const transaction of allTransactions) {
      if (!employeeTransactions.has(transaction.employee_id)) {
        employeeTransactions.set(transaction.employee_id, [])
      }
      employeeTransactions.get(transaction.employee_id).push(transaction)
    }
    
    // Находим лидера месяца (самая большая транзакция)
    let maxGrossProfit = 0
    let maxTransaction = null
    for (const transaction of allTransactions) {
      if (transaction.gross_profit_usd > maxGrossProfit) {
        maxGrossProfit = transaction.gross_profit_usd
        maxTransaction = transaction
      }
    }
    
    // Рассчитываем общий брутто и нетто
    const totalGross = allTransactions.reduce((sum, t) => sum + (parseFloat(t.gross_profit_usd) || 0), 0)
    const totalNet = allTransactions.reduce((sum, t) => sum + (parseFloat(t.net_profit_usd) || 0), 0)
    
    // Получаем расходы
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount_usd')
      .eq('month', monthCode)
    
    const totalExpenses = expenses?.reduce((sum, e) => sum + (parseFloat(e.amount_usd) || 0), 0) || 0
    
    console.log(`Total gross: $${totalGross.toFixed(2)}, Total expenses: $${totalExpenses.toFixed(2)}`)
    
    // Удаляем старые зарплаты за месяц
    await supabase
      .from('salaries')
      .delete()
      .eq('month', monthCode)
    
    const salariesToInsert = []
    const salaryDetails = []
    
    // Рассчитываем зарплаты для КАЖДОГО сотрудника
    for (const employee of employees) {
      const empTransactions = employeeTransactions.get(employee.id) || []
      const empGross = empTransactions.reduce((sum: number, t: any) => sum + (parseFloat(t.gross_profit_usd) || 0), 0)
      
      let baseSalary = 0
      let bonus = 0
      let leaderBonus = 0
      
      if (employee.username === '@sobroffice') {
        // Тест менеджер: 10% от брутто всех работников (не менеджеров) + 10% от своих тестов
        const workersGross = allTransactions
          .filter((t: any) => {
            const emp = employees?.find(e => e.id === t.employee_id)
            return emp && !emp.is_manager // только работники, не менеджеры
          })
          .reduce((sum: number, t: any) => sum + (parseFloat(t.gross_profit_usd) || 0), 0)
        
        baseSalary = (workersGross * 0.1) + (empGross * 0.1)
        
        console.log(`@sobroffice: workers gross = $${workersGross.toFixed(2)}, own gross = $${empGross.toFixed(2)}, salary = $${baseSalary.toFixed(2)}`)
        
      } else if (employee.is_manager) {
        // Другие менеджеры получают процент от ОБЩЕГО брутто
        const percentage = (employee.profit_percentage || 10) / 100
        
        // Если расходы больше 20% от брутто, считаем от (брутто - расходы)
        if (totalExpenses > totalGross * 0.2) {
          baseSalary = (totalGross - totalExpenses) * percentage
          console.log(`${employee.username}: ${employee.profit_percentage}% of ($${totalGross.toFixed(2)} - $${totalExpenses.toFixed(2)}) = $${baseSalary.toFixed(2)}`)
        } else {
          baseSalary = totalGross * percentage
          console.log(`${employee.username}: ${employee.profit_percentage}% of $${totalGross.toFixed(2)} = $${baseSalary.toFixed(2)}`)
        }
        
      } else {
        // Обычные работники: 10% от своего брутто
        if (empGross > 0) {
          baseSalary = empGross * 0.1
          
          // Бонус за результат > $200
          if (empGross > 200) {
            bonus = 200
          }
          
          // Бонус лидеру месяца (за самую большую транзакцию)
          if (maxTransaction && maxTransaction.employee_id === employee.id) {
            leaderBonus = maxGrossProfit * 0.1
          }
        }
      }
      
      const totalSalary = baseSalary + bonus + leaderBonus
      
      // Сохраняем зарплату для ВСЕХ у кого она > 0 ИЛИ кто является менеджером
      if (totalSalary > 0 || employee.is_manager) {
        salariesToInsert.push({
          employee_id: employee.id,
          month: monthCode,
          base_salary: Math.round(baseSalary * 100) / 100,
          bonus: Math.round(bonus * 100) / 100,
          leader_bonus: Math.round(leaderBonus * 100) / 100,
          total_salary: Math.round(totalSalary * 100) / 100,
          is_paid: false,
        })
        
        salaryDetails.push({
          username: employee.username,
          is_manager: employee.is_manager,
          base: baseSalary.toFixed(2),
          bonus: bonus.toFixed(2),
          leader: leaderBonus.toFixed(2),
          total: totalSalary.toFixed(2),
          empGross: empGross.toFixed(2)
        })
      }
    }
    
    // Вставляем все зарплаты
    if (salariesToInsert.length > 0) {
      const { error: salaryError } = await supabase
        .from('salaries')
        .insert(salariesToInsert)
      
      if (salaryError) {
        console.error('Error inserting salaries:', salaryError)
        throw salaryError
      }
      
      console.log(`Successfully calculated ${salariesToInsert.length} salaries`)
    }
    
    return NextResponse.json({
      success: true,
      month: monthCode,
      stats: {
        totalGross: totalGross.toFixed(2),
        totalNet: totalNet.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        maxTransaction: maxGrossProfit.toFixed(2),
        leaderEmployee: maxTransaction ? employees.find(e => e.id === maxTransaction.employee_id)?.username : null,
        salariesCreated: salariesToInsert.length,
        totalEmployees: employees.length,
        activeEmployees: employees.filter(e => e.is_active).length,
        totalTransactions: allTransactions.length
      },
      salaries: salaryDetails
    })
    
  } catch (error: any) {
    console.error('Calculate salaries error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
