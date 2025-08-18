import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Employee Tracking System
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Система учета работы сотрудников
        </p>
        <div className="space-y-4">
          <Link href="/dashboard">
            <Button size="lg" className="w-full">
              Открыть дашборд
            </Button>
          </Link>
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              ✅ Проект успешно развернут на Vercel
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
