'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Clock, 
  Target, 
  Zap, 
  Trophy,
  TrendingUp,
  Star,
  Fire,
  Rocket
} from 'lucide-react'

interface MotivationalTimerProps {
  userStats?: {
    totalGross: number
    rank: number
    salary?: {
      total_salary: number
      bonus: number
      leader_bonus: number
    }
  }
}

function getMonthStage(): 'start' | 'middle' | 'end' {
  const now = new Date()
  const day = now.getDate()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  
  if (day <= 10) return 'start'
  if (day >= lastDay - 5) return 'end'
  return 'middle'
}

function getDaysUntilMonthEnd(): number {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const diffTime = lastDay.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function getMotivationalMessage(stage: 'start' | 'middle' | 'end', userStats?: any): {
  title: string
  message: string
  emoji: string
  color: string
  icon: React.ReactNode
} {
  const rank = userStats?.rank || 99
  const totalGross = userStats?.totalGross || 0
  
  switch (stage) {
    case 'start':
      return {
        title: "🚀 Новый месяц начался!",
        message: "Время показать на что ты способен! В этом месяце ты можешь стать лидером команды!",
        emoji: "🎯",
        color: "from-blue-600 to-purple-600",
        icon: <Rocket className="w-6 h-6" />
      }
      
    case 'middle':
      if (rank <= 3) {
        return {
          title: "🔥 Ты в топе!",
          message: `Отличная работа! Ты на ${rank} месте. Поднажми и будешь первым!`,
          emoji: "⚡",
          color: "from-yellow-600 to-orange-600",
          icon: <Fire className="w-6 h-6" />
        }
      } else if (totalGross >= 1000) {
        return {
          title: "💪 Хорошо идешь!",
          message: "Продолжай в том же духе! Ты можешь подняться в рейтинге!",
          emoji: "📈",
          color: "from-green-600 to-teal-600",
          icon: <TrendingUp className="w-6 h-6" />
        }
      } else {
        return {
          title: "⚡ Время ускориться!",
          message: "Середина месяца - самое время показать результат! Поднажми!",
          emoji: "🎯",
          color: "from-orange-600 to-red-600",
          icon: <Zap className="w-6 h-6" />
        }
      }
      
    case 'end':
      return {
        title: "🏁 Финишная прямая!",
        message: "Последние дни месяца! Каждая транзакция на счету! Покажи максимум!",
        emoji: "🔥",
        color: "from-red-600 to-pink-600",
        icon: <Trophy className="w-6 h-6" />
      }
  }
}

export default function MotivationalTimer({ userStats }: MotivationalTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  const [stage, setStage] = useState<'start' | 'middle' | 'end'>('start')

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      lastDayOfMonth.setHours(23, 59, 59, 999) // Конец последнего дня месяца
      
      const diffTime = lastDayOfMonth.getTime() - now.getTime()
      
      if (diffTime > 0) {
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diffTime % (1000 * 60)) / 1000)
        
        setTimeLeft({ days, hours, minutes, seconds })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
      
      setStage(getMonthStage())
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [])

  const motivation = getMotivationalMessage(stage, userStats)

  return (
    <Card className={`bg-gradient-to-r ${motivation.color} border-none mb-8 shadow-xl`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          {motivation.icon}
          {motivation.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-4">
            {motivation.message}
          </div>
          
          {/* Countdown Timer */}
          <div className="bg-black/20 rounded-lg p-6 mb-4">
            <p className="text-lg text-white/90 mb-3">
              ⏰ До выплаты зарплаты осталось:
            </p>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {timeLeft.days}
                </div>
                <div className="text-sm text-white/70">дней</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {timeLeft.hours}
                </div>
                <div className="text-sm text-white/70">часов</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {timeLeft.minutes}
                </div>
                <div className="text-sm text-white/70">минут</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {timeLeft.seconds}
                </div>
                <div className="text-sm text-white/70">секунд</div>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="bg-black/20 rounded-lg p-4">
            <div className="flex justify-between text-sm text-white/90 mb-2">
              <span>Прогресс месяца</span>
              <span>{Math.round((1 - getDaysUntilMonthEnd() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100)}%</span>
            </div>
            <div className="w-full bg-black/30 rounded-full h-3">
              <div 
                className="bg-white h-3 rounded-full transition-all duration-1000"
                style={{ 
                  width: `${Math.round((1 - getDaysUntilMonthEnd() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100)}%` 
                }}
              />
            </div>
          </div>
          
          {/* Stage-specific motivation */}
          {stage === 'end' && timeLeft.days <= 3 && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
              <div className="text-yellow-400 font-bold text-lg animate-pulse">
                ⚠️ ПОСЛЕДНИЕ ДНИ! ВРЕМЯ НА ИСХОДЕ! ⚠️
              </div>
            </div>
          )}
          
          {stage === 'middle' && userStats?.rank && userStats.rank <= 5 && (
            <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
              <div className="text-yellow-400 font-bold">
                🎯 Ты близко к победе! Еще немного и ты будешь первым!
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
