'use client'

import { useEffect, useState } from 'react'
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
import { 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  CreditCard,
  Download,
  Calendar,
  Users
} from 'lucide-react'

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
  const [error, setError] = useState<string | null>(null)
  
  const currentMonth = new Date().toLocaleDateString('ru-RU', { 
    month: 'long', 
    year: 'numeric' 
  })

  // Загружаем данные
  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard-data')
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || 'Ошибка загрузки данных')
      }
    } catch (error) {
      setError('Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }

  // Синхронизация с Google Drive
  const syncData = async () => {
    if (!confirm('Начать синхронизацию с Google Drive?')) return
    
    setSyncing(true)
    setError(null)
    
    try {
      // Синхронизация
      const response = await fetch('/api/sync')
      const result = await response.json()
      
      if (result.success) {
        // Перезагружаем данные
        await loadData()
        alert(`✅ Синхронизация завершена!\n\nОбработано:\n• ${result.stats.employeesProcessed} сотрудников\n• ${result.stats.transactionsCreated} транзакций\n• ${result.stats.cardsProcessed} карт`)
      } else {
        setError(result.error || 'Ошибка синхронизации')
      }
    } catch (error: any) {
      setError('Ошибка при синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadData()
    // Автообновление каждую минуту
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Employee Tracking System
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                <Calendar className="inline w-4 h-4 mr-1" />
                Данные за {currentMonth}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={loadData}
                variant="outline"
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              
              <Button
                onClick={syncData}
                disabled={syncing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Download className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Синхронизация...' : 'Синхронизировать с Google Drive'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Ошибки */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Статистика карточки */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Общий Брутто
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                ${(data?.stats?.totalGross || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Выводы минус депозиты
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Общий Нетто
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                ${(data?.stats?.totalNet || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                После вычета расходов
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Расходы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                ${(data?.stats?.totalExpenses || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {data?.stats?.totalGross > 0 
                  ? `${((data.stats.totalExpenses / data.stats.totalGross) * 100).toFixed(1)}% от брутто`
                  : '0% от брутто'
                }
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Карты
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {data?.stats?.usedCardCount || 0} / {data?.stats?.cardCount || 0}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Использовано / Всего
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Зарплаты */}
        {data?.salaries && data.salaries.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Зарплаты сотрудников
              </CardTitle>
              <CardDescription>
                Расчет за текущий месяц
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead className="text-right">База</TableHead>
                    <TableHead className="text-right">Бонус</TableHead>
                    <TableHead className="text-right">Лидер бонус</TableHead>
                    <TableHead className="text-right font-bold">Итого</TableHead>
                    <TableHead className="text-center">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.salaries.map((salary) => (
                    <TableRow key={salary.id}>
                      <TableCell className="font-medium">
                        {salary.employee?.username || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(salary.base_salary || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(salary.bonus || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(salary.leader_bonus || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${(salary.total_salary || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
        )}

        {/* Последние транзакции */}
        {data?.transactions && data.transactions.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Последние транзакции
              </CardTitle>
              <CardDescription>
                Всего операций: {data.transactions.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Сотрудник</TableHead>
                      <TableHead>Казино</TableHead>
                      <TableHead className="text-right">Депозит (GBP)</TableHead>
                      <TableHead className="text-right">Вывод (GBP)</TableHead>
                      <TableHead className="text-right font-bold">Брутто (USD)</TableHead>
                      <TableHead>Карта</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.slice(0, 10).map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {transaction.employee?.username || 'Unknown'}
                        </TableCell>
                        <TableCell>{transaction.casino_name}</TableCell>
                        <TableCell className="text-right">
                          £{(transaction.deposit_gbp || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          £{(transaction.withdrawal_gbp || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${
                          transaction.gross_profit_usd >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${(transaction.gross_profit_usd || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-500">
                          {transaction.card_number || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Пустое состояние */}
        {(!data || (!data.transactions?.length && !data.salaries?.length)) && (
          <Card className="border-0 shadow-md">
            <CardContent className="text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет данных для отображения
              </h3>
              <p className="text-gray-500 mb-6">
                Синхронизируйте данные с Google Drive для начала работы
              </p>
              <Button 
                onClick={syncData} 
                disabled={syncing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Начать синхронизацию
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
