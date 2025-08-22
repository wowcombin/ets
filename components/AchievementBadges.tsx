'use client'

import React from 'react'
import { 
  Trophy, 
  Target, 
  Star, 
  Zap,
  Crown,
  Medal,
  Award,
  TrendingUp,
  DollarSign
} from 'lucide-react'

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  progress?: number
  unlocked: boolean
}

interface AchievementBadgesProps {
  userStats?: {
    id?: string
    username?: string
    totalGross: number
    rank: number
    transactionCount?: number
    casinoCount?: number
    salary?: {
      base_salary?: number
      bonus: number
      leader_bonus: number
      total_salary: number
      is_paid?: boolean
    } | null
  }
}

export default function AchievementBadges({ userStats }: AchievementBadgesProps) {
  if (!userStats) return null

  const achievements: Achievement[] = [
    {
      id: 'first_steps',
      title: 'Первые шаги',
      description: 'Совершить первую транзакцию',
      icon: <Star className="w-5 h-5" />,
      color: 'bg-blue-600',
      unlocked: (userStats.transactionCount || 0) > 0
    },
    {
      id: 'hundred_club',
      title: 'Клуб $100',
      description: 'Заработать $100+ профита',
      icon: <DollarSign className="w-5 h-5" />,
      color: 'bg-green-600',
      unlocked: userStats.totalGross >= 100
    },
    {
      id: 'thousand_club',
      title: 'Клуб $1000',
      description: 'Заработать $1000+ профита',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-purple-600',
      unlocked: userStats.totalGross >= 1000
    },
    {
      id: 'plan_achiever',
      title: 'Выполнил план',
      description: 'Заработать $2000+ и получить бонус',
      icon: <Target className="w-5 h-5" />,
      color: 'bg-emerald-600',
      unlocked: userStats.totalGross >= 2000
    },
    {
      id: 'casino_master',
      title: 'Мастер казино',
      description: 'Работать в 10+ казино',
      icon: <Zap className="w-5 h-5" />,
      color: 'bg-orange-600',
      unlocked: (userStats.casinoCount || 0) >= 10
    },
    {
      id: 'top_three',
      title: 'Топ-3',
      description: 'Войти в тройку лидеров',
      icon: <Award className="w-5 h-5" />,
      color: 'bg-yellow-600',
      unlocked: userStats.rank <= 3
    },
    {
      id: 'runner_up',
      title: 'Серебро',
      description: 'Занять 2 место в рейтинге',
      icon: <Medal className="w-5 h-5" />,
      color: 'bg-gray-500',
      unlocked: userStats.rank === 2 && userStats.rank !== 1
    },
    {
      id: 'month_leader',
      title: 'Лидер месяца',
      description: 'Стать #1 и получить бонус лидера',
      icon: <Crown className="w-5 h-5" />,
      color: 'bg-yellow-500',
      unlocked: userStats.rank === 1 && (userStats.salary?.leader_bonus || 0) > 0
    }
  ]

  const unlockedAchievements = achievements.filter(a => a.unlocked)
  const nextAchievement = userStats.rank === 1 ? null : achievements.find(a => !a.unlocked)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Unlocked Achievements */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Ваши достижения ({unlockedAchievements.length})
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {unlockedAchievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`${achievement.color} rounded-lg p-3 text-white text-center`}
            >
              <div className="flex justify-center mb-2">
                {achievement.icon}
              </div>
              <div className="text-sm font-medium">{achievement.title}</div>
              <div className="text-xs opacity-90">{achievement.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Achievement */}
      {nextAchievement && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            Следующая цель
          </h3>
          <div className="bg-gray-700/50 rounded-lg p-4 border-2 border-dashed border-gray-600">
            <div className="text-center">
              <div className="flex justify-center mb-3 opacity-50">
                {nextAchievement.icon}
              </div>
              <div className="text-lg font-bold text-white mb-2">
                {nextAchievement.title}
              </div>
              <div className="text-sm text-gray-400 mb-3">
                {nextAchievement.description}
              </div>
              
              {/* Progress for specific achievements */}
              {nextAchievement.id === 'plan_achiever' && userStats.totalGross < 2000 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Прогресс до плана</span>
                    <span>{((userStats.totalGross / 2000) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((userStats.totalGross / 2000) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-blue-400 mt-1">
                    Осталось: ${(2000 - userStats.totalGross).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
