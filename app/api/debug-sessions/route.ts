import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/client'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')
    
    console.log('Debug sessions - checking current session...')
    
    const debugInfo: any = {
      hasSessionCookie: !!sessionToken,
      sessionValue: sessionToken?.value?.substring(0, 20) + '...' || 'none',
      timestamp: new Date().toISOString()
    }
    
    if (sessionToken) {
      const [employeeId, timestamp] = sessionToken.value.split('_')
      debugInfo.parsedEmployeeId = employeeId
      debugInfo.parsedTimestamp = timestamp
      debugInfo.tokenAge = timestamp ? Date.now() - parseInt(timestamp) : 'invalid'
      debugInfo.tokenAgeHours = timestamp ? Math.round((Date.now() - parseInt(timestamp)) / (1000 * 60 * 60)) : 'invalid'
      
      if (employeeId) {
        const supabase = getServiceSupabase()
        const { data: employee, error } = await supabase
          .from('employees')
          .select('id, username, is_active, is_manager, last_login')
          .eq('id', employeeId)
          .single()
        
        debugInfo.employee = employee ? {
          id: employee.id,
          username: employee.username,
          is_active: employee.is_active,
          is_manager: employee.is_manager,
          last_login: employee.last_login
        } : null
        debugInfo.employeeError = error?.message || null
      }
    }
    
    // Проверяем общую статистику пользователей
    const supabase = getServiceSupabase()
    const { data: allEmployees, error: empError } = await supabase
      .from('employees')
      .select('username, is_active, is_manager, last_login, created_password_at')
      .order('username')
    
    debugInfo.totalEmployees = allEmployees?.length || 0
    debugInfo.activeEmployees = allEmployees?.filter(e => e.is_active).length || 0
    debugInfo.employeesWithPasswords = allEmployees?.filter(e => e.created_password_at).length || 0
    debugInfo.recentLogins = allEmployees?.filter(e => e.last_login).length || 0
    
    return NextResponse.json({
      success: true,
      debug: debugInfo,
      employees: allEmployees?.map(e => ({
        username: e.username,
        is_active: e.is_active,
        is_manager: e.is_manager,
        has_password: !!e.created_password_at,
        last_login: e.last_login
      }))
    })
    
  } catch (error: any) {
    console.error('Debug sessions error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Debug error'
    }, { status: 500 })
  }
}
