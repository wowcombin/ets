'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  CreditCard,
  User,
  TrendingUp,
  PieChart,
  RefreshCw,
  Home,
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  Copy
} from 'lucide-react'

interface CardAnalysis {
  cardNumber: string
  expiryDate: string
  cvv: string
  bankName: string
  status: 'free' | 'assigned' | 'used'
  assignedTo?: string
  assignedCasino?: string
  depositAmount?: number
  hasDeposit: boolean
  hasThemesDeposit: boolean
  themesDeposit?: number
  transactionCount: number
}

interface EmployeeStat {
  username: string
  totalCards: number
  cardsWithDeposit: number
  cardsWithZeroDeposit: number
  successRate: number
  casinos: string[]
}

interface CasinoStat {
  casinoName: string
  totalCards: number
  freeCards: number
  assignedCards: number
  usedCards: number
  cardsWithDeposit: number
  availableCards: Array<{
    cardNumber: string
    expiryDate: string
    cvv: string
    bankName: string
  }>
}

interface AnalysisData {
  month: string
  stats: {
    totalCards: number
    freeCards: number
    assignedCards: number
    usedCards: number
    cardsWithSuccessfulDeposit: number
    uniqueCasinos: number
  }
  cards: CardAnalysis[]
  casinoGroups: Array<{
    casinoName: string
    availableCards: CardAnalysis[]
    totalAvailable: number
  }>
}

export default function CardsAnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCardDetails, setShowCardDetails] = useState(false)
  const [selectedCasino, setSelectedCasino] = useState<string>('')
  const router = useRouter()

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/cards/details')
      const result = await response.json()
      
      if (result.success) {
        setData(result)
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

  const copyCardInfo = (card: any) => {
    const info = `${card.cardNumber} | ${card.expiryDate} | ${card.cvv} | ${card.bankName}`
    navigator.clipboard.writeText(info)
    alert('Данные карты скопированы!')
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-400">Анализируем карты...</p>
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

  const filteredCasinoStats = selectedCasino 
    ? data?.casinoStats.filter(c => c.casinoName === selectedCasino)
    : data?.casinoStats

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Анализ карт
              </h1>
              <p className="text-sm text-gray-400 mt-1 flex items-center">
                <CreditCard className="w-4 h-4 mr-1" />
                {data?.month} • {data?.stats.totalCards} карт в системе
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={loadData}
                disabled={loading}
                variant="outline"
                className="text-gray-300 border-gray-500 hover:bg-gray-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
                className="text-green-400 border-green-400 hover:bg-green-900/20"
              >
                <Home className="w-4 h-4 mr-2" />
                Главная
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Всего карт</p>
                  <p className="text-2xl font-bold text-blue-400">{data?.stats.totalCards}</p>
                </div>
                <CreditCard className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Свободные</p>
                  <p className="text-2xl font-bold text-green-400">{data?.stats.freeCards}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {data?.stats.totalCards ? ((data.stats.freeCards / data.stats.totalCards) * 100).toFixed(1) : 0}% от общего
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Использованы</p>
                  <p className="text-2xl font-bold text-red-400">{data?.stats.usedCards}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                С депозитом: {data?.stats.cardsWithSuccessfulDeposit}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Успешность</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {data?.stats.usedCards ? ((data.stats.cardsWithSuccessfulDeposit / data.stats.usedCards) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-yellow-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Карт с депозитом &gt; 0
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Casino Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Фильтр по казино
          </label>
          <select
            value={selectedCasino}
            onChange={(e) => setSelectedCasino(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все казино</option>
            {data?.casinoGroups.map((casino) => (
              <option key={casino.casinoName} value={casino.casinoName}>
                {casino.casinoName} ({casino.totalAvailable} свободных)
              </option>
            ))}
          </select>
        </div>

        {/* Casino Cards */}
        <div className="space-y-6">
          {(selectedCasino 
            ? data?.casinoGroups.filter(c => c.casinoName === selectedCasino)
            : data?.casinoGroups
          )?.map((casino) => (
              <Card key={casino.casinoName} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-5 h-5" />
                      {casino.casinoName}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-400">Доступных: {casino.totalAvailable}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {casino.availableCards.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-green-400">
                          Доступные карты ({casino.availableCards.length})
                        </h4>
                        <Button
                          onClick={() => setShowCardDetails(!showCardDetails)}
                          size="sm"
                          variant="outline"
                          className="text-blue-400 border-blue-400"
                        >
                          {showCardDetails ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                          {showCardDetails ? 'Скрыть детали' : 'Показать детали'}
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {casino.availableCards.map((card, index) => (
                          <div key={index} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400">Карта #{index + 1}</span>
                              <Button
                                onClick={() => copyCardInfo(card)}
                                size="sm"
                                variant="ghost"
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            
                            {showCardDetails ? (
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs text-gray-400">Номер:</span>
                                  <p className="font-mono text-white">{card.cardNumber}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-400">Срок:</span>
                                  <p className="font-mono text-white">{card.expiryDate}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-400">CVV:</span>
                                  <p className="font-mono text-white">{card.cvv}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-400">Банк:</span>
                                  <p className="text-white">{card.bankName}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="font-mono text-white">****{card.cardNumber.slice(-4)}</p>
                                <p className="text-sm text-gray-400">{card.bankName}</p>
                                <p className="text-xs text-green-400">Готова к использованию</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {casino.availableCards.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <XCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Нет доступных карт для {casino.casinoName}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}


      </div>
    </div>
  )
}
