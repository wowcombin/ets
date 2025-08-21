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
  Wallet,
  PieChart,
  Crown,
  Medal,
  Award,
  Activity,
  Target,
  Zap,
  Star,
  RefreshCw
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
  accountsActivity: Array<{
    username: string
    isActive: boolean
    latestActivity?: string
    weeklyProfit: number
    monthlyProfit: number
    totalTransactions: number
    averageProfit: number
    topCasino: string
  }>
  weeklyLeaders: Array<{
    username: string
    weeklyProfit: number
    topCasino: string
  }>
}

export default function EmployeeDashboard() {
  const [data, setData] = useState<EmployeeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const router = useRouter()
  
  const currentMonth = new Date().toLocaleDateString('ru-RU', { 
    month: 'long', 
    year: 'numeric' 
  })

  const loadData = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true)
    }
    setError(null)
    try {
      const response = await fetch('/api/employee-data', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
        setLastUpdated(new Date())
        console.log('Employee data updated:', new Date().toLocaleTimeString())
        console.log('Recent transactions count:', result.data.recentTransactions?.length || 0)
        console.log('Sample transaction:', result.data.recentTransactions?.[0])
      } else {
        console.error('Employee data API error:', result)
        if (response.status === 401) {
          console.log('Unauthorized - redirecting to login')
          router.push('/login')
          return
        }
        setError(result.error || 'Ошибка загрузки данных')
      }
    } catch (error) {
      console.error('Error loading employee data:', error)
      setError(`Ошибка при загрузке данных: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  useEffect(() => {
    // Первая загрузка с показом лоадера
    loadData(true)
    
    // Автообновление каждые 5 минут без показа лоадера
    const interval = setInterval(() => {
      loadData(false) // false = не показывать лоадер при фоновых обновлениях
    }, 300000) // 300000 мс = 5 минут
    
    return () => clearInterval(interval)
  }, [router])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <Zap className="w-8 h-8 animate-pulse mx-auto mb-4 text-blue-500" />
          <p className="text-gray-400">Загружаем вашу статистику...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => loadData(true)} className="bg-blue-600 hover:bg-blue-700">
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  const myStats = data?.user.stats
  const topThree = data?.leaderboard.slice(0, 3) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 text-white">
      {/* Header */}
      <header className="bg-gray-800/90 backdrop-blur border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-blue-400" />
                Player Dashboard
              </h1>
              <p className="text-sm text-gray-400 mt-1 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {currentMonth}
                <span className="ml-3 text-blue-400">
                  Добро пожаловать, {data?.user.username}!
                </span>
                {loading && (
                  <RefreshCw className="w-3 h-3 animate-spin ml-2 text-green-400" />
                )}
                {lastUpdated && !loading && (
                  <span className="ml-3 text-xs text-gray-500 flex items-center">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Обновлено: {lastUpdated.toLocaleTimeString('ru-RU', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => loadData(true)}
                variant="outline"
                className="text-green-400 border-green-400 hover:bg-green-900/20"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              
              <Button
                onClick={() => router.push('/profile')}
                variant="outline"
                className="text-blue-400 border-blue-400 hover:bg-blue-900/20"
              >
                <User className="w-4 h-4 mr-2" />
                Профиль
              </Button>
              
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
        {/* Personal Earnings Card */}
        {myStats && (
          <Card className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-500/50 mb-8 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-6 h-6 text-green-400" />
                💰 Ваш заработок
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-5xl font-bold text-green-400 mb-4">
                  ${myStats.salary?.total_salary?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xl text-gray-300 mb-6">
                  {myStats.salary ? `Итоговая зарплата за ${data?.month}` : 'Зарплата еще не рассчитана'}
                </p>
                
                {myStats.salary ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-400">
                        ${myStats.salary.base_salary?.toFixed(2) || '0.00'}
                      </div>
                      <p className="text-sm text-gray-400">Базовая зарплата (10%)</p>
                    </div>
                    
                    {(myStats.salary.bonus || 0) > 0 && (
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-400">
                          +${myStats.salary.bonus?.toFixed(2) || '0.00'}
                        </div>
                        <p className="text-sm text-gray-400">Бонус за результат</p>
                      </div>
                    )}
                    
                    {(myStats.salary.leader_bonus || 0) > 0 && (
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-2">
                          <Trophy className="w-5 h-5" />
                          +${myStats.salary.leader_bonus?.toFixed(2) || '0.00'}
                        </div>
                        <p className="text-sm text-gray-400">Лидер месяца</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-800/50 rounded-lg p-6 max-w-md mx-auto">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-400 mb-2">
                        ${myStats.totalGross?.toFixed(2) || '0.00'}
                      </div>
                      <p className="text-sm text-gray-400">Ваш профит за месяц</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Зарплата будет рассчитана в конце месяца
                      </p>
                    </div>
                  </div>
                )}
                
                {myStats.salary && (
                  <div className="mt-6 p-4 bg-gray-800/30 rounded-lg">
                    <div className={`text-lg font-bold ${myStats.salary.is_paid ? 'text-green-400' : 'text-yellow-400'}`}>
                      {myStats.salary.is_paid ? '✅ Выплачено' : '⏳ Ожидает выплаты'}
                    </div>
                    {myStats.salary.is_paid && (
                      <p className="text-sm text-gray-400 mt-1">
                        Поздравляем! Ваша зарплата была выплачена
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Performance Card */}
        {myStats && (
          <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/50 mb-8 shadow-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Star className="w-6 h-6 text-yellow-400" />
                Ваши достижения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-400 flex items-center justify-center gap-2 mb-2">
                    #{myStats.rank}
                    {myStats.rank === 1 && <Crown className="w-6 h-6" />}
                    {myStats.rank === 2 && <Medal className="w-6 h-6" />}
                    {myStats.rank === 3 && <Award className="w-6 h-6" />}
                  </div>
                  <p className="text-sm text-gray-300">Место в рейтинге</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400 mb-2">
                    ${myStats.totalGross.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-300">Ваш профит</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400 mb-2">
                    {myStats.transactionCount}
                  </div>
                  <p className="text-sm text-gray-300">Транзакций</p>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400 mb-2">
                    {myStats.casinoCount}
                  </div>
                  <p className="text-sm text-gray-300">Казино</p>
                </div>
              </div>
              
              {myStats.salary && (
                <div className="mt-6 pt-6 border-t border-gray-600">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-400">
                        ${myStats.salary.total_salary.toFixed(2)}
                      </div>
                      <p className="text-sm text-gray-300">Общая зарплата</p>
                    </div>
                    
                    {myStats.salary.bonus > 0 && (
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-400">
                          +${myStats.salary.bonus.toFixed(2)}
                        </div>
                        <p className="text-sm text-gray-300">Бонус за результат</p>
                      </div>
                    )}
                    
                    {myStats.salary.leader_bonus > 0 && (
                      <div className="text-center">
                        <div className="text-xl font-bold text-yellow-400 flex items-center justify-center gap-2">
                          <Trophy className="w-5 h-5" />
                          +${myStats.salary.leader_bonus.toFixed(2)}
                        </div>
                        <p className="text-sm text-gray-300">Лидер месяца!</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center mt-4">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                      myStats.salary.is_paid 
                        ? 'bg-green-900/30 text-green-400 border border-green-600' 
                        : 'bg-yellow-900/30 text-yellow-400 border border-yellow-600'
                    }`}>
                      <Wallet className="w-4 h-4" />
                      {myStats.salary.is_paid ? 'Зарплата выплачена' : 'Ожидает выплаты'}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Общий профит команды</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${(data?.stats.totalGross || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Активных игроков</p>
                  <p className="text-2xl font-bold text-blue-400">{data?.stats.employeeCount}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Всего транзакций</p>
                  <p className="text-2xl font-bold text-purple-400">{data?.stats.transactionCount}</p>
                </div>
                <Activity className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Активных казино</p>
                  <p className="text-2xl font-bold text-orange-400">{data?.stats.casinoCount}</p>
                </div>
                <Target className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top 3 Leaders */}
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              🏆 Топ-3 лидера месяца
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topThree.map((leader, index) => (
                <div
                  key={leader.username}
                  className={`relative p-6 rounded-xl border-2 ${
                    index === 0
                      ? 'border-yellow-500 bg-gradient-to-br from-yellow-900/20 to-orange-900/20'
                      : index === 1
                      ? 'border-gray-400 bg-gradient-to-br from-gray-900/20 to-blue-900/20'
                      : 'border-orange-500 bg-gradient-to-br from-orange-900/20 to-red-900/20'
                  }`}
                >
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                      {index === 0 && <Crown className="w-12 h-12 text-yellow-400" />}
                      {index === 1 && <Medal className="w-12 h-12 text-gray-400" />}
                      {index === 2 && <Award className="w-12 h-12 text-orange-400" />}
                    </div>
                    <h3 className="font-bold text-white text-xl mb-2">
                      {leader.username}
                      {leader.username === data?.user.username && (
                        <span className="ml-2 text-xs bg-blue-600 px-2 py-1 rounded">ВЫ</span>
                      )}
                    </h3>
                    <div className={`text-3xl font-bold mb-3 ${
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : 'text-orange-400'
                    }`}>
                      ${leader.totalGross.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>🎯 {leader.transactionCount} транзакций</div>
                      <div>🏢 {leader.casinoCount} казино</div>
                      {leader.salary?.leader_bonus > 0 && (
                        <div className="text-yellow-400 font-bold">
                          👑 Лидер месяца!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Full Leaderboard */}
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              🏁 Таблица лидеров ({data?.leaderboard.length || 0} игроков)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">#</th>
                    <th className="text-left py-3 px-4 text-gray-400">Игрок</th>
                    <th className="text-right py-3 px-4 text-gray-400">💰 Профит</th>
                    <th className="text-right py-3 px-4 text-gray-400">🎯 Транзакций</th>
                    <th className="text-right py-3 px-4 text-gray-400">🏢 Казино</th>
                    <th className="text-center py-3 px-4 text-gray-400">💸 Выплата</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.leaderboard.map((employee) => (
                    <tr 
                      key={employee.username} 
                      className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${
                        employee.username === data.user.username ? 'bg-blue-900/20 border-blue-500/30' : ''
                      } ${
                        employee.salary?.leader_bonus > 0 ? 'bg-yellow-900/10' : ''
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
                            <span className="text-xs bg-blue-600 text-blue-100 px-2 py-1 rounded-full">ВЫ</span>
                          )}
                          {employee.salary?.leader_bonus > 0 && (
                            <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-1 rounded-full">ЛИДЕР</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-green-400">
                        ${employee.totalGross.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">{employee.transactionCount}</td>
                      <td className="py-3 px-4 text-right">{employee.casinoCount}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          employee.salary?.is_paid 
                            ? 'bg-green-900/30 text-green-400 border border-green-600' 
                            : 'bg-yellow-900/30 text-yellow-400 border border-yellow-600'
                        }`}>
                          {employee.salary?.is_paid ? '✅ Выплачено' : '⏳ Ожидает'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Casino Performance */}
        <Card className="bg-gray-800/50 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              🎰 Производительность казино
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.casinoStats.slice(0, 9).map((casino, index) => (
                <div key={casino.name} className="bg-gray-700/50 rounded-xl p-4 border border-gray-600">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-white">{casino.name}</h4>
                      <p className="text-xs text-gray-400">{casino.employeeCount} игроков</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-400">${casino.totalGross.toFixed(0)}</p>
                      <p className="text-xs text-gray-400">{casino.transactionCount} транз.</p>
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ 
                        width: `${Math.min((casino.totalGross / (data.stats.totalGross || 1)) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{((casino.totalGross / (data.stats.totalGross || 1)) * 100).toFixed(1)}% от общего</span>
                    <span>Средний: ${casino.avgProfit.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5" />
              📈 Успешные транзакции
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.recentTransactions.slice(0, 10).map((transaction, index) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-white">{transaction.employee}</p>
                      <p className="text-sm text-gray-400">{transaction.casino_name}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-bold text-green-400">
                      +${transaction.gross_profit_usd.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(transaction.created_at).toLocaleString('ru-RU', { 
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
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
