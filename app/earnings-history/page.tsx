'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Hash, 
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Activity,
  Target,
  Award
} from 'lucide-react'

interface MonthData {
  month: string
  monthLabel: string
  grossProfit: number
  netProfit: number
  salary: number
  bonus: number
  leaderBonus: number
  isPaid: boolean
  paidAt?: string
  paymentHash?: string
  paymentNote?: string
  transactionCount: number
  casinoCount: number
  avgProfit: number
  workDays: number
  topCasino: {
    name: string
    profit: number
    transactions: number
  }
  details?: {
    casinos: Array<{
      name: string
      profit: number
      transactions: number
      avgProfit: number
    }>
    dailyStats: Array<{
      date: string
      profit: number
      transactions: number
    }>
  }
}

export default function EarningsHistoryPage() {
  const [loading, setLoading] = useState(true)
  const [monthsData, setMonthsData] = useState<MonthData[]>([])
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadHistory()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/earnings-history')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to load history')
      }

      const data = await response.json()
      setMonthsData(data.history || [])
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getMonthName = (monthCode: string) => {
    const [year, month] = monthCode.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }

  const getTotalEarnings = () => {
    return monthsData.reduce((sum, month) => sum + month.salary, 0)
  }

  const getAverageMonthly = () => {
    if (monthsData.length === 0) return 0
    return getTotalEarnings() / monthsData.length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-white text-xl">Загрузка истории...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => router.push('/employee-dashboard')}
            variant="outline"
            className="mb-4 text-white border-white hover:bg-white/10"
          >
            ← Назад в дашборд
          </Button>
          
          <h1 className="text-4xl font-bold text-white mb-4">
            📊 История заработков
          </h1>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Всего заработано</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${getTotalEarnings().toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </Card>
            
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Средний месячный</p>
                  <p className="text-2xl font-bold text-blue-400">
                    ${getAverageMonthly().toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </Card>
            
            <Card className="bg-gray-800/50 border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Месяцев работы</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {monthsData.length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-purple-400 opacity-50" />
              </div>
            </Card>
          </div>
        </div>

        {/* Monthly History */}
        <div className="space-y-4">
          {monthsData.map((month) => (
            <Card 
              key={month.month} 
              className="bg-gray-800/50 border-gray-700 overflow-hidden"
            >
              {/* Month Summary */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-700/30 transition-colors"
                onClick={() => setExpandedMonth(expandedMonth === month.month ? null : month.month)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {getMonthName(month.month)}
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Профит</p>
                        <p className="text-white font-medium">${month.grossProfit.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Заработок</p>
                        <p className="text-green-400 font-medium">${month.salary.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Транзакций</p>
                        <p className="text-white font-medium">{month.transactionCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Статус</p>
                        <p className={`font-medium ${month.isPaid ? 'text-green-400' : 'text-yellow-400'}`}>
                          {month.isPaid ? '✅ Выплачено' : '⏳ Ожидает'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Bonuses */}
                    {(month.bonus > 0 || month.leaderBonus > 0) && (
                      <div className="flex gap-4 mt-3">
                        {month.bonus > 0 && (
                          <div className="bg-green-900/30 text-green-400 px-3 py-1 rounded-full text-xs">
                            🎯 Бонус $200
                          </div>
                        )}
                        {month.leaderBonus > 0 && (
                          <div className="bg-yellow-900/30 text-yellow-400 px-3 py-1 rounded-full text-xs">
                            👑 Лидер +${month.leaderBonus.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4">
                    {expandedMonth === month.month ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedMonth === month.month && (
                <div className="border-t border-gray-700">
                  {/* Payment Info */}
                  {month.isPaid && (
                    <div className="p-6 bg-gray-900/50">
                      <h4 className="text-lg font-semibold text-white mb-4">💳 Информация о выплате</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Дата выплаты:</span>
                          <span className="text-white">{month.paidAt ? formatDate(month.paidAt) : 'Н/Д'}</span>
                        </div>
                        
                        {month.paymentHash && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Хеш транзакции:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono text-sm">
                                {month.paymentHash.substring(0, 10)}...{month.paymentHash.substring(month.paymentHash.length - 10)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(month.paymentHash!, 'hash')
                                }}
                                className="text-gray-400 hover:text-white"
                              >
                                {copied === 'hash' ? '✓' : <Copy className="w-4 h-4" />}
                              </Button>
                              <a
                                href={`https://tronscan.org/#/transaction/${month.paymentHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {month.paymentNote && (
                          <div>
                            <span className="text-gray-400">Примечание:</span>
                            <p className="text-white mt-1">{month.paymentNote}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Detailed Stats */}
                  <div className="p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">📈 Детальная статистика</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-blue-400" />
                          <span className="text-gray-400 text-sm">Средний профит</span>
                        </div>
                        <p className="text-xl font-bold text-white">
                          ${month.avgProfit.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">за транзакцию</p>
                      </div>
                      
                      <div className="bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-green-400" />
                          <span className="text-gray-400 text-sm">Казино</span>
                        </div>
                        <p className="text-xl font-bold text-white">
                          {month.casinoCount}
                        </p>
                        <p className="text-xs text-gray-500">активных</p>
                      </div>
                      
                      <div className="bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-purple-400" />
                          <span className="text-gray-400 text-sm">Рабочих дней</span>
                        </div>
                        <p className="text-xl font-bold text-white">
                          {month.workDays}
                        </p>
                        <p className="text-xs text-gray-500">в месяце</p>
                      </div>
                    </div>
                    
                    {/* Top Casino */}
                    {month.topCasino && (
                      <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 p-4 rounded-lg mb-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="w-5 h-5 text-yellow-400" />
                          <span className="text-yellow-400 font-semibold">Лучшее казино месяца</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-bold text-lg">{month.topCasino.name}</p>
                            <p className="text-gray-400 text-sm">
                              {month.topCasino.transactions} транзакций
                            </p>
                          </div>
                          <p className="text-2xl font-bold text-green-400">
                            ${month.topCasino.profit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Salary Breakdown */}
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                      <h5 className="text-white font-semibold mb-3">💰 Расчет заработка</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Базовая ставка (10%)</span>
                          <span className="text-white">${(month.salary - month.bonus - month.leaderBonus).toFixed(2)}</span>
                        </div>
                        {month.bonus > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Бонус за план</span>
                            <span className="text-green-400">+${month.bonus.toFixed(2)}</span>
                          </div>
                        )}
                        {month.leaderBonus > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Бонус лидера</span>
                            <span className="text-yellow-400">+${month.leaderBonus.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-gray-700 flex justify-between font-semibold">
                          <span className="text-white">Итого</span>
                          <span className="text-green-400">${month.salary.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
        
        {monthsData.length === 0 && (
          <Card className="bg-gray-800/50 border-gray-700 p-12 text-center">
            <p className="text-gray-400 text-lg">История заработков пока пуста</p>
            <p className="text-gray-500 mt-2">Здесь будет отображаться ваша история по месяцам</p>
          </Card>
        )}
      </div>
    </div>
  )
}
