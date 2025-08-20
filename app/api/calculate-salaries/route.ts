// app/api/calculate-salaries/route.ts (исправленная версия)
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
        error: 'Нет транзакций за текущий месяц. Сначала выполните синхронизацию.'
      })
    }
    
    // Получаем ВСЕХ сотрудников (включая уволенных)
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
    
    if (empError) throw empError
    
    if (!employees || employees.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Сотрудники не найдены'
      })
    }
    
    console.log(`Found ${employees.length} total employees`)
    
    // Группируем транзакции по сотрудникам
    const employeeTransactions = new Map()
    for (const transaction of allTransactions) {
      if (!employeeTransactions.has(transaction.employee_id)) {
        employeeTransactions.set(transaction.employee_id, [])
      }
      employeeTransactions.get(transaction.employee_id).push(transaction)
    }
    
    // Находим лидера месяца (самая большая ЕДИНИЧНАЯ транзакция)
    let maxGrossProfit = 0
    let maxTransaction = null
    let leaderEmployeeId = null
    
    for (const transaction of allTransactions) {
      if (transaction.gross_profit_usd > maxGrossProfit) {
        maxGrossProfit = transaction.gross_profit_usd
        maxTransaction = transaction
        leaderEmployeeId = transaction.employee_id
      }
    }
    
    console.log(`Leader transaction: $${maxGrossProfit.toFixed(2)}, employee_id: ${leaderEmployeeId}`)
    
    // Рассчитываем общий брутто
    const totalGross = allTransactions.reduce((sum, t) => sum + (parseFloat(t.gross_profit_usd) || 0), 0)
    
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
        // Обычные работники
        if (empGross > 0) {
          // База: 10% от своего брутто
          baseSalary = empGross * 0.1
          
          // ИСПРАВЛЕНИЕ: Бонус $200 ТОЛЬКО если брутто >= $200
          if (empGross >= 200) {
            bonus = 200
            console.log(`${employee.username}: gross $${empGross.toFixed(2)} >= $200, adding bonus $200`)
          } else {
            console.log(`${employee.username}: gross $${empGross.toFixed(2)} < $200, NO bonus`)
          }
          
          // Бонус лидеру месяца (за самую большую транзакцию)
          if (leaderEmployeeId && leaderEmployeeId === employee.id) {
            leaderBonus = maxGrossProfit * 0.1
            console.log(`${employee.username}: LEADER bonus ${leaderBonus.toFixed(2)} (10% of max transaction $${maxGrossProfit.toFixed(2)})`)
          }
        }
      }
      
      const totalSalary = baseSalary + bonus + leaderBonus
      
      // Сохраняем зарплату для ВСЕХ у кого она > 0 ИЛИ кто является менеджером
      // Это включает уволенных сотрудников, если у них есть транзакции
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
          is_active: employee.is_active,
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
    
    // Находим информацию о лидере для ответа
    const leaderEmployee = leaderEmployeeId ? employees.find(e => e.id === leaderEmployeeId) : null
    
    // Разделяем активных и уволенных
    const activeEmployees = employees.filter(e => e.is_active && !e.username.includes('УВОЛЕН'))
    const firedEmployees = employees.filter(e => !e.is_active || e.username.includes('УВОЛЕН'))
    
    // Добавляем информацию об уволенных с транзакциями
    const firedWithTransactions = firedEmployees.filter(emp => {
      const empTrans = employeeTransactions.get(emp.id) || []
      return empTrans.length > 0
    })
    
    return NextResponse.json({
      success: true,
      month: monthCode,
      stats: {
        totalGross: totalGross.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        maxTransaction: maxGrossProfit.toFixed(2),
        leaderEmployee: leaderEmployee?.username || null,
        salariesCreated: salariesToInsert.length,
        totalEmployees: employees.length,
        activeEmployees: activeEmployees.length,
        firedEmployees: firedEmployees.length,
        firedWithTransactions: firedWithTransactions.length,
        totalTransactions: allTransactions.length
      },
      salaries: salaryDetails.sort((a, b) => {
        // Сортировка: сначала менеджеры, потом активные, потом уволенные
        if (a.is_manager && !b.is_manager) return -1
        if (!a.is_manager && b.is_manager) return 1
        if (a.is_active && !b.is_active) return -1
        if (!a.is_active && b.is_active) return 1
        return parseFloat(b.total) - parseFloat(a.total)
      })
    })
    
  } catch (error: any) {
    console.error('Calculate salaries error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
