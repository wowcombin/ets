'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Copy, CreditCard } from 'lucide-react'

interface CardData {
  id: string
  card_number: string
  expiry_date?: string
  cvv?: string
  bank_name?: string
  holder_name?: string
  status: 'available' | 'assigned' | 'used'
  casino_name?: string
  sheet?: string
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCasino, setSelectedCasino] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('available')
  const [casinos, setCasinos] = useState<string[]>([])
  
  const loadCards = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cards')
      const data = await response.json()
      
      if (data.success) {
        setCards(data.cards || [])
        
        // Извлекаем уникальные казино
        const uniqueCasinos = new Set<string>()
        data.cards?.forEach((card: CardData) => {
          if (card.casino_name) {
            uniqueCasinos.add(card.casino_name)
          }
        })
        setCasinos(Array.from(uniqueCasinos).sort())
      }
    } catch (error) {
      console.error('Error loading cards:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadCards()
  }, [])
  
  // Фильтрация карт
  const filteredCards = cards.filter(card => {
    if (selectedStatus !== 'all' && card.status !== selectedStatus) {
      return false
    }
    if (selectedCasino !== 'all' && card.casino_name !== selectedCasino) {
      return false
    }
    return true
  })
  
  // Группировка по листам
  const cardsBySheet = filteredCards.reduce((acc, card) => {
    const sheet = card.sheet || 'Unknown'
    if (!acc[sheet]) {
      acc[sheet] = []
    }
    acc[sheet].push(card)
    return acc
  }, {} as Record<string, CardData[]>)
  
  const copyCard = (card: CardData) => {
    const text = `${card.card_number}\t${card.expiry_date || ''}\t${card.cvv || ''}`
    navigator.clipboard.writeText(text)
    alert('Скопировано в буфер обмена!')
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'assigned': return 'bg-yellow-100 text-yellow-800'
      case 'used': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    )
  }
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Управление картами</h1>
        <Button onClick={loadCards} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Обновить
        </Button>
      </div>
      
      {/* Фильтры */}
      <div className="flex gap-4 mb-6">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="all">Все статусы</option>
          <option value="available">Свободные</option>
          <option value="assigned">Назначенные</option>
          <option value="used">Использованные</option>
        </select>
        
        <select
          value={selectedCasino}
          onChange={(e) => setSelectedCasino(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="all">Все казино</option>
          {casinos.map(casino => (
            <option key={casino} value={casino}>{casino}</option>
          ))}
        </select>
      </div>
      
      {/* Статистика */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Всего карт</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cards.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Свободные</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {cards.filter(c => c.status === 'available').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Назначенные</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {cards.filter(c => c.status === 'assigned').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Использованные</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {cards.filter(c => c.status === 'used').length}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Карты по листам */}
      {Object.entries(cardsBySheet).map(([sheet, sheetCards]) => (
        <Card key={sheet} className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {sheet} ({sheetCards.length} карт)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Номер карты</th>
                    <th className="text-left py-2">Срок</th>
                    <th className="text-left py-2">CVV</th>
                    <th className="text-left py-2">Банк</th>
                    <th className="text-left py-2">Владелец</th>
                    <th className="text-left py-2">Статус</th>
                    <th className="text-left py-2">Казино</th>
                    <th className="text-left py-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetCards.map((card) => (
                    <tr key={card.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 font-mono">{card.card_number}</td>
                      <td className="py-2">{card.expiry_date || '-'}</td>
                      <td className="py-2">{card.cvv || '-'}</td>
                      <td className="py-2">{card.bank_name || '-'}</td>
                      <td className="py-2">{card.holder_name || '-'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(card.status)}`}>
                          {card.status === 'available' ? 'Свободна' :
                           card.status === 'assigned' ? 'Назначена' : 'Использована'}
                        </span>
                      </td>
                      <td className="py-2">{card.casino_name || '-'}</td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyCard(card)}
                          className="flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          Копировать
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
