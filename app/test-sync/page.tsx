'use client'

import { useState } from 'react'

export default function TestSyncPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runSync = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    
    try {
      const response = await fetch('/api/sync-all')
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

  const calculateSalaries = async () => {
    try {
      const response = await fetch('/api/calculate-salaries')
      const data = await response.json()
      alert(`Зарплаты рассчитаны: ${JSON.stringify(data.stats)}`)
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Sync Page</h1>
      
      <div className="space-y-4">
        <button
          onClick={runSync}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Синхронизация...' : 'Запустить синхронизацию'}
        </button>
        
        {results && (
          <button
            onClick={calculateSalaries}
            className="ml-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Рассчитать зарплаты
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          <h3 className="font-bold">Ошибка:</h3>
          <pre>{error}</pre>
        </div>
      )}

      {results && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-green-100 rounded">
            <h3 className="font-bold text-green-800">Успешно!</h3>
            <p>{results.message}</p>
          </div>

          <div className="p-4 bg-gray-100 rounded">
            <h3 className="font-bold mb-2">Статистика:</h3>
            <ul className="space-y-1">
              <li>Сотрудников обработано: {results.stats.employeesProcessed}</li>
              <li>Транзакций создано: {results.stats.transactionsCreated}</li>
              <li>Транзакций в БД: {results.stats.transactionsInDb}</li>
              <li>Общий Gross: ${results.stats.totalGross?.toFixed(2)}</li>
              <li>Время: {results.stats.timeElapsed}</li>
            </ul>
          </div>

          {results.employees && (
            <div className="p-4 bg-blue-50 rounded">
              <h3 className="font-bold mb-2">Сотрудники ({results.employees.length}):</h3>
              <div className="grid grid-cols-3 gap-2">
                {results.employees.map((emp: any, i: number) => (
                  <div key={i} className="text-sm">
                    {emp.username}
                    {emp.isManager && ' 👔'}
                    {emp.isFired && ' ❌'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.sampleTransactions && (
            <div className="p-4 bg-yellow-50 rounded">
              <h3 className="font-bold mb-2">Примеры транзакций:</h3>
              <div className="space-y-1 text-sm">
                {results.sampleTransactions.map((t: any, i: number) => (
                  <div key={i}>
                    {t.employee} → {t.casino}: ${t.gross.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.errors && results.errors.length > 0 && (
            <div className="p-4 bg-red-50 rounded">
              <h3 className="font-bold mb-2 text-red-700">Ошибки:</h3>
              <ul className="list-disc list-inside text-sm text-red-600">
                {results.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <details className="p-4 bg-gray-50 rounded">
            <summary className="cursor-pointer font-bold">Полный ответ (JSON)</summary>
            <pre className="mt-2 text-xs overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
