'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Download, 
  FileSpreadsheet, 
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts'

interface ReportData {
  month: string
  totalGross: number
  totalNet: number
  totalExpenses: number
  employeeCount: number
  transactionCount: number
  topEmployees: {
    username: string
    gross: number
    transactions: number
  }[]
  casinoStats: {
    name: string
    gross: number
    transactions: number
  }[]
  monthlyTrend?: {
    month: string
    gross: number
    net: number
    expenses: number
  }[]
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year'>('month')
  
  function getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  }
  
  const loadReportData = async () => {
    setLoading(true)
    try {
      // Загружаем основные данные
      const response = await fetch('/api/dashboard-data')
      const result = await response.json()
      
      if (result.success) {
        const data = result.data
        
        // Формируем данные для отчета
        const report: ReportData = {
          month: data.month,
          totalGross: data.stats.totalGross,
          totalNet: data.stats.totalNet,
          totalExpenses: data.stats.totalExpenses,
          employeeCount: data.stats.employeeCount,
          transactionCount: data.stats.transactionCount,
          topEmployees: data.employeeStats?.slice(0, 10).map((e: any) => ({
            username: e.username,
            gross: e.totalGross,
            transactions: e.transactionCount
          })) || [],
          casinoStats: data.casinoStats?.slice(0, 10).map((c: any) => ({
            name: c.name,
            gross: c.totalGross,
            transactions: c.transactionCount
          })) || []
        }
        
        setReportData(report)
      }
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const exportToCSV = () => {
    if (!reportData) return
    
    // Формируем CSV данные
    const headers = ['Метрика', 'Значение']
    const rows = [
      ['Месяц', reportData.month],
      ['Общий брутто', `$${reportData.totalGross.toFixed(2)}`],
      ['Общий нетто', `$${reportData.totalNet.toFixed(2)}`],
      ['Расходы', `$${reportData.totalExpenses.toFixed(2)}`],
      ['Количество сотрудников', reportData.employeeCount],
      ['Количество транзакций', reportData.transactionCount],
      ['', ''],
      ['Топ сотрудники', ''],
      ...reportData.topEmployees.map(e => [e.username, `$${e.gross.toFixed(2)}`]),
      ['', ''],
      ['Статистика по казино', ''],
      ...reportData.casinoStats.map(c => [c.name, `$${c.gross.toFixed(2)}`])
    ]
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    // Создаем и скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `report_${reportData.month}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  const exportToExcel = () => {
    // Для Excel нужна библиотека xlsx, пока экспортируем в CSV
    exportToCSV()
  }
  
  const printReport = () => {
    window.print()
  }
  
  useEffect(() => {
    loadReportData()
  }, [selectedMonth])
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }
  
  if (!reportData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Нет данных для отображения</p>
        </div>
      </div>
    )
  }
  
  // Данные для графиков
  const pieChartData = reportData.casinoStats.map(c => ({
    name: c.name,
    value: c.gross
  }))
  
  const barChartData = reportData.topEmployees.map(e => ({
    name: e.username.replace('@', ''),
    gross: e.gross,
    transactions: e.transactions
  }))
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B6B', '#4ECDC4', '#45B7D1']
  
  return (
    <div className="container mx-auto p-6 print:p-2">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Отчеты и аналитика</h1>
          <p className="text-gray-600 mt-1">Период: {reportData.month}</p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadReportData}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Обновить
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={printReport}>
            Печать
          </Button>
        </div>
      </div>
      
      {/* Фильтры периода */}
      <div className="flex gap-4 mb-6 print:hidden">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value={getCurrentMonth()}>Текущий месяц</option>
          <option value="2024-11">Ноябрь 2024</option>
          <option value="2024-10">Октябрь 2024</option>
          <option value="2024-09">Сентябрь 2024</option>
        </select>
        
        <div className="flex gap-2">
          <Button 
            variant={dateRange === 'month' ? 'default' : 'outline'}
            onClick={() => setDateRange('month')}
            size="sm"
          >
            Месяц
          </Button>
          <Button 
            variant={dateRange === 'quarter' ? 'default' : 'outline'}
            onClick={() => setDateRange('quarter')}
            size="sm"
          >
            Квартал
          </Button>
          <Button 
            variant={dateRange === 'year' ? 'default' : 'outline'}
            onClick={() => setDateRange('year')}
            size="sm"
          >
            Год
          </Button>
        </div>
      </div>
      
      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Общий брутто</span>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${reportData.totalGross.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">
              <ArrowUp className="w-3 h-3 inline text-green-500" /> +12.5% к прошлому месяцу
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Общий нетто</span>
              <DollarSign className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${reportData.totalNet.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">
              После вычета расходов
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Расходы</span>
              <ArrowDown className="w-4 h-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${reportData.totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">
              {((reportData.totalExpenses / reportData.totalGross) * 100).toFixed(1)}% от брутто
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Транзакции</span>
              <BarChart3 className="w-4 h-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.transactionCount}</div>
            <p className="text-xs text-gray-500 mt-1">
              {reportData.employeeCount} сотрудников
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* График топ сотрудников */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Топ сотрудники по брутто
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="gross" fill="#8884d8" name="Брутто ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Круговая диаграмма казино */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Распределение по казино
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Таблица топ сотрудников */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Детальная статистика по сотрудникам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Сотрудник</th>
                  <th className="text-right py-2 px-3">Транзакций</th>
                  <th className="text-right py-2 px-3">Брутто</th>
                  <th className="text-right py-2 px-3">Средний чек</th>
                  <th className="text-right py-2 px-3">% от общего</th>
                </tr>
              </thead>
              <tbody>
                {reportData.topEmployees.map((employee, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{index + 1}</td>
                    <td className="py-2 px-3 font-medium">{employee.username}</td>
                    <td className="py-2 px-3 text-right">{employee.transactions}</td>
                    <td className="py-2 px-3 text-right font-bold">${employee.gross.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right">
                      ${(employee.gross / employee.transactions).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {((employee.gross / reportData.totalGross) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t-2">
                  <td colSpan={2} className="py-2 px-3">Итого</td>
                  <td className="py-2 px-3 text-right">
                    {reportData.topEmployees.reduce((sum, e) => sum + e.transactions, 0)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    ${reportData.topEmployees.reduce((sum, e) => sum + e.gross, 0).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right">-</td>
                  <td className="py-2 px-3 text-right">
                    {((reportData.topEmployees.reduce((sum, e) => sum + e.gross, 0) / reportData.totalGross) * 100).toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Таблица казино */}
      <Card>
        <CardHeader>
          <CardTitle>Статистика по казино</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">#</th>
                  <th className="text-left py-2 px-3">Казино</th>
                  <th className="text-right py-2 px-3">Транзакций</th>
                  <th className="text-right py-2 px-3">Брутто</th>
                  <th className="text-right py-2 px-3">Средний чек</th>
                  <th className="text-right py-2 px-3">% от общего</th>
                </tr>
              </thead>
              <tbody>
                {reportData.casinoStats.map((casino, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{index + 1}</td>
                    <td className="py-2 px-3 font-medium">{casino.name}</td>
                    <td className="py-2 px-3 text-right">{casino.transactions}</td>
                    <td className="py-2 px-3 text-right font-bold">${casino.gross.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right">
                      ${(casino.gross / casino.transactions).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {((casino.gross / reportData.totalGross) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Стили для печати */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
