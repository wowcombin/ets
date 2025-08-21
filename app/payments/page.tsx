'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import PaymentManager from '@/components/PaymentManager'
import { 
  Home, 
  LogOut, 
  User, 
  RefreshCw,
  DollarSign,
  Users
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

export default function PaymentsPage() {
  const [salaries, setSalaries] = useState<Salary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Загружаем данные пользователя
      const userResponse = await fetch('/api/auth/me')
      const userData = await userResponse.json()
      
      if (!userData.success) {
        router.push('/login')
        return
      }
      
      if (!userData.user.is_manager) {
        router.push('/employee-dashboard')
        return
      }
      
      setUser(userData.user)
      
      // Загружаем данные дашборда
      const dashboardResponse = await fetch('/api/dashboard-data')
      const dashboardData = await dashboardResponse.json()
      
      if (dashboardData.success) {
        setSalaries(dashboardData.data.salaries || [])
      } else {
        setError(dashboardData.error || 'Ошибка загрузки данных')
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
          <p className="text-gray-400">Загрузка данных...</p>
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
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Управление выплатами
              </h1>
              <p className="text-sm text-gray-400 mt-1 flex items-center">
                <DollarSign className="w-4 h-4 mr-1" />
                {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                <span className="ml-3 text-blue-400">
                  Менеджер: {user?.username}
                </span>
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
                onClick={() => router.push('/profile')}
                variant="outline"
                className="text-blue-400 border-blue-400 hover:bg-blue-900/20"
              >
                <User className="w-4 h-4 mr-2" />
                Профиль
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
        <PaymentManager 
          salaries={salaries} 
          onPaymentUpdate={loadData}
        />
      </div>
    </div>
  )
}
