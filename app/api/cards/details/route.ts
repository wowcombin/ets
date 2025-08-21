import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

// ID таблицы с картами
const CARDS_SHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'

function getCurrentMonthName(): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[new Date().getMonth()]
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

    console.log(`Getting card details for month: ${currentMonth}`)

    // Получаем данные карт из Google Sheets
    const cardResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: CARDS_SHEET_ID,
      range: `${currentMonth}!A:Z`, // Читаем весь лист
    })

    const cardRows = cardResponse.data.values || []
    console.log(`Found ${cardRows.length} rows in cards sheet`)

    if (cardRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Лист "${currentMonth}" не найден в таблице карт`
      })
    }

    // Парсим заголовки
    const headers = cardRows[0] || []
    const cardsWithDetails = []

    // Обрабатываем каждую строку
    for (let i = 1; i < cardRows.length; i++) {
      const row = cardRows[i] || []
      if (row.length === 0) continue

      // Создаем объект карты
      const cardInfo: any = {}
      headers.forEach((header, index) => {
        cardInfo[header] = row[index] || ''
      })

      // Извлекаем стандартные поля (адаптируемся к разным форматам)
      const cardNumber = (
        cardInfo['Card Number'] || 
        cardInfo['Номер карты'] || 
        cardInfo['Card'] ||
        cardInfo['A'] || 
        row[0] || 
        ''
      ).toString().replace(/\s+/g, '')

      const expiryDate = 
        cardInfo['Expiry'] || 
        cardInfo['Exp'] || 
        cardInfo['Срок'] || 
        cardInfo['B'] || 
        row[1] || 
        ''

      const cvv = 
        cardInfo['CVV'] || 
        cardInfo['CVC'] || 
        cardInfo['C'] || 
        row[2] || 
        ''

      const bankName = 
        cardInfo['Bank'] || 
        cardInfo['Банк'] || 
        cardInfo['Bank Name'] ||
        cardInfo['D'] || 
        row[3] || 
        ''

      // Ищем колонки с названиями казино (обычно начинаются с E, F, G и т.д.)
      const casinoColumns: Record<string, any> = {}
      headers.forEach((header, index) => {
        if (index >= 4 && header && header.trim()) { // Пропускаем первые 4 колонки (номер, срок, cvv, банк)
          const cellValue = row[index] || ''
          casinoColumns[header] = cellValue
        }
      })

      if (cardNumber) {
        cardsWithDetails.push({
          cardNumber,
          expiryDate,
          cvv,
          bankName,
          casinoColumns,
          availableForCasinos: Object.keys(casinoColumns).filter(casino => 
            !casinoColumns[casino] || casinoColumns[casino].toString().trim() === ''
          ),
          usedInCasinos: Object.keys(casinoColumns).filter(casino => 
            casinoColumns[casino] && casinoColumns[casino].toString().trim() !== ''
          ),
          rowIndex: i,
          allHeaders: headers,
          rawRow: row
        })
      }
    }

    // Получаем транзакции для сравнения
    const monthCode = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', monthCode)

    // Анализируем использование карт
    const cardAnalysis = cardsWithDetails.map(card => {
      // Ищем транзакции с этой картой
      const cardTransactions = transactions?.filter(t => 
        t.card_number && t.card_number.replace(/\s+/g, '') === card.cardNumber
      ) || []

      // Определяем статус по транзакциям
      const isUsedInTransactions = cardTransactions.length > 0
      const hasSuccessfulDeposit = cardTransactions.some(t => t.deposit_usd > 0)

      return {
        ...card,
        transactionCount: cardTransactions.length,
        isUsedInTransactions,
        hasSuccessfulDeposit,
        transactions: cardTransactions.map(t => ({
          employee: t.employee?.username,
          casino: t.casino_name,
          deposit: t.deposit_usd,
          withdrawal: t.withdrawal_usd,
          profit: t.gross_profit_usd
        })),
        status: isUsedInTransactions ? 'used' : 
                card.usedInCasinos.length > 0 ? 'assigned' : 'free'
      }
    })

    // Группируем по казино
    const casinoGroups: Record<string, any> = {}
    
    cardAnalysis.forEach(card => {
      // Для каждого казино в котором карта доступна
      card.availableForCasinos.forEach(casino => {
        if (!casinoGroups[casino]) {
          casinoGroups[casino] = {
            casinoName: casino,
            availableCards: [],
            totalAvailable: 0
          }
        }
        casinoGroups[casino].availableCards.push(card)
        casinoGroups[casino].totalAvailable++
      })
    })

    // Статистика
    const stats = {
      totalCards: cardAnalysis.length,
      freeCards: cardAnalysis.filter(c => c.status === 'free').length,
      assignedCards: cardAnalysis.filter(c => c.status === 'assigned').length,
      usedCards: cardAnalysis.filter(c => c.status === 'used').length,
      cardsWithSuccessfulDeposit: cardAnalysis.filter(c => c.hasSuccessfulDeposit).length,
      uniqueCasinos: Object.keys(casinoGroups).length
    }

    return NextResponse.json({
      success: true,
      month: currentMonth,
      stats,
      cards: cardAnalysis,
      casinoGroups: Object.values(casinoGroups),
      availableHeaders: headers,
      debug: {
        totalRowsProcessed: cardRows.length,
        cardsFound: cardsWithDetails.length,
        sampleCard: cardsWithDetails[0] || null
      }
    })

  } catch (error: any) {
    console.error('Card details error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
