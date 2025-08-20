'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Copy, CreditCard, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface CardData {
  id: string
  card_number: string
  expiry_date?: string
  cvv?: string
  bank_name?: string
  holder_name?: string
  status: 'available' | 'assigned' | 'used'
  casino_name?: string
  assigned_to?: string
  sheet?: string
  created_at?: string
  updated_at?: string
}

interface Employee {
  id: string
  username: string
  is_active: boolean
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardData[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedCasino, setSelectedCasino] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSheet, setSelectedSheet] = useState<string>('all')
  const [casinos, setCasinos] = useState<string[]>([])
  const [sheets, setSheets] = useState<string[]>([])
  const [copiedCard, setCopiedCard] = useState<string | null>(null)
  
  const loadCards = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cards')
      const data = await response.json()
      
      if (data.success) {
        setCards(data.cards || [])
        
        // Извлекаем уникальные казино
        const uniqueCasinos = new Set<string>()
        const uniqueSheets = new Set<string>()
        
        data.cards?.forEach((card: CardData) => {
          if (card.casino_name) uniqueCasinos.add(card.casino_name)
          if (card.sheet) uniqueSheets.add(card.sheet)
        })
        
        setCasinos(Array.from(uniqueCasinos).sort())
        setSheets(Array.from(uniqueSheets).sort())
      }
    } catch (error) {
      console.error('Error loading cards:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/dashboard-data')
      const data = await response.json()
      
      if (data.success && data.data?.employees) {
        setEmployees(data.data.employees.filter((e: Employee) => e.is_active))
      }
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }
  
  const syncCards = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/sync-all')
      const data = await response.json()
      
      if (data.success) {
        await loadCards()
        alert(`Синхронизация завершена! Обработано ${data.stats.cardsProcessed || 0} карт`)
      } else {
        alert(`Ошибка синхронизации: ${data.error}`)
      }
    } catch (error) {
      console.error('Error syncing cards:', error)
      alert('Ошибка при синхронизации')
    } finally {
      setSyncing(false)
    }
  }
  
  const assignCard = async (cardId: string, employeeUsername: string) => {
    // TODO: Implement card assignment API
    alert(`Функция назначения карты ${cardId} сотруднику ${employeeUsername} будет добавлена позже`)
  }
  
  const markCardAsUsed = async (cardId: string, casino: string) => {
    // TODO: Implement mark as used API
    alert(`Функция пометки карты ${cardId} как использованной в ${casino} будет добавлена позже`)
  }
  
  useEffect(() => {
    loadCards()
    loadEmployees()
  }, [])
  
  // Фильтрация карт
  const filteredCards = cards.filter(card => {
    if (selectedStatus !== 'all' && card.status !== selectedStatus) return false
    if (selectedCasino !== 'all' && card.casino_name !== selectedCasino) return false
    if (selectedSheet !== 'all' && card.sheet !== selectedSheet) return false
    return true
  })
  
  // Группировка по листам
  const cardsBySheet = filteredCards.reduce((acc, card) => {
    const sheet = card.sheet || 'Unknown'
    if (!acc[sheet]) acc[sheet] = []
    acc[sheet].push(card)
    return acc
  }, {} as Record<string, CardData[]>)
  
  const copyCard = (card: CardData) => {
    const text = `${card.card_number}${card.expiry_date ? `\t${card.expiry_date}` : ''}${card.cvv ? `\t${card.cvv}` : ''}`
    navigator.clipboard.writeText(text)
    setCopiedCard(card.id)
    setTimeout(() => setCopiedCard(null), 2000)
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 border-green-300'
      case 'assigned': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'used': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4" />
      case 'assigned': return <AlertCircle className="w-4 h-4" />
      case 'used': return <XCircle className="w-4 h-4" />
      default: return null
    }
  }
  
  // Статистика
  const stats = {
    total: cards.length,
    available: cards.filter(c => c.status === 'available').length,
    assigned: cards.filter(c => c.status === 'assigned').length,
    used: cards.filter(c => c.status === 'used').length
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }
  
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Управление картами</h1>
          <p className="text-gray-600 mt-1">Всего карт в системе: {stats.total}</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={loadCards} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Обновить
          </Button>
          <Button 
            onClick={syncCards}
            disabled={syncing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхронизировать'}
          </Button>
        </div>
      </div>
      
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Всего карт</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500 mt-1">В базе данных</p>
          </CardContent>
        </Card>
        
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Свободные</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.available}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.total > 0 ? `${(stats.available / stats.total * 100).toFixed(1)}%` : '0%'}
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Назначенные</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.assigned}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.total > 0 ? `${(stats.assigned / stats.total * 100).toFixed(1)}%` : '0%'}
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Использованные</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.used}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.total > 0 ? `${(stats.used / stats.total * 100).toFixed(1)}%` : '0%'}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Фильтры */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Все статусы</option>
                <option value="available">Свободные</option>
                <option value="assigned">Назначенные</option>
                <option value="used">Использованные</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Казино</label>
              <select
                value={selectedCasino}
                onChange={(e) => setSelectedCasino(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Все казино</option>
                {casinos.map(casino => (
                  <option key={casino} value={casino}>{casino}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Лист</label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Все листы</option>
                {sheets.map(sheet => (
                  <option key={sheet} value={sheet}>{sheet}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Карты по листам */}
      {Object.entries(cardsBySheet).length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Нет карт для отображения</p>
            <p className="text-sm text-gray-400 mt-2">Попробуйте изменить фильтры или синхронизировать данные</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(cardsBySheet).map(([sheet, sheetCards]) => (
          <Card key={sheet} className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {sheet}
                <span className="text-sm font-normal text-gray-500">({sheetCards.length} карт)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Номер карты</th>
                      <th className="text-left py-2 px-3">Срок</th>
                      <th className="text-left py-2 px-3">CVV</th>
                      <th className="text-left py-2 px-3">Банк</th>
                      <th className="text-left py-2 px-3">Владелец</th>
                      <th className="text-left py-2 px-3">Статус</th>
                      <th className="text-left py-2 px-3">Казино</th>
                      <th className="text-left py-2 px-3">Назначена</th>
                      <th className="text-left py-2 px-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheetCards.map((card) => (
                      <tr key={card.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-2 px-3 font-mono text-sm">{card.card_number}</td>
                        <td className="py-2 px-3 text-sm">{card.expiry_date || '-'}</td>
                        <td className="py-2 px-3 text-sm">{card.cvv || '-'}</td>
                        <td className="py-2 px-3 text-sm">{card.bank_name || '-'}</td>
                        <td className="py-2 px-3 text-sm">{card.holder_name || '-'}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(card.status)}`}>
                            {getStatusIcon(card.status)}
                            {card.status === 'available' ? 'Свободна' :
                             card.status === 'assigned' ? 'Назначена' : 'Использована'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-sm">{card.casino_name || '-'}</td>
                        <td className="py-2 px-3 text-sm">{card.assigned_to || '-'}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyCard(card)}
                              className="flex items-center gap-1"
                            >
                              {copiedCard === card.id ? (
                                <>
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                  <span className="text-green-600">Скопировано</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Копировать
                                </>
                              )}
                            </Button>
                            
                            {card.status === 'available' && (
                              <select
                                onChange={(e) => e.target.value && assignCard(card.id, e.target.value)}
                                className="text-xs px-2 py-1 border rounded"
                                defaultValue=""
                              >
                                <option value="">Назначить...</option>
                                {employees.map(emp => (
                                  <option key={emp.id} value={emp.username}>
                                    {emp.username}
                                  </option>
                                ))}
                              </select>
                            )}
                            
                            {card.status === 'assigned' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const casino = prompt('Введите название казино:')
                                  if (casino) markCardAsUsed(card.id, casino)
                                }}
                                className="text-xs"
                              >
                                Использована
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
