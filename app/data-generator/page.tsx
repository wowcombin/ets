'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy, Download, RefreshCw, ArrowLeft } from 'lucide-react'

// Британские имена и фамилии
const firstNames = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Christopher', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark',
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan',
  'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Helen', 'Sandra',
  'Oliver', 'George', 'Harry', 'Jack', 'Jacob', 'Charlie', 'Oscar', 'William',
  'Emily', 'Olivia', 'Amelia', 'Isla', 'Ava', 'Isabella', 'Sophia', 'Grace'
]

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
  'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall', 'Young', 'King',
  'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Carter', 'Mitchell'
]

// Префиксы британских операторов
const ukMobilePrefixes = [
  '070', '071', '073', '074', '075', '076', '077', '078', '079'
]

interface GeneratedData {
  username: string
  password: string
  phone: string
}

export default function DataGeneratorPage() {
  const [count, setCount] = useState(10)
  const [generatedData, setGeneratedData] = useState<GeneratedData[]>([])
  const [includePasswords, setIncludePasswords] = useState(true)
  const [includePhones, setIncludePhones] = useState(true)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  // Генерация username
  const generateUsername = (): string => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const hasNumber = Math.random() > 0.5
    const number = hasNumber ? Math.floor(Math.random() * 999) : ''
    
    const username = `${firstName}${lastName}${number}`.toLowerCase()
    return username.substring(0, 16) // Ограничение до 16 символов
  }

  // Генерация пароля
  const generatePassword = (): string => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const special = '!@#$%^&*'
    
    const length = 10 + Math.floor(Math.random() * 5) // 10-14 символов
    
    // Начинаем с буквы
    const firstLetter = Math.random() > 0.5 ? 
      uppercase[Math.floor(Math.random() * uppercase.length)] :
      lowercase[Math.floor(Math.random() * lowercase.length)]
    
    // Гарантируем по одному символу каждого типа
    let password = firstLetter
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += special[Math.floor(Math.random() * special.length)]
    
    // Заполняем остальное случайными символами
    const allChars = lowercase + uppercase + numbers + special
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // Перемешиваем (кроме первого символа)
    const chars = password.slice(1).split('')
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]]
    }
    
    return firstLetter + chars.join('')
  }

  // Генерация телефона
  const generatePhone = (): string => {
    const prefix = ukMobilePrefixes[Math.floor(Math.random() * ukMobilePrefixes.length)]
    let number = prefix
    
    // Добавляем 8 случайных цифр
    for (let i = 0; i < 8; i++) {
      number += Math.floor(Math.random() * 10)
    }
    
    return number
  }

  // Генерация данных
  const generateData = () => {
    const data: GeneratedData[] = []
    
    for (let i = 0; i < count; i++) {
      data.push({
        username: generateUsername(),
        password: includePasswords ? generatePassword() : '',
        phone: includePhones ? generatePhone() : ''
      })
    }
    
    setGeneratedData(data)
  }

  // Форматирование для копирования в таблицу
  const formatForSpreadsheet = () => {
    let headers = 'Username'
    if (includePasswords) headers += '\tPassword'
    if (includePhones) headers += '\tPhone Number'
    
    const rows = generatedData.map(item => {
      let row = item.username
      if (includePasswords) row += `\t${item.password}`
      if (includePhones) row += `\t${item.phone}`
      return row
    })
    
    return headers + '\n' + rows.join('\n')
  }

  // Копирование в буфер обмена
  const copyToClipboard = async () => {
    const text = formatForSpreadsheet()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Скачивание как CSV
  const downloadCSV = () => {
    const text = formatForSpreadsheet().replace(/\t/g, ',')
    const blob = new Blob([text], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uk-accounts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="container mx-auto p-4 max-w-6xl">
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mb-4 text-white border-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        
        <h1 className="text-4xl font-bold mb-6 text-white">🎲 Генератор данных для UK аккаунтов</h1>
        
        <Card className="bg-gray-800/50 border-gray-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Количество записей
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includePasswords}
                onChange={(e) => setIncludePasswords(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span>Генерировать пароли</span>
            </label>
            
            <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includePhones}
                onChange={(e) => setIncludePhones(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span>Генерировать телефоны</span>
            </label>
          </div>
        </div>
        
        <div className="mt-6 flex gap-4">
          <Button onClick={generateData} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Сгенерировать
          </Button>
        </div>
      </Card>

      {generatedData.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Сгенерированные данные</h2>
            <div className="flex gap-2">
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-blue-400 border-blue-400 hover:bg-blue-900/20"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Скопировано!' : 'Копировать для таблицы'}
              </Button>
              <Button
                onClick={downloadCSV}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-green-400 border-green-400 hover:bg-green-900/20"
              >
                <Download className="w-4 h-4" />
                Скачать CSV
              </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-900/50">
                  <th className="border border-gray-700 p-2 text-left text-gray-300">Username</th>
                  {includePasswords && <th className="border border-gray-700 p-2 text-left text-gray-300">Password</th>}
                  {includePhones && <th className="border border-gray-700 p-2 text-left text-gray-300">Phone Number</th>}
                </tr>
              </thead>
              <tbody>
                {generatedData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                    <td className="border border-gray-700 p-2 font-mono text-sm text-white">{item.username}</td>
                    {includePasswords && (
                      <td className="border border-gray-700 p-2 font-mono text-sm text-white">{item.password}</td>
                    )}
                    {includePhones && (
                      <td className="border border-gray-700 p-2 font-mono text-sm text-white">{item.phone}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-800/30">
            <p className="text-sm text-blue-300">
              💡 Совет: Нажмите "Копировать для таблицы" и вставьте данные прямо в Google Sheets. 
              Данные автоматически распределятся по колонкам!
            </p>
          </div>
        </Card>
      )}
      </div>
    </div>
  )
}
