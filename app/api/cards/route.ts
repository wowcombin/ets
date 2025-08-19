import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServiceSupabase()
    
    const { data: cards, error } = await supabase
      .from('cards')
      .select('*')
      .order('sheet')
      .order('status')
      .order('card_number')
    
    if (error) throw error
    
    return NextResponse.json({
      success: true,
      cards: cards || []
    })
    
  } catch (error: any) {
    console.error('Cards API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
