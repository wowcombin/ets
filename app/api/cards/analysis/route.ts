import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

// ID таблицы с картами themes
const THEMES_SHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'

function getCurrentMonthName(): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[new Date().getMonth()]
}

function getCurrentMonthCode(): string {
  const year = new Date().getFullYear()
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const supabase = getServiceSupabase()
    const currentMonth = getCurrentMonthName()
    const monthCode = getCurrentMonthCode()

    console.log(`Analyzing cards for month: ${currentMonth}`)

    // Получаем данные themes из Google Sheets
    const themesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: THEMES_SHEET_ID,
      range: `themes!A:Z`, // Читаем лист themes
    })

    const cardRows = themesResponse.data.values || []
    console.log(`Found ${cardRows.length} rows in themes sheet`)

    if (cardRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Лист "themes" не найден или пуст в таблице`
      })
    }

    // Парсим заголовки (первая строка)
    const headers = cardRows[0] || []
    const cardData = []
    
    // Обрабатываем каждую строку карт
    for (let i = 1; i < cardRows.length; i++) {
      const row = cardRows[i] || []
      if (row.length === 0) continue

      const cardInfo: any = {}
      headers.forEach((header, index) => {
        cardInfo[header] = row[index] || ''
      })

      // Извлекаем основную информацию о карте
      const cardNumber = cardInfo['Card Number'] || cardInfo['Номер карты'] || cardInfo['A'] || ''
      const expiryDate = cardInfo['Expiry'] || cardInfo['Срок'] || cardInfo['B'] || ''
      const cvv = cardInfo['CVV'] || cardInfo['C'] || ''
      const bankName = cardInfo['Bank'] || cardInfo['Банк'] || cardInfo['D'] || ''
      
      if (cardNumber) {
        cardData.push({
          cardNumber: cardNumber.toString().replace(/\s+/g, ''),
          expiryDate,
          cvv,
          bankName,
          rawData: cardInfo,
          rowIndex: i
        })
      }
    }

    console.log(`Parsed ${cardData.length} cards from themes sheet`)

    // Получаем транзакции сотрудников за текущий месяц
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', monthCode)

    // Получаем данные карт из нашей БД
    const { data: dbCards } = await supabase
      .from('cards')
      .select('*')

    // Анализируем использование карт
    const cardAnalysis = cardData.map(card => {
      // Ищем транзакции с этой картой
      const cardTransactions = transactions?.filter(t => 
        t.card_number && t.card_number.replace(/\s+/g, '') === card.cardNumber
      ) || []

      // Ищем карту в нашей БД
      const dbCard = dbCards?.find(c => 
        c.card_number && c.card_number.replace(/\s+/g, '') === card.cardNumber
      )

      // Определяем статус карты
      let status = 'free' // свободная
      let assignedTo = null
      let assignedCasino = null
      let depositAmount = null
      let hasDeposit = false

      if (cardTransactions.length > 0) {
        status = 'used' // использована
        const transaction = cardTransactions[0]
        assignedTo = transaction.employee?.username
        assignedCasino = transaction.casino_name
        depositAmount = transaction.deposit_usd
        hasDeposit = depositAmount > 0
      } else if (dbCard && dbCard.status === 'assigned') {
        status = 'assigned' // назначена но не использована
        assignedCasino = dbCard.casino_name
      }

      // Проверяем есть ли депозит в themes таблице
      const themesDeposit = Object.values(card.rawData).find(val => 
        val && !isNaN(Number(val)) && Number(val) >= 0
      )
      
      const hasThemesDeposit = themesDeposit !== undefined && themesDeposit !== ''

      return {
        cardNumber: card.cardNumber,
        expiryDate: card.expiryDate,
        cvv: card.cvv,
        bankName: card.bankName,
        status,
        assignedTo,
        assignedCasino,
        depositAmount,
        hasDeposit,
        hasThemesDeposit,
        themesDeposit: hasThemesDeposit ? Number(themesDeposit) : null,
        transactionCount: cardTransactions.length,
        dbCard: dbCard ? {
          id: dbCard.id,
          status: dbCard.status,
          casino_name: dbCard.casino_name
        } : null
      }
    })

    // Статистика по картам
    const stats = {
      totalCards: cardAnalysis.length,
      freeCards: cardAnalysis.filter(c => c.status === 'free').length,
      assignedCards: cardAnalysis.filter(c => c.status === 'assigned').length,
      usedCards: cardAnalysis.filter(c => c.status === 'used').length,
      cardsWithDeposit: cardAnalysis.filter(c => c.hasDeposit).length,
      cardsWithThemesDeposit: cardAnalysis.filter(c => c.hasThemesDeposit).length,
      zeroDepositCards: cardAnalysis.filter(c => c.hasThemesDeposit && c.themesDeposit === 0).length
    }

    // Статистика по сотрудникам
    const employeeStats: Record<string, any> = {}
    
    cardAnalysis.forEach(card => {
      if (card.assignedTo) {
        if (!employeeStats[card.assignedTo]) {
          employeeStats[card.assignedTo] = {
            username: card.assignedTo,
            totalCards: 0,
            cardsWithDeposit: 0,
            cardsWithZeroDeposit: 0,
            successRate: 0,
            casinos: new Set()
          }
        }
        
        const empStat = employeeStats[card.assignedTo]
        empStat.totalCards++
        
        if (card.hasDeposit && card.depositAmount > 0) {
          empStat.cardsWithDeposit++
        } else if (card.hasThemesDeposit && card.themesDeposit === 0) {
          empStat.cardsWithZeroDeposit++
        }
        
        if (card.assignedCasino) {
          empStat.casinos.add(card.assignedCasino)
        }
        
        empStat.successRate = empStat.totalCards > 0 
          ? (empStat.cardsWithDeposit / empStat.totalCards) * 100 
          : 0
      }
    })

    // Конвертируем Set в array для JSON
    Object.values(employeeStats).forEach((stat: any) => {
      stat.casinos = Array.from(stat.casinos)
    })

    // Статистика по казино
    const casinoStats: Record<string, any> = {}
    
    cardAnalysis.forEach(card => {
      if (card.assignedCasino) {
        if (!casinoStats[card.assignedCasino]) {
          casinoStats[card.assignedCasino] = {
            casinoName: card.assignedCasino,
            totalCards: 0,
            freeCards: 0,
            assignedCards: 0,
            usedCards: 0,
            cardsWithDeposit: 0,
            availableCards: []
          }
        }
        
        const casinoStat = casinoStats[card.assignedCasino]
        casinoStat.totalCards++
        
        if (card.status === 'free') {
          casinoStat.freeCards++
          casinoStat.availableCards.push({
            cardNumber: card.cardNumber,
            expiryDate: card.expiryDate,
            cvv: card.cvv,
            bankName: card.bankName
          })
        } else if (card.status === 'assigned') {
          casinoStat.assignedCards++
        } else if (card.status === 'used') {
          casinoStat.usedCards++
          if (card.hasDeposit) {
            casinoStat.cardsWithDeposit++
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      month: currentMonth,
      monthCode,
      stats,
      cards: cardAnalysis,
      employeeStats: Object.values(employeeStats),
      casinoStats: Object.values(casinoStats),
      freeCards: cardAnalysis.filter(c => c.status === 'free'),
      debug: {
        totalRowsInSheet: cardRows.length,
        headers,
        sampleCard: cardData[0] || null
      }
    })

  } catch (error: any) {
    console.error('Card analysis error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
