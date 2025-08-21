'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Проверяем авторизацию и перенаправляем на соответствующий дашборд
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()
        
        if (data.success) {
          // Пользователь авторизован, перенаправляем на правильный дашборд
          if (data.user.is_manager) {
            router.push('/dashboard')
          } else {
            router.push('/employee-dashboard')
          }
        } else {
          // Не авторизован, остаемся на главной
        }
      } catch (error) {
        // Ошибка, остаемся на главной
      }
    }
    
    checkAuth()
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-white">
          Employee Tracking System
        </h1>
        <p className="text-lg text-gray-400 mb-8">
          Система учета работы сотрудников казино-команды
        </p>
        <div className="space-y-4 max-w-md">
          <Button 
            onClick={() => router.push('/login')}
            size="lg" 
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Войти в систему
          </Button>
          <Button 
            onClick={() => router.push('/register')}
            size="lg" 
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Первый вход / Создать пароль
          </Button>
          <div className="mt-8 p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <p className="text-sm text-gray-400">
              📊 Отслеживание транзакций • 💰 Расчет зарплат • 🏆 Таблица лидеров
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
