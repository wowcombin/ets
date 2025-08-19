'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function TestSyncPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runSync = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    
    try {
      // Используем новый endpoint
      const response = await fetch('/api/sync')
      const data = await response.json()
      
      if (data.success) {
        setResults(data)
      } else {
        setError(data.error || 'Sync failed')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const testDatabase = async () => {
    try {
      const response = await fetch('/api/test-db')
      const data = await response.json()
      alert(`База данных: ${data.success ? 'Подключена ✅' : 'Ошибка ❌'}\n${JSON.stringify(data.debug, null, 2)}`)
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`)
    }
  }

  const testGoogle = async () => {
    try {
      const response = await fetch('/api/test-google')
      const data = await response.json()
      alert(`Google API: ${data.success ? 'Работает ✅' : 'Ошибка ❌'}\n${data.message || data.error}`)
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`)
    }
  }

  const clearDatabase = async () => {
    if (!confirm('Это удалит ВСЕ данные из базы. Продолжить?')) return
    
    try {
      const response = await fetch('/api/clear-all')
      const data = await response.json()
      alert(`База очищена: ${JSON.stringify(data.deleted)}`)
      setResults(null)
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`)
    }
  }

  const checkData = async () => {
    try {
      const response = await fetch('/api/check-data')
      const data = await response.json()
      console.log('Data check:', data)
      alert(`Проверка данных:\n${JSON.stringify(data.status, null, 2)}`)
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Панель синхронизации</h1>
      
      {/* Кнопки управления */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button
          onClick={runSync}
          disabled={loading}
          className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Синхронизация...' : 'Запустить синхронизацию'}
        </button>
        
        <button
          onClick={testDatabase}
          className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Тест БД
        </button>
        
        <button
          onClick={testGoogle}
          className="px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
        >
          Тест Google API
        </button>
        
        <button
          onClick={clearDatabase}
          className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Очистить БД
        </button>
        
        <button
          onClick={checkData}
          className="px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
        >
          Проверить данные
        </button>
      </div>

      {/* Ошибки */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <h3 className="font-bold">Ошибка:</h3>
          </div>
          <pre className="mt-2 text-sm text-red-600">{error}</pre>
        </div>
      )}

      {/* Результаты */}
      {results && (
        <div className="space-y-6">
          {/* Успешное сообщение */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <h3 className="font-bold">Синхронизация завершена!</h3>
            </div>
            <p className="mt-1 text-green-600">{results.message}</p>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">Сотрудников</div>
              <div className="text-2xl font-bold">{results.stats.employeesProcessed}</div>
            </div>
            
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">Транзакций</div>
              <div className="text-2xl font-bold">{results.stats.transactionsCreated}</div>
            </div>
            
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">Карт</div>
              <div className="text-2xl font-bold">{results.stats.cardsProcessed || 0}</div>
            </div>
            
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">Время</div>
              <div className="text-2xl font-bold">{results.stats.timeElapsed}</div>
            </div>
            
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">Общий Gross</div>
              <div className="text-2xl font-bold text-green-600">
                ${results.stats.totalGross?.toFixed(2)}
              </div>
            </div>
            
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">Общий Net</div>
              <div className="text-2xl font-bold text-blue-600">
                ${results.stats.totalNet?.toFixed(2)}
              </div>
            </div>
            
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">Расходы</div>
              <div className="text-2xl font-bold text-red-600">
                ${results.stats.totalExpenses?.toFixed(2)}
              </div>
            </div>
            
            <div className="p-4 bg-white border rounded-lg">
              <div className="text-sm text-gray-500">Зарплаты</div>
              <div className="text-2xl font-bold">{results.stats.salariesCalculated || 0}</div>
            </div>
          </div>

          {/* Детали по сотрудникам */}
          {results.details && results.details.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-bold mb-3 text-blue-900">Обработанные сотрудники:</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {results.details.map((emp: any, i: number) => (
                  <div key={i} className="p-2 bg-white rounded text-sm">
                    <div className="font-medium">{emp.employee}</div>
                    <div className="text-gray-600">
                      {emp.transactions} транзакций
                      {emp.totalGross && ` • $${emp.totalGross.toFixed(2)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ошибки */}
          {results.errors && results.errors.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700 mb-3">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-bold">Предупреждения:</h3>
              </div>
              <ul className="list-disc list-inside text-sm text-yellow-600 space-y-1">
                {results.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* JSON для отладки */}
          <details className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <summary className="cursor-pointer font-bold text-gray-700">
              Полный ответ (JSON)
            </summary>
            <pre className="mt-3 text-xs overflow-auto bg-white p-3 rounded">
              {JSON.stringify(results, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
