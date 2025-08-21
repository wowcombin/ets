'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Wallet,
  Check, 
  X, 
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface UsdtRequest {
  id: string
  employee: {
    id: string
    username: string
    current_address?: string
  }
  current_address?: string
  requested_address: string
  requested_network: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  created_at: string
}

interface UsdtRequestManagerProps {
  requests: UsdtRequest[]
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
  onUpdate: () => void
}

export default function UsdtRequestManager({ requests, summary, onUpdate }: UsdtRequestManagerProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectionForm, setShowRejectionForm] = useState<string | null>(null)

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId)
    
    try {
      const response = await fetch('/api/usdt-change-request/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          request_id: requestId, 
          action: 'approve' 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        onUpdate()
      } else {
        alert(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      alert('Ошибка соединения')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    if (!rejectionReason.trim()) {
      alert('Укажите причину отклонения')
      return
    }
    
    setProcessingId(requestId)
    
    try {
      const response = await fetch('/api/usdt-change-request/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          request_id: requestId, 
          action: 'reject',
          rejection_reason: rejectionReason.trim()
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setRejectionReason('')
        setShowRejectionForm(null)
        onUpdate()
      } else {
        alert(`Ошибка: ${data.error}`)
      }
    } catch (error) {
      alert('Ошибка соединения')
    } finally {
      setProcessingId(null)
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const processedRequests = requests.filter(r => r.status !== 'pending')

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Всего запросов</p>
                <p className="text-2xl font-bold text-blue-400">{summary.total}</p>
              </div>
              <Wallet className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Ожидают</p>
                <p className="text-2xl font-bold text-yellow-400">{summary.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Одобрено</p>
                <p className="text-2xl font-bold text-green-400">{summary.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Отклонено</p>
                <p className="text-2xl font-bold text-red-400">{summary.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Запросы на рассмотрении ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="bg-gray-700/50 rounded-lg p-4 border border-yellow-500/30">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-medium text-white flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {request.employee.username}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">{request.reason}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(request.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Одобрить
                      </Button>
                      <Button
                        onClick={() => setShowRejectionForm(request.id)}
                        disabled={processingId === request.id}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Отклонить
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Текущий адрес:</p>
                      <p className="font-mono text-gray-300 break-all">
                        {request.current_address || 'Не установлен'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Новый адрес:</p>
                      <p className="font-mono text-green-400 break-all">
                        {request.requested_address}
                      </p>
                    </div>
                  </div>
                  
                  {/* Rejection Form */}
                  {showRejectionForm === request.id && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <label className="block text-sm text-gray-300 mb-2">
                        Причина отклонения:
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                        rows={3}
                        placeholder="Укажите причину отклонения..."
                      />
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => handleReject(request.id)}
                          disabled={processingId === request.id || !rejectionReason.trim()}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Отклонить с причиной
                        </Button>
                        <Button
                          onClick={() => {
                            setShowRejectionForm(null)
                            setRejectionReason('')
                          }}
                          size="sm"
                          variant="outline"
                          className="border-gray-600"
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processed Requests History */}
      {processedRequests.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-gray-400" />
              История запросов ({processedRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processedRequests.slice(0, 10).map((request) => (
                <div key={request.id} className={`bg-gray-700/30 rounded-lg p-3 border ${
                  request.status === 'approved' ? 'border-green-500/30' : 'border-red-500/30'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-white">{request.employee.username}</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        request.status === 'approved' 
                          ? 'bg-green-900/30 text-green-400' 
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {request.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(request.approved_at || request.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  {request.status === 'rejected' && request.rejection_reason && (
                    <p className="text-sm text-red-400 mt-2">
                      Причина: {request.rejection_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
