'use client'

import React, { useState, useRef } from 'react'
import { 
  FileText, 
  User, 
  Mail, 
  MapPin, 
  Calendar,
  CreditCard,
  Building,
  PenTool,
  Check,
  AlertCircle,
  Download
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FormData {
  fullName: string
  passport: string
  issuedBy: string
  issuedDate: string
  address: string
  email: string
  signatureBase64?: string
}

export default function SignNDAPage() {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    passport: '',
    issuedBy: '',
    issuedDate: '',
    address: '',
    email: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [documentUrl, setDocumentUrl] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Функции для рисования подписи
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const getSignatureBase64 = (): string => {
    const canvas = canvasRef.current
    if (!canvas) return ''
    
    return canvas.toDataURL('image/png')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const signatureBase64 = getSignatureBase64()
      
      const response = await fetch('/api/sign-nda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          signatureBase64
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(true)
        setDocumentUrl(result.documentUrl)
      } else {
        setError(result.error || 'Помилка при підписанні NDA')
      }
    } catch (err: any) {
      setError('Помилка підключення до сервера')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 text-white flex items-center justify-center p-6">
        <Card className="bg-gray-800/90 backdrop-blur border-gray-700 max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              NDA Успішно Підписано!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-300">
              Ваш договір про нерозголошення було успішно створено та збережено.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => window.open(documentUrl, '_blank')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Переглянути Документ
              </Button>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                На Головну
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-12 h-12 text-blue-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">Підписання NDA</h1>
          </div>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Договір про нерозголошення конфіденційної інформації з компанією Xbsidian Co.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Форма */}
          <Card className="bg-gray-800/90 backdrop-blur border-gray-700">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-400" />
                Персональні Дані
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* ПІБ */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Повне ім'я *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Іванов Іван Іванович"
                  />
                </div>

                {/* Паспорт */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <CreditCard className="w-4 h-4 inline mr-1" />
                    Серія та номер паспорта *
                  </label>
                  <input
                    type="text"
                    name="passport"
                    value={formData.passport}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="АА 123456"
                  />
                </div>

                {/* Ким виданий */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Building className="w-4 h-4 inline mr-1" />
                    Ким виданий *
                  </label>
                  <input
                    type="text"
                    name="issuedBy"
                    value={formData.issuedBy}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Печерським РВ ГУ МВС України в м. Києві"
                  />
                </div>

                {/* Дата видачі */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Дата видачі *
                  </label>
                  <input
                    type="date"
                    name="issuedDate"
                    value={formData.issuedDate}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Адреса */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Адреса проживання *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="м. Київ, вул. Хрещатик, буд. 1, кв. 1"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="example@email.com"
                  />
                </div>

                {/* Подпись */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <PenTool className="w-4 h-4 inline mr-1" />
                    Електронний підпис
                  </label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4">
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={150}
                      className="w-full bg-white rounded cursor-crosshair"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                    <div className="flex justify-between mt-2">
                      <span className="text-xs text-gray-400">Намалюйте ваш підпис мишкою</span>
                      <Button
                        type="button"
                        onClick={clearSignature}
                        variant="outline"
                        size="sm"
                        className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        Очистити
                      </Button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center p-4 bg-red-900/50 border border-red-700 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
                    <span className="text-red-300">{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
                >
                  {loading ? 'Підписання...' : 'Підписати NDA'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Превью договора */}
          <Card className="bg-gray-800/90 backdrop-blur border-gray-700">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-400" />
                Превью Договору
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-300 space-y-3 max-h-96 overflow-y-auto">
                <div className="text-center font-bold text-white">
                  ДОГОВІР ПРО НЕРОЗГОЛОШЕННЯ КОНФІДЕНЦІЙНОЇ ІНФОРМАЦІЇ
                </div>
                
                <p>
                  <strong>Компанія «Xbsidian Co.»</strong>, надалі – "Роботодавець", 
                  представлена директором Андрієм Головачем.
                </p>
                
                <p>
                  <strong>Працівник {formData.fullName || '[ПІБ]'}</strong>, 
                  паспортні дані {formData.passport || '[ПАСПОРТ]'}, 
                  надалі іменований "Співробітник".
                </p>

                <div className="bg-gray-700/50 p-3 rounded">
                  <h4 className="font-semibold text-blue-300 mb-2">Основні положення:</h4>
                  <ul className="text-xs space-y-1">
                    <li>• Захист конфіденційної інформації компанії</li>
                    <li>• Заборона розголошення комерційних секретів</li>
                    <li>• Строк дії: 11 років після припинення відносин</li>
                    <li>• Штраф за порушення: 50,000 євро</li>
                    <li>• Електронний підпис має юридичну силу</li>
                  </ul>
                </div>

                <div className="bg-blue-900/30 p-3 rounded border border-blue-700">
                  <h4 className="font-semibold text-blue-300 mb-2">Важливо:</h4>
                  <p className="text-xs">
                    Підписуючи цей договір, ви погоджуєтесь не розголошувати 
                    конфіденційну інформацію компанії Xbsidian Co. протягом 
                    всього періоду співпраці та 11 років після її завершення.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
