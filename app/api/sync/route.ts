import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { 
  collectAllEmployeeData, 
  getCurrentMonthCode,
  getCurrentMonthName 
} from '@/lib/google/drive-client'

export async function GET(request: Request) {
  try {
    // Получаем параметр месяца из URL (опционально)
    const { searchParams } = new URL(request.url)
    const monthName = searchParams.get('month') || getCurrentMonthName()
    const monthCode = searchParams.get('monthCode') || getCurrentMonthCode()

    console.log(`Starting sync for ${monthName} (${monthCode})`)

    // Собираем все данные из Google Drive
    const data = await collectAllEmployeeData(monthName)
    
    // Получаем Supabase клиент с service role
    const supabase = getServiceSupabase()

    // Статистика для ответа
    const stats = {
      month: monthCode,
      monthName: monthName,
      employeesProcessed: 0,
      transactionsCreated: 0,
      cardsUpdated: 0,
      errors: [] as string[],
    }

    // 1. Обрабатываем данные каждого сотрудника
    for (const employeeData of data.employees) {
      try {
        // Проверяем, есть ли сотрудник в базе
        let { data: employee, error: employeeError } = await supabase
          .from('employees')
          .select('id')
          .eq('username', employeeData.username)
          .single()

        // Если сотрудника нет, создаем его
        if (!employee || employeeError) {
          const { data: newEmployee, error: createError } = await supabase
            .from('employees')
            .insert({
              username: employeeData.username,
              folder_id: employeeData.folderId,
              is_manager: false,
              profit_percentage: 10.00,
            })
            .select('id')
            .single()

          if (createError) {
            console.error(`Error creating employee ${employeeData.username}:`, createError)
            stats.errors.push(`Failed to create employee ${employeeData.username}`)
            continue
          }

          employee = newEmployee
        }

        if (!employee) continue

        // 2. Удаляем старые транзакции за этот месяц
        await supabase
          .from('transactions')
          .delete()
          .eq('employee_id', employee.id)
          .eq('month', monthCode)

        // 3. Добавляем новые транзакции
        for (const transaction of employeeData.transactions) {
          // Вычисляем net profit с учетом расходов
          const totalGross = data.employees
            .flatMap(e => e.transactions)
            .reduce((sum, t) => sum + t.grossProfit, 0)
          
          const expenseRatio = totalGross > 0 ? data.expenses / totalGross : 0
          const netProfit = transaction.grossProfit * (1 - Math.min(expenseRatio, 0.2))

          const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
              employee_id: employee.id,
              month: monthCode,
              casino_name: transaction.casino,
              deposit_gbp: transaction.depositGbp,
              withdrawal_gbp: transaction.withdrawalGbp,
              deposit_usd: transaction.depositUsd,
              withdrawal_usd: transaction.withdrawalUsd,
              card_number: transaction.cardNumber,
              gross_profit_usd: transaction.grossProfit,
              net_profit_usd: netProfit,
            })

          if (transactionError) {
            console.error('Error inserting transaction:', transactionError)
          } else {
            stats.transactionsCreated++
          }
        }

        stats.employeesProcessed++
      } catch (error) {
        console.error(`Error processing employee ${employeeData.username}:`, error)
        stats.errors.push(`Error processing ${employeeData.username}`)
      }
    }

    // 4. Сохраняем расходы за месяц
    if (data.expenses > 0) {
      // Удаляем старые расходы за месяц
      await supabase
        .from('expenses')
        .delete()
        .eq('month', monthCode)

      // Добавляем новые
      const { error: expenseError } = await supabase
        .from('expenses')
        .insert({
          month: monthCode,
          amount_usd: data.expenses,
          description: `${monthName} total expenses`,
        })

      if (expenseError) {
        console.error('Error saving expenses:', expenseError)
        stats.errors.push('Failed to save expenses')
      }
    }

    // 5. Обновляем статусы карт
    for (const cardNumber of data.cards) {
      // Проверяем, есть ли карта в базе
      const { data: existingCard } = await supabase
        .from('cards')
        .select('id')
        .eq('card_number', cardNumber)
        .single()

      if (!existingCard) {
        // Создаем новую карту
        const { error: cardError } = await supabase
          .from('cards')
          .insert({
            card_number: cardNumber,
            status: 'available',
          })

        if (!cardError) {
          stats.cardsUpdated++
        }
      }
    }

    // 6. Обновляем статусы карт по казино
    for (const [casino, cards] of data.cardThemes) {
      for (const cardNumber of cards) {
        // Находим, кто использовал эту карту
        const { data: transaction } = await supabase
          .from('transactions')
          .select('employee_id')
          .eq('month', monthCode)
          .eq('card_number', cardNumber)
          .eq('casino_name', casino)
          .single()

        // Обновляем статус карты
        const status = transaction ? 'used' : 'assigned'
        
        await supabase
          .from('cards')
          .update({
            status,
            casino_name: casino,
            month: monthCode,
            assigned_to: transaction?.employee_id || null,
          })
          .eq('card_number', cardNumber)
      }
    }

    // 7. Рассчитываем зарплаты
    await calculateSalaries(monthCode)

    return NextResponse.json({
      success: true,
      stats,
      message: `Successfully synced data for ${monthName}`,
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Функция расчета зарплат
async function calculateSalaries(monthCode: string) {
  const supabase = getServiceSupabase()

  // Получаем все транзакции за месяц
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('month', monthCode)

  if (!transactions) return

  // Получаем всех сотрудников
  const { data: employees } = await supabase
    .from('employees')
    .select('*')

  if (!employees) return

  // Группируем транзакции по сотрудникам
  const employeeTransactions = new Map()
  for (const transaction of transactions) {
    if (!employeeTransactions.has(transaction.employee_id)) {
      employeeTransactions.set(transaction.employee_id, [])
    }
    employeeTransactions.get(transaction.employee_id).push(transaction)
  }

  // Находим лидера месяца (самый большой брутто по одному аккаунту)
  let maxGrossProfit = 0
  let maxTransaction = null
  for (const transaction of transactions) {
    if (transaction.gross_profit_usd > maxGrossProfit) {
      maxGrossProfit = transaction.gross_profit_usd
      maxTransaction = transaction
    }
  }

  // Рассчитываем общий брутто и нетто
  const totalGross = transactions.reduce((sum, t) => sum + t.gross_profit_usd, 0)
  const totalNet = transactions.reduce((sum, t) => sum + t.net_profit_usd, 0)

  // Удаляем старые зарплаты за месяц
  await supabase
    .from('salaries')
    .delete()
    .eq('month', monthCode)

  // Рассчитываем зарплаты для каждого сотрудника
  for (const employee of employees) {
    const empTransactions = employeeTransactions.get(employee.id) || []
    const empGross = empTransactions.reduce((sum: number, t: any) => sum + t.gross_profit_usd, 0)
    
    let baseSalary = 0
    let bonus = 0
    let leaderBonus = 0

    if (employee.username === '@sobroffice') {
      // Тест менеджер: 10% от всех + 10% от своих тестов
      baseSalary = totalNet * 0.1
    } else if (employee.is_manager) {
      // Менеджеры получают процент от общего нетто
      const percentage = employee.profit_percentage / 100
      baseSalary = totalNet * percentage
    } else {
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

    // Сохраняем зарплату
    await supabase
      .from('salaries')
      .insert({
        employee_id: employee.id,
        month: monthCode,
        base_salary: baseSalary,
        bonus,
        leader_bonus: leaderBonus,
        total_salary: totalSalary,
        is_paid: false,
      })
  }
}
