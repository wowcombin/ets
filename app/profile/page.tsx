'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Wallet, Calendar, LogOut, Save, AlertCircle, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [usdtAddress, setUsdtAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  
  useEffect(() => {
    loadProfile()
  }, [router])
  
  const loadProfile = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()
      
      if (data.success) {
        setUser(data.user)
        setUsdtAddress(data.user.usdt_address || '')
      } else {
        router.push('/login')
      }
    } catch (err) {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }
  
  const saveUsdtAddress = async () => {
    if (!usdtAddress.trim()) {
      setError('USDT адрес не может быть пустым')
      return
    }
    
    setError('')
    setSuccess('')
    setSaving(true)
    
    try {
      // Если адрес уже установлен, создаем запрос на изменение
      if (user?.usdt_address && user.usdt_address !== usdtAddress.trim()) {
        const response = await fetch('/api/usdt-change-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            requested_address: usdtAddress.trim(),
            reason: 'Изменение адреса кошелька'
          })
        })
        
        const data = await response.json()
        
        if (data.success) {
          setSuccess('Запрос на изменение адреса отправлен менеджерам! Ожидайте одобрения.')
        } else {
          setError(data.error || 'Ошибка отправки запроса')
        }
        return
      }
      
      // Если адрес не установлен, сохраняем напрямую
      const response = await fetch('/api/profile/update-usdt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdt_address: usdtAddress.trim() })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('USDT адрес успешно сохранен')
        await loadProfile()
      } else {
        setError(data.error || 'Ошибка сохранения')
      }
    } catch (err) {
      setError('Ошибка соединения')
    } finally {
      setSaving(false)
    }
  }
  
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Загрузка...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Профиль</h1>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                if (user?.is_manager) {
                  router.push('/dashboard')
                } else {
                  router.push('/employee-dashboard')
                }
              }}
              variant="outline"
              className="text-blue-400 border-blue-400 hover:bg-blue-900/20"
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
        
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5" />
              Информация о сотруднике
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-gray-400">Логин:</span>
              <span className="ml-2 text-white font-medium">{user?.username}</span>
            </div>
            <div>
              <span className="text-gray-400">Статус:</span>
              <span className={`ml-2 font-medium ${user?.is_active ? 'text-green-400' : 'text-red-400'}`}>
                {user?.is_active ? 'Активен' : 'Неактивен'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Роль:</span>
              <span className="ml-2 text-white font-medium">
                {user?.is_manager ? 'Менеджер' : 'Сотрудник'}
              </span>
            </div>
            {user?.last_login && (
              <div>
                <span className="text-gray-400">Последний вход:</span>
                <span className="ml-2 text-white font-medium">
                  {new Date(user.last_login).toLocaleString('ru-RU')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Реквизиты для выплат
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  USDT адрес (BEP20)
                </label>
                <input
                  type="text"
                  value={usdtAddress}
                  onChange={(e) => setUsdtAddress(e.target.value)}
                  placeholder="0x..."
                  readOnly={!!user?.usdt_address}
                  className={`w-full px-3 py-2 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    user?.usdt_address 
                      ? 'bg-gray-600 border-gray-500 cursor-not-allowed' 
                      : 'bg-gray-700 border-gray-600'
                  }`}
                />
                <p className="mt-2 text-xs text-gray-400">
                  Укажите адрес кошелька в сети BSC (Binance Smart Chain)
                </p>
                {user?.usdt_address && (
                  <p className="mt-2 text-xs text-yellow-400">
                    💡 Для изменения адреса введите новый адрес и нажмите "Запросить изменение"
                  </p>
                )}
              </div>
              
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}
              
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">{success}</span>
                </div>
              )}
              
              <Button
                onClick={saveUsdtAddress}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Сохранение...' : user?.usdt_address ? 'Запросить изменение' : 'Сохранить адрес'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
