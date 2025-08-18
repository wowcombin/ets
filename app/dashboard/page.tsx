'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { RefreshCw, DollarSign, Users, TrendingUp, CreditCard } from 'lucide-react'

interface DashboardData {
  employees: any[]
  transactions: any[]
  expenses: any[]
  salaries: any[]
  cards: any[]
  month: string
  stats: {
    totalGross: number
    totalNet: number
    totalExpenses: number
    employeeCount: number
    cardCount: number
    usedCardCount: number
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [currentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  })

  // Загружаем данные из Supabase
  const loadData = async () => {
    setLoading(true)
    try {
      // Получаем сотрудников
      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .order('username')

      // Получаем транзакции за текущий месяц
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, employee:employees(username)')
        .eq('month', currentMonth)
        .order('created_at', { ascending: false })

      // Получаем расходы
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('month', currentMonth)

      // Получаем зарплаты
      const { data: salaries } = await supabase
        .from('salaries')
        .select('*, employee:employees(username)')
        .eq('month', currentMonth)
        .order('total_salary', { ascending: false })

      // Получаем карты
      const { data: cards } = await supabase
        .from('cards')
        .select('*')
        .order('card_number')

      // Рассчитываем статистику
      const totalGross = transactions?.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0) || 0
      const totalNet = transactions?.reduce((sum, t) => sum + (t.net_profit_usd || 0), 0) || 0
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_usd || 0), 0) || 0
      const usedCardCount = cards?.filter(c => c.status === 'used').length || 0

      setData({
        employees: employees || [],
        transactions: transactions || [],
        expenses: expenses || [],
        salaries: salaries || [],
        cards: cards || [],
        month: currentMonth,
        stats: {
          totalGross,
          totalNet,
          totalExpenses,
          employeeCount: employees?.length || 0,
          cardCount: cards?.length || 0,
          usedCardCount,
        }
      })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Синхронизация с Google Drive
  const syncData = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync')
      const result = await response.json()
      
      if (result.success) {
        alert(`Синхронизация завершена! Обработано ${result.stats.employeesProcessed} сотрудников`)
        await loadData()
      } else {
        alert(`Ошибка синхронизации: ${result.error}`)
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('Ошибка при синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Загрузка данных...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Employee Tracking System</h1>
          <p className="text-gray-600">Данные за {currentMonth}</p>
        </div>
        <Button 
          onClick={syncData} 
          disabled={syncing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Синхронизация...' : 'Синхронизировать с Google Drive'}
        </Button>
      </div>

      {/* Статистика карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий Брутто</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data?.stats.totalGross.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Выводы минус депозиты</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий Нетто</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data?.stats.totalNet.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">После вычета расходов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Расходы</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${data?.stats.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {data?.stats.totalGross > 0 
                ? `${((data.stats.totalExpenses / data.stats.totalGross) * 100).toFixed(1)}% от брутто`
                : '0% от брутто'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Карты</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.stats.usedCardCount} / {data?.stats.cardCount}
            </div>
            <p className="text-xs text-muted-foreground">Использовано / Всего</p>
          </CardContent>
        </Card>
      </div>

      {/* Таблица зарплат */}
      <Card>
        <CardHeader>
          <CardTitle>Зарплаты сотрудников</CardTitle>
          <CardDescription>Расчет за {currentMonth}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead className="text-right">База</TableHead>
                <TableHead className="text-right">Бонус</TableHead>
                <TableHead className="text-right">Лидер бонус</TableHead>
                <TableHead className="text-right">Итого</TableHead>
                <TableHead className="text-center">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.salaries.map((salary) => (
                <TableRow key={salary.id}>
                  <TableCell className="font-medium">
                    {salary.employee?.username || 'Unknown'}
                  </TableCell>
                  <TableCell className="text-right">
                    ${salary.base_salary?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell className="text-right">
                    ${salary.bonus?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell className="text-right">
                    ${salary.leader_bonus?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ${salary.total_salary?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      salary.is_paid 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {salary.is_paid ? 'Оплачено' : 'Ожидает'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Таблица транзакций */}
      <Card>
        <CardHeader>
          <CardTitle>Последние транзакции</CardTitle>
          <CardDescription>Все операции за {currentMonth}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead>Казино</TableHead>
                <TableHead className="text-right">Депозит (GBP)</TableHead>
                <TableHead className="text-right">Вывод (GBP)</TableHead>
                <TableHead className="text-right">Брутто (USD)</TableHead>
                <TableHead>Карта</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.transactions.slice(0, 10).map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {transaction.employee?.username || 'Unknown'}
                  </TableCell>
                  <TableCell>{transaction.casino_name}</TableCell>
                  <TableCell className="text-right">
                    £{transaction.deposit_gbp?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell className="text-right">
                    £{transaction.withdrawal_gbp?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ${transaction.gross_profit_usd?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {transaction.card_number || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
