import { google } from 'googleapis'

// Константы
const JUNIOR_FOLDER_ID = '1FEtrBtiv5ZpxV4C9paFzKf8aQuNdwRdu'
const TEST_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'
const EXPENSES_SPREADSHEET_ID = '19LmZTOzZoX8eMhGPazMl9g_VPmOZ3YwMURWqcrvKkAU'
const CARDS_SPREADSHEET_ID = '1qmT_Yg09BFpD6UKZz7LFs1SXGPtQYjzNlZ-tytsr3is'
const THEMES_SPREADSHEET_ID = '1i0IbJgxn7WwNH7T7VmOKz_xkH0GMfyGgpKKJqEmQqvA'

const GBP_TO_USD_RATE = parseFloat(process.env.GBP_TO_USD_RATE || '1.3')

// Типы данных
export interface EmployeeData {
  username: string
  folderId: string
  transactions: Transaction[]
}

export interface Transaction {
  casino: string
  depositGbp: number
  withdrawalGbp: number
  cardNumber: string
  depositUsd: number
  withdrawalUsd: number
  grossProfit: number
  netProfit: number
}

export interface MonthlyExpense {
  month: string
  amountUsd: number
  description?: string
}

export interface Card {
  number: string
  status: 'available' | 'assigned' | 'used'
  assignedTo?: string
  casino?: string
}

// Получаем авторизованный клиент Google
export async function getGoogleAuth() {
  // Для серверного использования с Service Account
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    })
    return auth
  }

  // Для OAuth2 (если используется)
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  // Здесь нужно будет добавить логику получения токена
  // Пока используем заглушку
  return oauth2Client
}

// Получаем текущий месяц в формате "August" или "December"
export function getCurrentMonthName(): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[new Date().getMonth()]
}

// Получаем текущий месяц в формате "2024-08"
export function getCurrentMonthCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

