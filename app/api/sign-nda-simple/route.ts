import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Используем существующую таблицу для логирования (та же что используется в основной системе)
const EXISTING_SPREADSHEET_ID = '1AfI-HcjO1ZBMgHiLGBy3ckgiB8Cak2ahsmllgMTCymU'

// Украинские названия месяцев в родительном падеже
const UKRAINIAN_MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json()
    const { fullName, passport, issuedBy, issuedDate, address, email, signatureBase64 } = formData

    // Проверка обязательных полей
    if (!fullName || !passport || !issuedBy || !issuedDate || !address || !email) {
      return NextResponse.json({
        success: false,
        error: 'Помилка: Усі поля є обов\'язковими. Будь ласка, заповніть усі поля.'
      }, { status: 400 })
    }

    // Проверяем, не подписывал ли уже этот email NDA
    const supabase = getServiceSupabase()
    const { data: existingNda } = await supabase
      .from('nda_signatures')
      .select('id')
      .eq('email', email)
      .single()

    if (existingNda) {
      return NextResponse.json({
        success: false,
        error: 'Помилка: Ви вже відправили запит з цієї поштової адреси. Повторна відправка заборонена.'
      }, { status: 400 })
    }

    // Настройка Google API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Получаем текущую дату для подписи
    const now = new Date()
    const day = now.getDate()
    const month = UKRAINIAN_MONTHS_GENITIVE[now.getMonth()]
    const year = now.getFullYear()
    const signatureDate = `${day} ${month} ${year}`

    // Проверяем существует ли лист NDA_Signatures, если нет - создаем
    let sheetId = 0
    try {
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId: EXISTING_SPREADSHEET_ID
      })
      
      const ndaSheet = spreadsheetInfo.data.sheets?.find(sheet => 
        sheet.properties?.title === 'NDA_Signatures'
      )
      
      if (!ndaSheet) {
        // Создаем новый лист для NDA
        const addSheetResponse = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: EXISTING_SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: 'NDA_Signatures'
                }
              }
            }]
          }
        })
        sheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId || 0
        
        // Добавляем заголовки
        await sheets.spreadsheets.values.update({
          spreadsheetId: EXISTING_SPREADSHEET_ID,
          range: 'NDA_Signatures!A1:I1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              'ПІБ',
              'Паспорт', 
              'Ким виданий',
              'Дата видачі',
              'Адреса',
              'Email',
              'Дата підписання',
              'Час створення',
              'Статус'
            ]]
          }
        })
      } else {
        sheetId = ndaSheet.properties?.sheetId || 0
      }
    } catch (error) {
      console.error('Error working with spreadsheet:', error)
      return NextResponse.json({
        success: false,
        error: 'Помилка доступу до Google Sheets. Перевірте права доступу.'
      }, { status: 500 })
    }

    // Добавляем запись о подписанном NDA в таблицу
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: EXISTING_SPREADSHEET_ID,
        range: 'NDA_Signatures!A:I',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[
            fullName,
            passport,
            issuedBy,
            issuedDate,
            address,
            email,
            signatureDate,
            new Date().toISOString(),
            'Підписано'
          ]]
        }
      })
    } catch (error) {
      console.error('Error adding NDA record:', error)
      return NextResponse.json({
        success: false,
        error: 'Помилка при збереженні даних NDA.'
      }, { status: 500 })
    }

    // Сохраняем информацию в базу данных
    const { error: insertError } = await supabase
      .from('nda_signatures')
      .insert([{
        full_name: fullName,
        passport: passport,
        issued_by: issuedBy,
        issued_date: issuedDate,
        address: address,
        email: email,
        signature_date: signatureDate,
        document_url: `https://docs.google.com/spreadsheets/d/${EXISTING_SPREADSHEET_ID}#gid=${sheetId}`,
        created_at: new Date().toISOString()
      }])

    if (insertError) {
      console.error('Error saving to database:', insertError)
      // Продолжаем, так как основная запись в Google Sheets уже создана
    }

    return NextResponse.json({
      success: true,
      message: 'NDA успішно підписано та збережено!',
      documentUrl: `https://docs.google.com/spreadsheets/d/${EXISTING_SPREADSHEET_ID}#gid=${sheetId}`,
      note: 'Ваші дані збережено в таблиці NDA_Signatures. Повний текст договору буде надіслано окремо.'
    })

  } catch (error: any) {
    console.error('NDA signing error:', error)
    return NextResponse.json({
      success: false,
      error: 'Помилка при підписанні NDA: ' + error.message
    }, { status: 500 })
  }
}
