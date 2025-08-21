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
  const [selectedCasino, setSelectedCasino] = useState('')
  const [showCardDetails, setShowCardDetails] = useState<string[]>([])
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

  const toggleCardDetails = (cardNumber: string) => {
    setShowCardDetails(prev => 
      prev.includes(cardNumber) 
        ? prev.filter(c => c !== cardNumber)
        : [...prev, cardNumber]
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  useEffect(() => {
    loadData()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-400">Загрузка анализа карт...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <XCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={loadData} className="bg-blue-600 hover:bg-blue-700">
            Попробовать снова
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Анализ карт</h1>
              <p className="text-gray-400">Статистика использования карт за {data?.month}</p>
            </div>
            <div className="flex items-center gap-4">
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
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Всего карт</p>
                  <p className="text-2xl font-bold text-blue-400">{data?.stats.totalCards}</p>
                </div>
                <CreditCard className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Свободных</p>
                  <p className="text-2xl font-bold text-green-400">{data?.stats.freeCards}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Использованных</p>
                  <p className="text-2xl font-bold text-red-400">{data?.stats.usedCards}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                С депозитом &gt; 0
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-400">Успешность</p>
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
                {casino.casinoName} ({casino.totalAvailable} доступных)
              </option>
            ))}
          </select>
        </div>

        {/* Casino Cards */}
        {data?.casinoGroups && data.casinoGroups.length > 0 && (
          <div className="space-y-6">
            {data.casinoGroups
              .filter(casino => !selectedCasino || casino.casinoName === selectedCasino)
              .map((casino) => (
              <Card key={casino.casinoName} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-6 h-6" />
                      {casino.casinoName}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-400">Доступных: {casino.totalAvailable}</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-green-400">
                      Доступные карты ({casino.availableCards.length})
                    </h4>
                  </div>
                  
                  {casino.availableCards.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {casino.availableCards.map((card) => (
                        <div
                          key={card.cardNumber}
                          className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-blue-400" />
                              <span className="text-sm text-gray-300">
                                {card.cardNumber.slice(-4)}****
                              </span>
                            </div>
                            <Button
                              onClick={() => toggleCardDetails(card.cardNumber)}
                              size="sm"
                              className="bg-gray-600 hover:bg-gray-500 text-xs"
                            >
                              {showCardDetails.includes(card.cardNumber) ? (
                                <>
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  Скрыть
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3 mr-1" />
                                  Показать
                                </>
                              )}
                            </Button>
                          </div>
                          
                          {showCardDetails.includes(card.cardNumber) && (
                            <div className="space-y-2 pt-2 border-t border-gray-600">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Номер:</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono">{card.cardNumber}</span>
                                  <Button
                                    onClick={() => copyToClipboard(card.cardNumber)}
                                    size="sm"
                                    className="p-1 h-6 w-6 bg-gray-600 hover:bg-gray-500"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Срок:</span>
                                <span className="text-xs font-mono">{card.expiryDate}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">CVV:</span>
                                <span className="text-xs font-mono">{card.cvv}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Банк:</span>
                                <span className="text-xs">{card.bankName}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
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