// Парсим значение из ячейки таблицы
function parseNumberValue(value: any): number {
  if (!value) return 0
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

// Извлекаем только цифры из номера карты
function extractCardNumber(value: any): string {
  if (!value) return ''
  return String(value).replace(/[^0-9]/g, '')
}

// Получаем список папок сотрудников из JUNIOR папки
export async function getEmployeeFolders() {
  try {
    const auth = await getGoogleAuth()
    const drive = google.drive({ version: 'v3', auth })

    const response = await drive.files.list({
      q: `'${JUNIOR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '@'`,
      fields: 'files(id, name)',
      orderBy: 'name',
    })

    return response.data.files || []
  } catch (error) {
    console.error('Error getting employee folders:', error)
    throw error
  }
}

// Находим таблицу WORK в папке сотрудника
export async function findWorkSpreadsheet(folderId: string, username: string) {
  try {
    const auth = await getGoogleAuth()
    const drive = google.drive({ version: 'v3', auth })

    // Ищем файл с названием "WORK @username"
    const searchName = `WORK ${username}`
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'WORK'`,
      fields: 'files(id, name)',
    })

    const files = response.data.files || []
    
    // Находим файл, который содержит username в названии
    const workFile = files.find(file => 
      file.name?.includes(username.replace('@', '')) || 
      file.name?.toLowerCase().includes('work')
    )

    return workFile
  } catch (error) {
    console.error('Error finding work spreadsheet:', error)
    throw error
  }
}

// Читаем данные из таблицы сотрудника
export async function readEmployeeTransactions(spreadsheetId: string, month: string = getCurrentMonthName()) {
  try {
    const auth = await getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Читаем данные с листа текущего месяца
    const range = `${month}!A2:D` // Начинаем со второй строки (первая - заголовки)
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    const rows = response.data.values || []
    const transactions: Transaction[] = []

    for (const row of rows) {
      if (row[0]) { // Если есть название казино
        const depositGbp = parseNumberValue(row[1])
        const withdrawalGbp = parseNumberValue(row[2])
        const cardNumber = extractCardNumber(row[3])

        const depositUsd = depositGbp * GBP_TO_USD_RATE
        const withdrawalUsd = withdrawalGbp * GBP_TO_USD_RATE
        const grossProfit = withdrawalUsd - depositUsd

        transactions.push({
          casino: String(row[0]),
          depositGbp,
          withdrawalGbp,
          cardNumber,
          depositUsd,
          withdrawalUsd,
          grossProfit,
          netProfit: grossProfit, // Позже вычтем расходы
        })
      }
    }

    return transactions
  } catch (error) {
    console.error('Error reading employee transactions:', error)
    return []
  }
}

// Читаем тестовые транзакции @sobroffice
export async function readTestTransactions(month: string = getCurrentMonthName()) {
  return readEmployeeTransactions(TEST_SPREADSHEET_ID, month)
}

// Читаем расходы за месяц
export async function readMonthlyExpenses(month: string = getCurrentMonthName()) {
  try {
    const auth = await getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Формируем название листа: "August Spending"
    const sheetName = `${month} Spending`
    const range = `${sheetName}!B2:B` // Столбец B, начиная со второй строки

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: EXPENSES_SPREADSHEET_ID,
      range,
    })

    const rows = response.data.values || []
    let totalExpenses = 0

    for (const row of rows) {
      if (row[0]) {
        totalExpenses += parseNumberValue(row[0])
      }
    }

    return totalExpenses
  } catch (error) {
    console.error('Error reading monthly expenses:', error)
    return 0
  }
}

// Читаем список всех карт
export async function readAllCards() {
  try {
    const auth = await getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    const range = 'REVO UK!A2:A' // Столбец A, начиная со второй строки

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CARDS_SPREADSHEET_ID,
      range,
    })

    const rows = response.data.values || []
    const cards: string[] = []

    for (const row of rows) {
      if (row[0]) {
        const cardNumber = extractCardNumber(row[0])
        if (cardNumber) {
          cards.push(cardNumber)
        }
      }
    }

    return cards
  } catch (error) {
    console.error('Error reading cards:', error)
    return []
  }
}

// Читаем статус карт за месяц (какие казино и карты)
export async function readCardThemes(month: string = getCurrentMonthName()) {
  try {
    const auth = await getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // Формируем название листа: "August themes"
    const sheetName = `${month} themes`
    const range = `${sheetName}!A2:Z` // Все данные, начиная со второй строки

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: THEMES_SPREADSHEET_ID,
      range,
    })

    const rows = response.data.values || []
    const casinoCards: Map<string, string[]> = new Map()

    // Первая строка - казино, остальные колонки - карты
    for (const row of rows) {
      if (row[0]) {
        const casino = String(row[0])
        const cards: string[] = []
        
        // Собираем все карты для этого казино (начиная с колонки B)
        for (let i = 1; i < row.length; i++) {
          if (row[i]) {
            const cardNumber = extractCardNumber(row[i])
            if (cardNumber) {
              cards.push(cardNumber)
            }
          }
        }
        
        casinoCards.set(casino, cards)
      }
    }

    return casinoCards
  } catch (error) {
    console.error('Error reading card themes:', error)
    return new Map()
  }
}

// Главная функция для сбора всех данных
export async function collectAllEmployeeData(month: string = getCurrentMonthName()) {
  try {
    console.log(`Collecting data for month: ${month}`)

    // 1. Получаем все папки сотрудников
    const folders = await getEmployeeFolders()
    console.log(`Found ${folders.length} employee folders`)

    const allEmployeeData: EmployeeData[] = []

    // 2. Для каждого сотрудника читаем его транзакции
    for (const folder of folders) {
      if (folder.id && folder.name) {
        const username = folder.name // например "@mr_e500"
        console.log(`Processing employee: ${username}`)

        // Находим таблицу WORK в папке сотрудника
        const workFile = await findWorkSpreadsheet(folder.id, username)
        
        if (workFile?.id) {
          const transactions = await readEmployeeTransactions(workFile.id, month)
          
          allEmployeeData.push({
            username,
            folderId: folder.id,
            transactions,
          })

          console.log(`Found ${transactions.length} transactions for ${username}`)
        }
      }
    }

    // 3. Добавляем тестовые транзакции @sobroffice
    const testTransactions = await readTestTransactions(month)
    allEmployeeData.push({
      username: '@sobroffice',
      folderId: 'test',
      transactions: testTransactions,
    })

    // 4. Читаем расходы за месяц
    const monthlyExpenses = await readMonthlyExpenses(month)
    console.log(`Total expenses for ${month}: $${monthlyExpenses}`)

    // 5. Читаем все карты
    const allCards = await readAllCards()
    console.log(`Found ${allCards.length} cards total`)

    // 6. Читаем статусы карт
    const cardThemes = await readCardThemes(month)
    console.log(`Found ${cardThemes.size} casinos with assigned cards`)

    return {
      employees: allEmployeeData,
      expenses: monthlyExpenses,
      cards: allCards,
      cardThemes,
      month,
    }
  } catch (error) {
    console.error('Error collecting employee data:', error)
    throw error
  }
}
