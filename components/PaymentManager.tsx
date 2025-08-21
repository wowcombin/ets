'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  DollarSign, 
  Check, 
  X, 
  ExternalLink, 
  AlertCircle, 
  Wallet,
  Hash,
  Calendar,
  User
} from 'lucide-react'

interface Salary {
  id: string
  employee_id: string
  base_salary: number
  bonus: number
  leader_bonus: number
  total_salary: number
  is_paid: boolean
  paid_at?: string
  payment_hash?: string
  payment_note?: string
  employee?: {
    username: string
    is_manager: boolean
    usdt_address?: string
  }
}

interface PaymentManagerProps {
  salaries: Salary[]
  onPaymentUpdate: () => void
}

export default function PaymentManager({ salaries, onPaymentUpdate }: PaymentManagerProps) {
  const [payingId, setPayingId] = useState<string | null>(null)
  const [paymentHash, setPaymentHash] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null)

  const handleMarkAsPaid = async (salaryId: string) => {
    setPayingId(salaryId)
    
    try {
      const response = await fetch('/api/payments/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salary_id: salaryId,
          payment_hash: paymentHash || null,
          payment_note: paymentNote || null
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setPaymentHash('')
        setPaymentNote('')
        setShowPaymentForm(null)
        onPaymentUpdate()
        alert('✅ Выплата успешно отмечена!')
      } else {
        alert(`❌ Ошибка: ${data.error}`)
      }
    } catch (error) {
      alert('❌ Ошибка соединения')
    } finally {
      setPayingId(null)
    }
  }

  const unpaidSalaries = salaries.filter(s => !s.is_paid)
  const paidSalaries = salaries.filter(s => s.is_paid)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">К выплате</p>
                <p className="text-2xl font-bold text-yellow-400">
                  ${unpaidSalaries.reduce((sum, s) => sum + s.total_salary, 0).toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {unpaidSalaries.length} сотрудников
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Выплачено</p>
                <p className="text-2xl font-bold text-green-400">
                  ${paidSalaries.reduce((sum, s) => sum + s.total_salary, 0).toFixed(2)}
                </p>
              </div>
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {paidSalaries.length} сотрудников
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Всего</p>
                <p className="text-2xl font-bold text-blue-400">
                  ${salaries.reduce((sum, s) => sum + s.total_salary, 0).toFixed(2)}
                </p>
              </div>
              <Wallet className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {salaries.length} сотрудников
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Unpaid Salaries */}
      {unpaidSalaries.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              К выплате ({unpaidSalaries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {unpaidSalaries.map((salary) => (
                <div key={salary.id} className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-white">
                          {salary.employee?.username}
                        </span>
                        {salary.employee?.is_manager && (
                          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded">
                            Менеджер
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-400">База</p>
                          <p className="font-medium">${salary.base_salary.toFixed(2)}</p>
                        </div>
                        {salary.bonus > 0 && (
                          <div>
                            <p className="text-xs text-gray-400">Бонус</p>
                            <p className="font-medium text-green-400">+${salary.bonus.toFixed(2)}</p>
                          </div>
                        )}
                        {salary.leader_bonus > 0 && (
                          <div>
                            <p className="text-xs text-gray-400">Лидер</p>
                            <p className="font-medium text-yellow-400">+${salary.leader_bonus.toFixed(2)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-400">Итого</p>
                          <p className="font-bold text-lg text-green-400">
                            ${salary.total_salary.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {salary.employee?.usdt_address ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Wallet className="w-3 h-3" />
                          <span className="font-mono">
                            {salary.employee.usdt_address.slice(0, 6)}...{salary.employee.usdt_address.slice(-4)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          <span>USDT адрес не указан</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => setShowPaymentForm(
                          showPaymentForm === salary.id ? null : salary.id
                        )}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Отметить оплату
                      </Button>
                    </div>
                  </div>

                  {/* Payment Form */}
                  {showPaymentForm === salary.id && (
                    <div className="mt-4 pt-4 border-t border-gray-600">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Хеш транзакции (опционально)
                          </label>
                          <div className="relative">
                            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={paymentHash}
                              onChange={(e) => setPaymentHash(e.target.value)}
                              placeholder="0x..."
                              className="w-full pl-10 pr-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Заметка (опционально)
                          </label>
                          <textarea
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder="Комментарий к выплате..."
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleMarkAsPaid(salary.id)}
                            disabled={payingId === salary.id}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {payingId === salary.id ? 'Сохранение...' : 'Подтвердить'}
                          </Button>
                          <Button
                            onClick={() => {
                              setShowPaymentForm(null)
                              setPaymentHash('')
                              setPaymentNote('')
                            }}
                            size="sm"
                            variant="outline"
                            className="border-gray-500 text-gray-300"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Отмена
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paid Salaries */}
      {paidSalaries.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              Выплачено ({paidSalaries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paidSalaries.map((salary) => (
                <div key={salary.id} className="bg-green-900/10 border border-green-800/30 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-white">
                          {salary.employee?.username}
                        </span>
                        <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">
                          Оплачено
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <span className="font-bold text-green-400">
                          ${salary.total_salary.toFixed(2)}
                        </span>
                        
                        {salary.paid_at && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(salary.paid_at).toLocaleString('ru-RU')}</span>
                          </div>
                        )}
                        
                        {salary.payment_hash && (
                          <div className="flex items-center gap-1 text-blue-400">
                            <ExternalLink className="w-3 h-3" />
                            <a 
                              href={`https://bscscan.com/tx/${salary.payment_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline font-mono"
                            >
                              {salary.payment_hash.slice(0, 8)}...{salary.payment_hash.slice(-6)}
                            </a>
                          </div>
                        )}
                      </div>
                      
                      {salary.payment_note && (
                        <p className="text-sm text-gray-400 mt-2 italic">
                          "{salary.payment_note}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
