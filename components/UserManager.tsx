'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Users, 
  Key, 
  User, 
  AlertCircle, 
  CheckCircle, 
  Copy,
  UserCheck,
  UserX,
  Crown
} from 'lucide-react'

interface Employee {
  id: string
  username: string
  is_manager: boolean
  is_active: boolean
  last_login?: string
  created_password_at?: string
  usdt_address?: string
}

interface UserManagerProps {
  employees: Employee[]
  onUpdate: () => void
}

export default function UserManager({ employees, onUpdate }: UserManagerProps) {
  const [generatingPassword, setGeneratingPassword] = useState<string | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleGeneratePassword = async (username: string) => {
    setGeneratingPassword(username)
    setError('')
    setSuccess('')
    
    try {
      const response = await fetch('/api/admin/generate-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setGeneratedPassword(data.password)
        setSelectedUser(username)
        setSuccess(`Новый пароль создан для ${username}`)
        onUpdate()
      } else {
        setError(data.error || 'Ошибка создания пароля')
      }
    } catch (error) {
      setError('Ошибка соединения')
    } finally {
      setGeneratingPassword(null)
    }
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
    alert('Пароль скопирован!')
  }

  const activeEmployees = employees.filter(e => e.is_active && !e.username.includes('УВОЛЕН'))
  const inactiveEmployees = employees.filter(e => !e.is_active || e.username.includes('УВОЛЕН'))
  const managers = activeEmployees.filter(e => e.is_manager)
  const workers = activeEmployees.filter(e => !e.is_manager)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Всего</p>
                <p className="text-2xl font-bold text-blue-400">{employees.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Активные</p>
                <p className="text-2xl font-bold text-green-400">{activeEmployees.length}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Менеджеры</p>
                <p className="text-2xl font-bold text-yellow-400">{managers.length}</p>
              </div>
              <Crown className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Уволенные</p>
                <p className="text-2xl font-bold text-red-400">{inactiveEmployees.length}</p>
              </div>
              <UserX className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Password Generation Form */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-400" />
            Генерация паролей
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Выберите сотрудника
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите сотрудника...</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.username}>
                    {employee.username} {employee.is_manager ? '(Менеджер)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">{success}</span>
              </div>
            )}

            {generatedPassword && (
              <div className="p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Новый пароль:</span>
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
                  {generatedPassword}
                </div>
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠️ Сохраните пароль и передайте сотруднику
                </p>
              </div>
            )}

            <Button
              onClick={() => handleGeneratePassword(selectedUser)}
              disabled={!selectedUser || generatingPassword === selectedUser}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Key className="w-4 h-4 mr-2" />
              {generatingPassword === selectedUser ? 'Генерация...' : 'Создать новый пароль'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Employees */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-400" />
            Активные сотрудники ({activeEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400">Сотрудник</th>
                  <th className="text-center py-3 px-4 text-gray-400">Роль</th>
                  <th className="text-center py-3 px-4 text-gray-400">USDT</th>
                  <th className="text-center py-3 px-4 text-gray-400">Последний вход</th>
                  <th className="text-center py-3 px-4 text-gray-400">Пароль создан</th>
                  <th className="text-center py-3 px-4 text-gray-400">Действия</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((employee) => (
                  <tr key={employee.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 bg-yellow-900/10">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-white">{employee.username}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 bg-yellow-900 text-yellow-300 rounded text-xs">
                        <Crown className="w-3 h-3 inline mr-1" />
                        Менеджер
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {employee.usdt_address ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <span className="text-red-400 text-xs">✗</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-400">
                      {employee.last_login 
                        ? new Date(employee.last_login).toLocaleDateString('ru-RU')
                        : 'Никогда'
                      }
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-400">
                      {employee.created_password_at 
                        ? new Date(employee.created_password_at).toLocaleDateString('ru-RU')
                        : 'Не создан'
                      }
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        onClick={() => handleGeneratePassword(employee.username)}
                        disabled={generatingPassword === employee.username}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Key className="w-3 h-3 mr-1" />
                        {generatingPassword === employee.username ? 'Генерация...' : 'Пароль'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {workers.map((employee) => (
                  <tr key={employee.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-white">{employee.username}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs">
                        Сотрудник
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {employee.usdt_address ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <span className="text-red-400 text-xs">✗</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-400">
                      {employee.last_login 
                        ? new Date(employee.last_login).toLocaleDateString('ru-RU')
                        : 'Никогда'
                      }
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-400">
                      {employee.created_password_at 
                        ? new Date(employee.created_password_at).toLocaleDateString('ru-RU')
                        : 'Не создан'
                      }
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        onClick={() => handleGeneratePassword(employee.username)}
                        disabled={generatingPassword === employee.username}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Key className="w-3 h-3 mr-1" />
                        {generatingPassword === employee.username ? 'Генерация...' : 'Пароль'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Inactive Employees */}
      {inactiveEmployees.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-400" />
              Уволенные сотрудники ({inactiveEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inactiveEmployees.map((employee) => (
                <div key={employee.id} className="bg-red-900/10 border border-red-800/30 rounded-lg p-4 opacity-75">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-red-400">{employee.username}</span>
                      <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded">
                        Уволен
                      </span>
                      {employee.is_manager && (
                        <span className="text-xs bg-gray-900 text-gray-300 px-2 py-1 rounded">
                          Менеджер
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {employee.last_login 
                        ? `Последний вход: ${new Date(employee.last_login).toLocaleDateString('ru-RU')}`
                        : 'Никогда не входил'
                      }
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
