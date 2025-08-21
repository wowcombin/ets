'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Key, AlertCircle, CheckCircle, Copy } from 'lucide-react'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setPassword('')
    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setPassword(data.password)
        setSuccess(true)
      } else {
        setError(data.error || 'Ошибка регистрации')
      }
    } catch (err) {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }
  
  const copyPassword = () => {
    navigator.clipboard.writeText(password)
    alert('Пароль скопирован!')
  }
  
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-white">
            Создание пароля
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!success ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Ваше имя пользователя
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="@username"
                    className="w-full pl-10 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Используйте тот же логин, что и в Google Drive
                </p>
              </div>
              
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Создание...' : 'Создать пароль'}
              </Button>
              
              <div className="text-center">
                <a
                  href="/login"
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Уже есть пароль? Войти
                </a>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">Пароль успешно создан!</span>
              </div>
              
              <div className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Ваш пароль:</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyPassword}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Копировать
                  </Button>
                </div>
                <div className="font-mono text-lg text-white bg-gray-800 p-3 rounded">
                  {password}
                </div>
              </div>
              
              <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-400">
                  ⚠️ ВАЖНО: Сохраните этот пароль! Он больше не будет показан.
                </p>
              </div>
              
              <Button
                onClick={() => window.location.href = '/login'}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Перейти к входу
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
