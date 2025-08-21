import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

// ID таблицы с картами
const CARDS_SHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'

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
    const monthCode = getCurrentMonthCode()

    console.log(`Getting Revo UK cards data`)

    // Получаем данные карт из листа "Revo UK"
    const cardResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: CARDS_SHEET_ID,
      range: `Revo UK!A:Z`, // Читаем лист Revo UK
    })

    const cardRows = cardResponse.data.values || []
    console.log(`Found ${cardRows.length} rows in Revo UK sheet`)

    if (cardRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Лист "Revo UK" не найден или пуст'
      })
    }

    // Парсим заголовки (первая строка)
    const headers = cardRows[0] || []
    const cardsData = []

    // Обрабатываем каждую строку карт
    for (let i = 1; i < cardRows.length; i++) {
      const row = cardRows[i] || []
      if (row.length === 0) continue

      // Проверяем что это строка с картой (не заголовок типа "Benjamin Bradbury")
      const firstCell = row[0] || ''
      
      // Если первая ячейка содержит только цифры - это номер карты
      if (/^\d+$/.test(firstCell.toString().replace(/\s+/g, ''))) {
        const cardNumber = firstCell.toString().replace(/\s+/g, '')
        const expiryDate = row[1] || ''
        const cvv = row[2] || ''
        const address = row[3] || ''
        
        // Определяем к какому владельцу относится карта
        let cardOwner = ''
        for (let j = i - 1; j >= 1; j--) {
          const prevRow = cardRows[j] || []
          const prevFirstCell = prevRow[0] || ''
          
          // Если нашли строку с именем (не цифры)
          if (prevFirstCell && !/^\d+$/.test(prevFirstCell.toString().replace(/\s+/g, ''))) {
            cardOwner = prevFirstCell.toString()
            break
          }
        }

        // Проверяем статус по остальным колонкам (E, F, G и т.д.)
        const statusColumns: Record<string, any> = {}
        for (let colIndex = 4; colIndex < row.length && colIndex < headers.length; colIndex++) {
          const headerName = headers[colIndex] || `Column_${colIndex}`
          const cellValue = row[colIndex] || ''
          statusColumns[headerName] = cellValue
        }

        cardsData.push({
          cardNumber,
          expiryDate,
          cvv,
          address,
          cardOwner,
          statusColumns,
          rowIndex: i,
          isAssigned: Object.values(statusColumns).some(val => val && val.toString().trim() !== ''),
          assignedCasinos: Object.keys(statusColumns).filter(casino => 
            statusColumns[casino] && statusColumns[casino].toString().trim() !== ''
          )
        })
      }
    }

    console.log(`Parsed ${cardsData.length} cards from Revo UK sheet`)

    // Получаем транзакции для сравнения
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, employee:employees(username)')
      .eq('month', monthCode)

    // Анализируем каждую карту
    const cardAnalysis = cardsData.map(card => {
      // Ищем транзакции с этой картой
      const cardTransactions = transactions?.filter(t => 
        t.card_number && t.card_number.replace(/\s+/g, '') === card.cardNumber
      ) || []

      // Определяем статус карты
      let status = 'available' // доступна
      let usedBy = null
      let depositStatus = 'waiting' // ожидает депозита
      
      if (cardTransactions.length > 0) {
        status = 'used'
        usedBy = cardTransactions[0].employee?.username
        const hasDeposit = cardTransactions.some(t => t.deposit_usd > 0)
        depositStatus = hasDeposit ? 'deposited' : 'zero_deposit'
      } else if (card.isAssigned) {
        status = 'assigned'
        depositStatus = 'assigned_waiting'
      }

      return {
        ...card,
        status,
        usedBy,
        depositStatus,
        transactionCount: cardTransactions.length,
        totalDeposit: cardTransactions.reduce((sum, t) => sum + (t.deposit_usd || 0), 0),
        totalProfit: cardTransactions.reduce((sum, t) => sum + (t.gross_profit_usd || 0), 0),
        transactions: cardTransactions.map(t => ({
          employee: t.employee?.username,
          casino: t.casino_name,
          deposit: t.deposit_usd,
          profit: t.gross_profit_usd
        }))
      }
    })

    // Группируем по владельцам карт
    const ownerGroups: Record<string, any> = {}
    cardAnalysis.forEach(card => {
      if (!ownerGroups[card.cardOwner]) {
        ownerGroups[card.cardOwner] = {
          ownerName: card.cardOwner,
          cards: [],
          stats: {
            total: 0,
            available: 0,
            assigned: 0,
            used: 0,
            withDeposit: 0,
            zeroDeposit: 0
          }
        }
      }
      
      const group = ownerGroups[card.cardOwner]
      group.cards.push(card)
      group.stats.total++
      
      if (card.status === 'available') group.stats.available++
      else if (card.status === 'assigned') group.stats.assigned++
      else if (card.status === 'used') {
        group.stats.used++
        if (card.totalDeposit > 0) group.stats.withDeposit++
        else group.stats.zeroDeposit++
      }
    })

    // Общая статистика
    const stats = {
      totalCards: cardAnalysis.length,
      availableCards: cardAnalysis.filter(c => c.status === 'available').length,
      assignedCards: cardAnalysis.filter(c => c.status === 'assigned').length,
      usedCards: cardAnalysis.filter(c => c.status === 'used').length,
      cardsWithDeposit: cardAnalysis.filter(c => c.totalDeposit > 0).length,
      cardsWithZeroDeposit: cardAnalysis.filter(c => c.status === 'used' && c.totalDeposit === 0).length,
      uniqueOwners: Object.keys(ownerGroups).length,
      successRate: cardAnalysis.filter(c => c.status === 'used').length > 0 
        ? (cardAnalysis.filter(c => c.totalDeposit > 0).length / cardAnalysis.filter(c => c.status === 'used').length) * 100 
        : 0
    }

    return NextResponse.json({
      success: true,
      stats,
      cards: cardAnalysis,
      ownerGroups: Object.values(ownerGroups),
      availableCards: cardAnalysis.filter(c => c.status === 'available'),
      headers,
      debug: {
        totalRowsProcessed: cardRows.length,
        cardsFound: cardsData.length,
        sampleCard: cardsData[0] || null
      }
    })

  } catch (error: any) {
    console.error('Revo UK cards error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
