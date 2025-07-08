import { NextRequest, NextResponse } from 'next/server'
import { serverTestResultsService } from '@/lib/firestore-admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 20

    // Validate limit parameter
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid limit parameter. Must be between 1 and 100.' },
        { status: 400 }
      )
    }

    const results = await serverTestResultsService.getRecent(limit)

    return NextResponse.json({
      success: true,
      results: results
    })
  } catch (error) {
    console.error('Error fetching test results:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch test results' },
      { status: 500 }
    )
  }
} 