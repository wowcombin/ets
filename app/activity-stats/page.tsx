'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Activity,
  User,
  Clock,
  CreditCard,
  TrendingUp,
  Calendar,
  Home,
  LogOut,
  RefreshCw,
  DollarSign,
  Target,
  Award,
  Users
} from 'lucide-react'

interface EmployeeActivityData {
  month: string
  totalEmployees: number
  activeEmployees: number
  employeeActivity: Array<{
    employee_id: string
    username: string
    lastActivity: {
      time: string
      type: 'deposit' | 'withdrawal'
      amount: number
      casino: string
      card: string
    } | null
    totalActiveTransactions: number
    totalUniqueCards: number
    totalWorkDays: number
    avgCardsPerDay: number
    bestDay: {
      date: string
      cardsUsed: number
      deposits: number
      withdrawals: number
    } | null
    dailyStats: Array<{
      date: string
      uniqueCardsCount: number
      deposits: number
      withdrawals: number
      totalDeposit: number
      totalWithdrawal: number
    }>
    monthlyTotals: {
      totalDeposits: number
      totalWithdrawals: number
      totalDepositAmount: number
      totalWithdrawalAmount: number
      grossProfit: number
    }
  }>
  summary: {
    totalTransactions: number
    activeTransactions: number
    totalUniqueCards: number
  }
}

export default function ActivityStatsPage() {
  const [data, setData] = useState<EmployeeActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const router = useRouter()

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/employee-activity')
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        setError(result.error || 'Ошибка загрузки данных')
      }
    } catch (error) {
      setError('Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  useEffect(() => {
    loadData()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-400">Загрузка статистики активности...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={loadData} className="bg-blue-600 hover:bg-blue-700">
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  const filteredEmployees = selectedEmployee 
    ? data?.employeeActivity.filter(emp => emp.username === selectedEmployee) || []
    : data?.employeeActivity || []

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Активность сотрудников</h1>
              <p className="text-gray-400">Детальная статистика работы за {data?.month}</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={loadData}
                className="bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                <Home className="w-4 h-4 mr-2" />
                Главная
              </Button>
              <Button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Выход
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Всего сотрудников</p>
                  <p className="text-2xl font-bold text-blue-400">{data?.totalEmployees}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Активных</p>
                  <p className="text-2xl font-bold text-green-400">{data?.activeEmployees}</p>
                </div>
                <Activity className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                С ненулевыми операциями
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Активных транзакций</p>
                  <p className="text-2xl font-bold text-purple-400">{data?.summary.activeTransactions}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Из {data?.summary.totalTransactions} всего
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Уникальных карт</p>
                  <p className="text-2xl font-bold text-yellow-400">{data?.summary.totalUniqueCards}</p>
                </div>
                <CreditCard className="w-8 h-8 text-yellow-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Использовано в работе
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Employee Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Фильтр по сотруднику
          </label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все сотрудники</option>
            {data?.employeeActivity.map((emp) => (
              <option key={emp.username} value={emp.username}>
                {emp.username} ({emp.totalUniqueCards} карт)
              </option>
            ))}
          </select>
        </div>

        {/* Employee Activity Table */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Детальная активность сотрудников
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                    <th className="text-left py-3 px-4 text-gray-400">Последняя активность</th>
                    <th className="text-right py-3 px-4 text-gray-400">Карт за день</th>
                    <th className="text-right py-3 px-4 text-gray-400">Всего карт</th>
                    <th className="text-right py-3 px-4 text-gray-400">Рабочих дней</th>
                    <th className="text-right py-3 px-4 text-gray-400">Лучший день</th>
                    <th className="text-right py-3 px-4 text-gray-400">Профит</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr 
                      key={employee.username} 
                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${
                            employee.lastActivity ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          <span className="font-medium text-white">{employee.username}</span>
                        </div>
                      </td>
                      
                      <td className="py-3 px-4">
                        {employee.lastActivity ? (
                          <div>
                            <div className="text-sm text-white">
                              {new Date(employee.lastActivity.time).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            <div className="text-xs text-gray-400">
                              {employee.lastActivity.type === 'deposit' ? '📥 Депозит' : '📤 Вывод'}: 
                              ${employee.lastActivity.amount} • {employee.lastActivity.casino}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Нет активности</span>
                        )}
                      </td>
                      
                      <td className="py-3 px-4 text-right">
                        <span className="text-blue-400 font-medium">
                          {employee.avgCardsPerDay.toFixed(1)}
                        </span>
                      </td>
                      
                      <td className="py-3 px-4 text-right">
                        <span className="text-purple-400 font-medium">
                          {employee.totalUniqueCards}
                        </span>
                      </td>
                      
                      <td className="py-3 px-4 text-right">
                        <span className="text-yellow-400 font-medium">
                          {employee.totalWorkDays}
                        </span>
                      </td>
                      
                      <td className="py-3 px-4 text-right">
                        {employee.bestDay ? (
                          <div className="text-right">
                            <div className="text-green-400 font-bold">
                              {employee.bestDay.cardsUsed} карт
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(employee.bestDay.date).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${
                          employee.monthlyTotals.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ${employee.monthlyTotals.grossProfit.toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Daily Stats for Selected Employee */}
        {selectedEmployee && filteredEmployees.length > 0 && (
          <Card className="bg-gray-800 border-gray-700 mt-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Статистика по дням: {selectedEmployee}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees[0].dailyStats.map((day) => (
                  <div
                    key={day.date}
                    className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-white">
                        {new Date(day.date).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </h4>
                      <span className="text-lg font-bold text-blue-400">
                        {day.uniqueCardsCount} карт
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Депозиты:</span>
                        <span className="text-green-400">{day.deposits} (${day.totalDeposit.toFixed(0)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Выводы:</span>
                        <span className="text-blue-400">{day.withdrawals} (${day.totalWithdrawal.toFixed(0)})</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-600">
                        <span className="text-gray-400">Профит:</span>
                        <span className={`font-bold ${
                          (day.totalWithdrawal - day.totalDeposit) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ${(day.totalWithdrawal - day.totalDeposit).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
