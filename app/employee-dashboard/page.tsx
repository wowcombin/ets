'use client'

import React, { useEffect, useState } from 'react'
import { 
  Trophy, 
  DollarSign, 
  TrendingUp, 
  Users,
  Calendar,
  User,
  LogOut,
  Home,
  Wallet,
  PieChart,
  Crown,
  Medal,
  Award
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface EmployeeData {
  month: string
  user: {
    id: string
    username: string
    is_manager: boolean
    stats: {
      id: string
      username: string
      totalGross: number
      transactionCount: number
      casinoCount: number
      rank: number
      salary: {
        base_salary: number
        bonus: number
        leader_bonus: number
        total_salary: number
        is_paid: boolean
      } | null
    }
  }
  stats: {
    totalGross: number
    employeeCount: number
    transactionCount: number
    casinoCount: number
  }
  leaderboard: Array<{
    id: string
    username: string
    totalGross: number
    transactionCount: number
    casinoCount: number
    rank: number
    salary: any
  }>
  casinoStats: Array<{
    name: string
    totalGross: number
    transactionCount: number
    employeeCount: number
    avgProfit: number
  }>
  recentTransactions: Array<{
    id: string
    employee: string
    casino_name: string
    gross_profit_usd: number
    deposit_usd: number
    withdrawal_usd: number
    card_number: string
    created_at: string
  }>
}

export default function EmployeeDashboard() {
  const [data, setData] = useState<EmployeeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  
  const currentMonth = new Date().toLocaleDateString('ru-RU', { 
    month: 'long', 
    year: 'numeric' 
  })

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/employee-data')
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
    const interval = setInterval(loadData, 60000) // Обновляем каждую минуту
    return () => clearInterval(interval)
  }, [router])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <TrendingUp className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-400">Загрузка данных...</p>
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

  const myStats = data?.user.stats
  const topThree = data?.leaderboard.slice(0, 3) || []

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Дашборд сотрудника
              </h1>
              <p className="text-sm text-gray-400 mt-1 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {currentMonth}
                <span className="ml-3 text-blue-400">
                  Привет, {data?.user.username}!
                </span>
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => router.push('/profile')}
                variant="outline"
                className="text-blue-400 border-blue-400 hover:bg-blue-900/20"
              >
                <User className="w-4 h-4 mr-2" />
                Профиль
              </Button>
              
              {data?.user.is_manager && (
                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="outline"
                  className="text-green-400 border-green-400 hover:bg-green-900/20"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Админ панель
                </Button>
              )}
              
              <Button
                onClick={logout}
                variant="outline"
                className="text-red-400 border-red-400 hover:bg-red-900/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Общий профит
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">
                ${(data?.stats.totalGross || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Брутто профит всех сотрудников
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Активных сотрудников
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-400">
                {data?.leaderboard.filter(item => item.is_active).length || 0}
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Работают в этом месяце
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-400" />
                Казино
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-400">
                {data?.casinoStats.length || 0}
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Активных площадок
              </p>
            </CardContent>
          </Card>
        </div>

        {/* My Stats */}
        {myStats && (
          <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Моя статистика
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-2">
                    #{myStats.rank}
                    {myStats.rank === 1 && <Crown className="w-5 h-5" />}
                    {myStats.rank === 2 && <Medal className="w-5 h-5" />}
                    {myStats.rank === 3 && <Award className="w-5 h-5" />}
                  </div>
                  <p className="text-sm text-gray-400">Место</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    ${myStats.salary?.total_salary.toFixed(2) || '0.00'}
                  </div>
                  <p className="text-sm text-gray-400">Общая зарплата</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    ${myStats?.totalGross.toFixed(2) || '0.00'}
                  </div>
                  <p className="text-sm text-gray-400">Мой профит</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {myStats.transactionCount}
                  </div>
                  <p className="text-sm text-gray-400">Транзакций</p>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${myStats.salary?.is_paid ? 'text-green-400' : 'text-yellow-400'}`}>
                    {myStats.salary?.is_paid ? 'Оплачено' : 'Ожидает'}
                  </div>
                  <p className="text-sm text-gray-400">Статус выплаты</p>
                </div>
              </div>
              
              {(myStats.salary?.bonus > 0 || myStats.salary?.leader_bonus > 0) && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myStats.salary?.bonus > 0 && (
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-400">
                          +${myStats.salary.bonus.toFixed(2)}
                        </div>
                        <p className="text-sm text-gray-400">Бонус за результат</p>
                      </div>
                    )}
                    {myStats.salary?.leader_bonus > 0 && (
                      <div className="text-center">
                        <div className="text-xl font-bold text-yellow-400 flex items-center justify-center gap-2">
                          <Trophy className="w-4 h-4" />
                          +${myStats.salary.leader_bonus.toFixed(2)}
                        </div>
                        <p className="text-sm text-gray-400">Лидер месяца</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Top 3 */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Топ-3 лидера месяца
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topThree.map((leader, index) => (
                <div
                  key={leader.username}
                  className={`relative p-4 rounded-lg border-2 ${
                    index === 0
                      ? 'border-yellow-500 bg-yellow-900/10'
                      : index === 1
                      ? 'border-gray-400 bg-gray-900/10'
                      : 'border-orange-500 bg-orange-900/10'
                  }`}
                >
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-3">
                      {index === 0 && <Crown className="w-8 h-8 text-yellow-400" />}
                      {index === 1 && <Medal className="w-8 h-8 text-gray-400" />}
                      {index === 2 && <Award className="w-8 h-8 text-orange-400" />}
                    </div>
                    <h3 className="font-bold text-white text-lg mb-1">
                      {leader.username}
                    </h3>
                    <div className={`text-2xl font-bold mb-2 ${
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : 'text-orange-400'
                    }`}>
                      ${leader.total_salary.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>База: ${leader.base_salary.toFixed(2)}</div>
                      {leader.bonus > 0 && <div>Бонус: +${leader.bonus.toFixed(2)}</div>}
                      {leader.leader_bonus > 0 && (
                        <div className="text-yellow-400">
                          <Trophy className="w-3 h-3 inline mr-1" />
                          Лидер: +${leader.leader_bonus.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className={`mt-3 px-2 py-1 rounded text-xs ${
                      leader.is_paid 
                        ? 'bg-green-900/30 text-green-400' 
                        : 'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {leader.is_paid ? 'Оплачено' : 'Ожидает'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Full Leaderboard */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Таблица лидеров ({data?.leaderboard.length || 0} сотрудников)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">#</th>
                    <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                    <th className="text-right py-3 px-4 text-gray-400">База</th>
                    <th className="text-right py-3 px-4 text-gray-400">Бонус</th>
                    <th className="text-right py-3 px-4 text-gray-400">Лидер</th>
                    <th className="text-right py-3 px-4 text-gray-400">Итого</th>
                    <th className="text-center py-3 px-4 text-gray-400">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.leaderboard.map((employee) => (
                    <tr 
                      key={employee.username} 
                      className={`border-b border-gray-700/50 hover:bg-gray-700/30 ${
                        employee.username === data.user.username ? 'bg-blue-900/20' : ''
                      } ${
                        employee.leader_bonus > 0 ? 'bg-yellow-900/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold">
                        <div className="flex items-center gap-2">
                          #{employee.rank}
                          {employee.rank === 1 && <Crown className="w-4 h-4 text-yellow-400" />}
                          {employee.rank === 2 && <Medal className="w-4 h-4 text-gray-400" />}
                          {employee.rank === 3 && <Award className="w-4 h-4 text-orange-400" />}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            employee.username === data.user.username ? 'text-blue-400' : 'text-white'
                          }`}>
                            {employee.username}
                          </span>
                          {employee.username === data.user.username && (
                            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">Вы</span>
                          )}
                          {!employee.is_active && (
                            <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded">Уволен</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">${employee.base_salary.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">
                        {employee.bonus > 0 ? (
                          <span className="text-green-400">${employee.bonus.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {employee.leader_bonus > 0 ? (
                          <span className="text-yellow-400 font-bold flex items-center justify-end gap-1">
                            <Trophy className="w-3 h-3" />
                            ${employee.leader_bonus.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-green-400">
                        ${employee.total_salary.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          employee.is_paid 
                            ? 'bg-green-900/30 text-green-400' 
                            : 'bg-yellow-900/30 text-yellow-400'
                        }`}>
                          {employee.is_paid ? 'Оплачено' : 'Ожидает'}
                        </span>
                        {employee.paid_at && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(employee.paid_at).toLocaleDateString('ru-RU')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Casino Stats */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Профит по казино
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.casinoStats.slice(0, 9).map((casino, index) => (
                <div key={casino.name} className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-300">{casino.name}</span>
                    <span className="text-lg font-bold text-green-400">
                      ${casino.profit.toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ 
                        width: `${Math.min((casino.profit / (data.stats.totalGross || 1)) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {((casino.profit / (data.stats.totalGross || 1)) * 100).toFixed(1)}% от общего
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
