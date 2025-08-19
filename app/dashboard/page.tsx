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
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  
  const [currentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  })

  // Загружаем данные из API
  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard-data')
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
        console.log('Dashboard data loaded:', result.data)
      } else {
        setError(result.error || 'Failed to load data')
        console.error('Failed to load data:', result)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError('Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }

  // Синхронизация с Google Drive
  const syncData = async () => {
    setSyncing(true)
    setError(null)
    try {
      // Используем полную синхронизацию
      const response = await fetch('/api/sync-complete', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      const result = await response.json()
      
      if (result.success) {
        setLastSync(new Date())
        
        // После синхронизации рассчитываем зарплаты
        const salaryResponse = await fetch('/api/calculate-salaries')
        const salaryResult = await salaryResponse.json()
        
        if (salaryResult.success) {
          console.log('Salaries calculated:', salaryResult)
        }
        
        // Перезагружаем данные
        await loadData()
        
        alert(`Синхронизация завершена!\n` +
          `Сотрудников: ${result.stats.employeesTotal}\n` +
          `Транзакций: ${result.stats.transactionsTotal}\n` +
          `Карт: ${result.stats.cardsTotal}\n` +
          `Время: ${result.stats.timeElapsed}`)
      } else {
        console.error('Sync error details:', result)
        setError(result.error || 'Ошибка синхронизации')
        alert(`Ошибка синхронизации: ${result.error || 'Неизвестная ошибка'}`)
      }
    } catch (error: any) {
      console.error('Sync error:', error)
      setError(error.message || 'Ошибка при синхронизации')
      alert('Ошибка при синхронизации. Проверьте консоль для деталей.')
    } finally {
      setSyncing(false)
    }
  }

  // Тестирование подключения
  const testConnection = async () => {
    try {
      const response = await fetch('/api/test-db')
      const result = await response.json()
      console.log('Database test:', result)
      alert(`База данных: ${result.success ? 'Подключена' : 'Ошибка'}`)
    } catch (error) {
      console.error('Test error:', error)
    }
  }

  useEffect(() => {
    loadData()
    // Автообновление каждые 30 секунд
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Загрузка данных...</p>
        </div>
      </div>
    )
  }

  // Если нет данных, показываем пустое состояние
  if (!data || (!data.employees?.length && !data.transactions?.length)) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Нет данных для отображения</h2>
          <p className="text-gray-600 mb-6">
            Синхронизируйте данные с Google Drive для начала работы
          </p>
          <div className="space-x-4">
            <Button 
              onClick={syncData} 
              disabled={syncing}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронизация...' : 'Синхронизировать'}
            </Button>
            <Button 
              onClick={testConnection}
              variant="outline"
            >
              Тест базы данных
            </Button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded">
              {error}
            </div>
          )}
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
          {lastSync && (
            <p className="text-sm text-gray-500">
              Последняя синхронизация: {lastSync.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="space-x-2">
          <Button 
            onClick={syncData} 
            disabled={syncing}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать с Google Drive'}
          </Button>
          <Button 
            onClick={loadData}
            variant="outline"
            disabled={loading}
          >
            Обновить
          </Button>
        </div>
      </div>

      {/* Показываем ошибки */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded">
          {error}
        </div>
      )}

      {/* Статистика карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий Брутто</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(data?.stats?.totalGross || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Выводы минус депозиты</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий Нетто</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(data?.stats?.totalNet || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">После вычета расходов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Расходы</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(data?.stats?.totalExpenses || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.stats?.totalGross > 0 
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
              {data?.stats?.usedCardCount || 0} / {data?.stats?.cardCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Использовано / Всего</p>
          </CardContent>
        </Card>
      </div>

      {/* Таблица зарплат */}
      {data?.salaries && data.salaries.length > 0 && (
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
      )}

      {/* Таблица транзакций */}
      {data?.transactions && data.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Последние транзакции</CardTitle>
            <CardDescription>
              Всего операций: {data.transactions.length}
            </CardDescription>
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
                    <TableCell className="text-right font-bold">
                      ${(transaction.gross_profit_usd || 0).toFixed(2)}
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
      )}

      {/* Информация о сотрудниках */}
      {data?.employees && data.employees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Сотрудники</CardTitle>
            <CardDescription>Всего: {data.employees.length}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {data.employees.map((emp) => (
                <div key={emp.id} className="p-2 border rounded">
                  <p className="font-medium">{emp.username}</p>
                  <p className="text-xs text-gray-500">
                    {emp.is_manager ? 'Менеджер' : 'Сотрудник'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
