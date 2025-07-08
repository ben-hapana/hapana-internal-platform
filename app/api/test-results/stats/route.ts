import { NextResponse } from 'next/server'
import { serverTestResultsService } from '@/lib/firestore-admin'

export async function GET() {
  try {
    // Get recent test results for statistics
    const results = await serverTestResultsService.getRecent(100)

    // Calculate statistics
    const stats = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      running: results.filter(r => r.status === 'running').length,
      pending: results.filter(r => r.status === 'pending').length,
      successRate: 0
    }

    // Calculate success rate (excluding pending and running tests)
    const completedTests = stats.passed + stats.failed
    if (completedTests > 0) {
      stats.successRate = Math.round((stats.passed / completedTests) * 100)
    }

    return NextResponse.json({ 
      success: true, 
      stats 
    })
  } catch (error) {
    console.error('Error calculating test stats:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to calculate test statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 