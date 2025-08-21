'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import UsdtRequestManager from '@/components/UsdtRequestManager'
import { 
  Home, 
  LogOut, 
  User, 
  RefreshCw,
  Wallet
} from 'lucide-react'

interface UsdtRequestsData {
  requests: any[]
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
}

export default function UsdtRequestsPage() {
  const [data, setData] = useState<UsdtRequestsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Проверяем авторизацию
      const authResponse = await fetch('/api/auth/me')
      const authData = await authResponse.json()
      
      if (!authData.success) {
        router.push('/login')
        return
      }
      
      setUser(authData.user)
      
      if (!authData.user.is_manager) {
        router.push('/employee-dashboard')
        return
      }
      
      // Загружаем запросы
      const response = await fetch('/api/usdt-change-request')
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

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  useEffect(() => {
    loadData()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-400">Загрузка запросов USDT...</p>
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Запросы на изменение USDT</h1>
              <p className="text-gray-400">Управление запросами на изменение адресов кошельков</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={loadData}
                className="bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
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
        {data && (
          <UsdtRequestManager
            requests={data.requests}
            summary={data.summary}
            onUpdate={loadData}
          />
        )}
        
        {(!data || data.requests.length === 0) && (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p className="text-gray-400">Нет запросов на изменение USDT адресов</p>
          </div>
        )}
      </div>
    </div>
  )
}
