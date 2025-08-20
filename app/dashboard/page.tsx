'use client'

import React, { useEffect, useState } from 'react'
import { 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  CreditCard,
  Download,
  Calendar,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  PieChart,
  UserCheck,
  UserX,
  Trophy,
  TrendingDown
} from 'lucide-react'

interface Employee {
  id: string
  username: string
  is_manager: boolean
  is_active: boolean
  profit_percentage?: number
}

interface Transaction {
  id: string
  employee_id: string
  casino_name: string
  deposit_gbp: number
  withdrawal_gbp: number
  deposit_usd: number
  withdrawal_usd: number
  gross_profit_usd: number
  card_number: string
  employee?: {
    username: string
    is_manager: boolean
  }
}

interface Salary {
  id: string
  employee_id: string
  base_salary: number
  bonus: number
  leader_bonus: number
  total_salary: number
  is_paid: boolean
  employee?: {
    username: string
    is_manager: boolean
  }
}

interface Card {
  id: string
  card_number: string
  status: 'available' | 'assigned' | 'used'
  casino_name?: string
  sheet?: string
}

interface DashboardData {
  employees: Employee[]
  firedEmployees: Employee[]
  transactions: Transaction[]
  expenses: any[]
  salaries: Salary[]
  cards: Card[]
  month: string
  stats: {
    totalGross: number
    totalNet: number
    totalExpenses: number
    employeeCount: number
    totalEmployeeCount: number
    cardCount: number
    usedCardCount: number
    transactionCount: number
    salaryCount: number
  }
  employeeStats: any[]
  casinoStats: any[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [showAllSalaries, setShowAllSalaries] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'casinos' | 'cards'>('overview')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  
  const currentMonth = new Date().toLocaleDateString('ru-RU', { 
    month: 'long', 
    year: 'numeric' 
  })

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

  const syncData = async () => {
    if (!confirm('Начать синхронизацию с Google Drive? Это может занять несколько минут.')) return
    
    setSyncing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/sync-all')
      const result = await response.json()
      
      if (result.success) {
        setLastSyncTime(new Date())
        await loadData()
        alert(`✅ Синхронизация завершена!\n\nОбработано:\n• ${result.stats.employeesProcessed} сотрудников\n• ${result.stats.transactionsCreated} транзакций\n• ${result.stats.cardsProcessed} карт\n\nОбщий брутто: $${result.stats.totalGross?.toFixed(2)}`)
      } else {
        setError(result.error || 'Ошибка синхронизации')
      }
    } catch (error: any) {
      setError('Ошибка при синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  const calculateSalaries = async () => {
    if (!confirm('Пересчитать зарплаты за текущий месяц?')) return
    
    setCalculating(true)
    try {
      const response = await fetch('/api/calculate-salaries')
      const result = await response.json()
      
      if (result.success) {
        await loadData()
        alert(`✅ Зарплаты рассчитаны!\n\nРассчитано ${result.stats.salariesCreated} зарплат\nЛидер месяца: ${result.stats.leaderEmployee || 'Не определен'}`)
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    } catch (error) {
      alert('Ошибка при расчете зарплат')
    } finally {
      setCalculating(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-400">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  // Правильно определяем активных и уволенных сотрудников
  const activeEmployees = data?.employees?.filter(e => e.is_active && !e.username.includes('УВОЛЕН')) || []
  const firedEmployees = data?.employees?.filter(e => !e.is_active || e.username.includes('УВОЛЕН')) || []
  
  // Также правильно определяем для всех сотрудников
  const allEmployees = [...(data?.employees || []), ...(data?.firedEmployees || [])]
  const totalActiveEmployees = allEmployees.filter(e => e.is_active && !e.username.includes('УВОЛЕН'))
  const totalFiredEmployees = allEmployees.filter(e => !e.is_active || e.username.includes('УВОЛЕН'))
  
  // Правильно разделяем сотрудников на группы для зарплат
  const managers = data?.salaries?.filter(s => s.employee?.is_manager) || []
  
  const workers = data?.salaries?.filter(s => !s.employee?.is_manager) || []
  
  const activeWorkers = workers.filter(s => {
    const emp = allEmployees.find(e => e.id === s.employee_id)
    return emp && emp.is_active && !emp.username.includes('УВОЛЕН')
  })
  
  const firedWorkers = workers.filter(s => {
    const emp = allEmployees.find(e => e.id === s.employee_id)
    return emp && (!emp.is_active || emp.username.includes('УВОЛЕН'))
  })
  
  // Находим лидера месяца
  const leaderSalary = data?.salaries?.find(s => s.leader_bonus > 0)
  
  // Топ сотрудники по заработку
  const topEarners = [...(data?.salaries || [])]
    .sort((a, b) => b.total_salary - a.total_salary)
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Employee Tracking System
              </h1>
              <p className="text-sm text-gray-400 mt-1 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {currentMonth}
                {leaderSalary && (
                  <span className="ml-3 text-yellow-400 flex items-center">
                    <Trophy className="w-4 h-4 mr-1" />
                    Лидер: {leaderSalary.employee?.username}
                  </span>
                )}
                {lastSyncTime && (
                  <span className="ml-3 text-gray-500 text-xs">
                    • Синхронизация: {lastSyncTime.toLocaleTimeString('ru-RU')}
                  </span>
                )}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </button>
              
              <button
                onClick={calculateSalaries}
                disabled={calculating}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <DollarSign className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
                Рассчитать зарплаты
              </button>
              
              <button
                onClick={syncData}
                disabled={syncing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Синхронизация...' : 'Синхронизация'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-6">
          <div className="flex space-x-6">
            {[
              { id: 'overview', label: 'Обзор', icon: Activity },
              { id: 'employees', label: 'Сотрудники', icon: Users },
              { id: 'casinos', label: 'Казино', icon: PieChart },
              { id: 'cards', label: 'Карты', icon: CreditCard }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
                    activeTab === tab.id 
                      ? 'border-blue-500 text-blue-400' 
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{error}</span>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Общий Брутто</span>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-white">
                  ${(data?.stats?.totalGross || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Выводы минус депозиты
                </p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Общий Нетто</span>
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-blue-400">
                  ${(data?.stats?.totalNet || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  После вычета расходов
                </p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Расходы</span>
                  <TrendingDown className="w-5 h-5 text-red-400" />
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

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Карты</span>
                  <CreditCard className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-white">
                  {data?.stats?.usedCardCount || 0} / {data?.stats?.cardCount || 0}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Использовано / Всего
                </p>
              </div>
            </div>

            {/* Employee Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Всего сотрудников</span>
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold">{allEmployees.length}</div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Активные</span>
                  <UserCheck className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-green-400">{totalActiveEmployees.length}</div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Уволенные</span>
                  <UserX className="w-5 h-5 text-red-400" />
                </div>
                <div className="text-3xl font-bold text-red-400">{totalFiredEmployees.length}</div>
              </div>
            </div>

            {/* All Salaries */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Все зарплаты ({data?.salaries?.length || 0})
                  </h2>
                  <button
                    onClick={() => setShowAllSalaries(!showAllSalaries)}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {showAllSalaries ? 'Скрыть' : 'Показать все'}
                    {showAllSalaries ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              {(showAllSalaries || (!showAllSalaries && data?.salaries && data.salaries.length <= 10)) && (
                <div className="p-6">
                  {/* Managers Section */}
                  {managers.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 text-blue-400">Менеджеры</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-3 px-4 text-gray-400">Менеджер</th>
                              <th className="text-right py-3 px-4 text-gray-400">База</th>
                              <th className="text-right py-3 px-4 text-gray-400">Итого</th>
                              <th className="text-center py-3 px-4 text-gray-400">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {managers.map((salary) => (
                              <tr key={salary.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                <td className="py-3 px-4 font-medium">{salary.employee?.username}</td>
                                <td className="py-3 px-4 text-right">${salary.base_salary.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right font-bold text-green-400">
                                  ${salary.total_salary.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    salary.is_paid ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
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
                  )}
                  
                  {/* Active Workers */}
                  {activeWorkers.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 text-green-400 flex items-center gap-2">
                        <UserCheck className="w-5 h-5" />
                        Активные сотрудники ({activeWorkers.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                              <th className="text-right py-3 px-4 text-gray-400">База (10%)</th>
                              <th className="text-right py-3 px-4 text-gray-400">Бонус</th>
                              <th className="text-right py-3 px-4 text-gray-400">Лидер</th>
                              <th className="text-right py-3 px-4 text-gray-400">Итого</th>
                              <th className="text-center py-3 px-4 text-gray-400">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(showAllSalaries ? activeWorkers : activeWorkers.slice(0, 10)).map((salary) => (
                              <tr key={salary.id} className={`border-b border-gray-700/50 hover:bg-gray-700/30 ${
                                salary.leader_bonus > 0 ? 'bg-yellow-900/10' : ''
                              }`}>
                                <td className="py-3 px-4 font-medium">
                                  {salary.employee?.username}
                                  {salary.leader_bonus > 0 && (
                                    <span className="ml-2 text-yellow-400">🏆</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">${salary.base_salary.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right">
                                  {salary.bonus > 0 ? (
                                    <span className="text-green-400">${salary.bonus.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {salary.leader_bonus > 0 ? (
                                    <span className="text-yellow-400 font-bold">
                                      ${salary.leader_bonus.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-green-400">
                                  ${salary.total_salary.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    salary.is_paid ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
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
                  )}
                  
                  {/* Fired Workers */}
                  {firedWorkers.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-red-400 flex items-center gap-2">
                        <UserX className="w-5 h-5" />
                        Уволенные сотрудники ({firedWorkers.length})
                      </h3>
                      <p className="text-sm text-gray-400 mb-3">
                        Сотрудники с транзакциями за текущий месяц
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full opacity-75">
                          <thead>
                            <tr className="border-b border-gray-700">
                              <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                              <th className="text-right py-3 px-4 text-gray-400">База</th>
                              <th className="text-right py-3 px-4 text-gray-400">Бонус</th>
                              <th className="text-right py-3 px-4 text-gray-400">Лидер</th>
                              <th className="text-right py-3 px-4 text-gray-400">Итого</th>
                              <th className="text-center py-3 px-4 text-gray-400">Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {firedWorkers.map((salary) => (
                              <tr key={salary.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                                <td className="py-3 px-4 font-medium">
                                  <span className="text-red-400">{salary.employee?.username}</span>
                                  <span className="ml-2 text-xs text-red-500">(Уволен)</span>
                                </td>
                                <td className="py-3 px-4 text-right">${salary.base_salary.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right">
                                  {salary.bonus > 0 ? `$${salary.bonus.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {salary.leader_bonus > 0 ? (
                                    <span className="text-yellow-400">${salary.leader_bonus.toFixed(2)}</span>
                                  ) : '-'}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-red-400">
                                  ${salary.total_salary.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="px-2 py-1 rounded-full text-xs bg-red-900/30 text-red-400">
                                    Уволен
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            {data?.transactions && data.transactions.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg">
                <div className="p-6 border-b border-gray-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Транзакции ({data.transactions.length})
                      </h2>
                    </div>
                    <button
                      onClick={() => setShowAllTransactions(!showAllTransactions)}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      {showAllTransactions ? 'Скрыть' : 'Показать все'}
                      {showAllTransactions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 px-4 text-gray-400">#</th>
                          <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                          <th className="text-left py-3 px-4 text-gray-400">Казино</th>
                          <th className="text-right py-3 px-4 text-gray-400">Депозит</th>
                          <th className="text-right py-3 px-4 text-gray-400">Вывод</th>
                          <th className="text-right py-3 px-4 text-gray-400">Брутто</th>
                          <th className="text-left py-3 px-4 text-gray-400">Карта</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showAllTransactions ? data.transactions : data.transactions.slice(0, 10)).map((transaction, index) => (
                          <tr key={transaction.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                            <td className="py-3 px-4 font-medium">{transaction.employee?.username || 'Unknown'}</td>
                            <td className="py-3 px-4">{transaction.casino_name}</td>
                            <td className="py-3 px-4 text-right">£{transaction.deposit_gbp.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right">£{transaction.withdrawal_gbp.toFixed(2)}</td>
                            <td className={`py-3 px-4 text-right font-bold ${
                              transaction.gross_profit_usd >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              ${transaction.gross_profit_usd.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">{transaction.card_number || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Всего сотрудников</span>
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold">{allEmployees.length}</div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Активные</span>
                  <UserCheck className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-green-400">{totalActiveEmployees.length}</div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-400">Уволенные</span>
                  <UserX className="w-5 h-5 text-red-400" />
                </div>
                <div className="text-3xl font-bold text-red-400">{totalFiredEmployees.length}</div>
              </div>
            </div>
            
            {/* Employee stats table */}
            {data?.employeeStats && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg">
                <div className="p-6 border-b border-gray-700">
                  <h2 className="text-xl font-bold">Статистика по сотрудникам</h2>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                          <th className="text-right py-3 px-4 text-gray-400">Транзакций</th>
                          <th className="text-right py-3 px-4 text-gray-400">Депозиты</th>
                          <th className="text-right py-3 px-4 text-gray-400">Выводы</th>
                          <th className="text-right py-3 px-4 text-gray-400">Брутто</th>
                          <th className="text-right py-3 px-4 text-gray-400">Казино</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.employeeStats.map((stat: any) => {
                          // Проверяем, уволен ли сотрудник
                          const employee = allEmployees.find(e => e.username === stat.username)
                          const isFired = employee && (!employee.is_active || employee.username.includes('УВОЛЕН'))
                          
                          return (
                            <tr key={stat.id} className={`border-b border-gray-700/50 hover:bg-gray-700/30 ${
                              isFired ? 'opacity-60' : ''
                            }`}>
                              <td className={`py-3 px-4 font-medium ${
                                isFired ? 'text-red-400' : 'text-white'
                              }`}>
                                {stat.username}
                                {isFired && <span className="ml-2 text-xs text-red-500">(Уволен)</span>}
                              </td>
                              <td className="py-3 px-4 text-right">{stat.transactionCount}</td>
                              <td className="py-3 px-4 text-right">${stat.totalDeposits.toFixed(2)}</td>
                              <td className="py-3 px-4 text-right">${stat.totalWithdrawals.toFixed(2)}</td>
                              <td className={`py-3 px-4 text-right font-bold ${
                                isFired ? 'text-red-400' : 'text-green-400'
                              }`}>
                                ${stat.totalGross.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right">{stat.casinos?.length || 0}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Other tabs remain the same... */}
      </div>
    </div>
  )
}
