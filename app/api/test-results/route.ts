import { firestoreAdmin } from '@/lib/firestore-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const environment = searchParams.get('environment') || undefined
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    console.log(`🔍 Fetching test results - Environment: ${environment || 'all'}, Limit: ${limit}`)

    const results = await firestoreAdmin.getTestResults(environment, limit)

    return NextResponse.json({
      success: true,
      results: results,
      count: results.length,
      environment: environment || 'all',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to fetch test results:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch test results',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 