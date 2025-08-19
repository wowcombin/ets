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
      const response = await fetch('/api/sync')
      const result = await response.json()
      
      if (result.success) {
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
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-400">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Шапка */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Employee Tracking System
              </h1>
              <p className="text-sm text-gray-400 mt-1 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Данные за {currentMonth}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={loadData}
                disabled={loading}
                className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              
              <Button
                onClick={syncData}
                disabled={syncing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Синхронизация...' : 'Синхронизировать с Google Drive'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Ошибки */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Статистика карточки */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-sm font-medium text-gray-400 mb-2">
              Общий Брутто
            </div>
            <div className="text-3xl font-bold text-white">
              ${(data?.stats?.totalGross || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Выводы минус депозиты
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-sm font-medium text-gray-400 mb-2">
              Общий Нетто
            </div>
            <div className="text-3xl font-bold text-blue-400">
              ${(data?.stats?.totalNet || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              После вычета расходов
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-sm font-medium text-gray-400 mb-2">
              Расходы
            </div>
            <div className="text-3xl font-bold text-red-400">
              ${(data?.stats?.totalExpenses || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {data?.stats?.totalGross && data.stats.totalGross > 0 
                ? `${(((data.stats.totalExpenses || 0) / data.stats.totalGross) * 100).toFixed(1)}% от брутто`
                : '0% от брутто'
              }
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-sm font-medium text-gray-400 mb-2">
              Карты
            </div>
            <div className="text-3xl font-bold text-white">
              {data?.stats?.usedCardCount || 0} / {data?.stats?.cardCount || 0}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Использовано / Всего
            </p>
          </div>
        </div>

        {/* Зарплаты */}
        {data?.salaries && data.salaries.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Зарплаты сотрудников
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Расчет за текущий месяц
              </p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Сотрудник</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">База</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Бонус</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Лидер бонус</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Итого</th>
                      <th className="text-center py-3 px-4 text-gray-400 font-medium">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.salaries.map((salary) => (
                      <tr key={salary.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-medium">
                          {salary.employee?.username || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          ${(salary.base_salary || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          ${(salary.bonus || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          ${(salary.leader_bonus || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-green-400">
                          ${(salary.total_salary || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            salary.is_paid 
                              ? 'bg-green-900/30 text-green-400 border border-green-800' 
                              : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                          }`}>
                            {salary.is_paid ? 'Оплачено' : 'Ожидает'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Последние транзакции */}
        {data?.transactions && data.transactions.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Последние транзакции
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Всего операций: {data.transactions.length}
              </p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Сотрудник</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Казино</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Депозит (GBP)</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Вывод (GBP)</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-medium">Брутто (USD)</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Карта</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.slice(0, 10).map((transaction) => (
                      <tr key={transaction.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-medium">
                          {transaction.employee?.username || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {transaction.casino_name}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          £{(transaction.deposit_gbp || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          £{(transaction.withdrawal_gbp || 0).toFixed(2)}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${
                          transaction.gross_profit_usd >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ${(transaction.gross_profit_usd || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-500">
                          {transaction.card_number || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Пустое состояние */}
        {(!data || (!data.transactions?.length && !data.salaries?.length)) && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12">
            <div className="text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-medium mb-2">
                Нет данных для отображения
              </h3>
              <p className="text-gray-400 mb-6">
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
