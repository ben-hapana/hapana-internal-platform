import { NextResponse } from 'next/server'
import { firestoreService } from '@/lib/services/issue-intelligence/firestore-service'

export async function GET() {
  const healthChecks = {
    firestore: false,
    brands: 0,
    issues: 0,
    incidentReports: 0,
    timestamp: new Date().toISOString()
  }

  try {
    // Test Firestore connection by getting brands
    const brands = await firestoreService.getBrands()
    healthChecks.firestore = true
    healthChecks.brands = brands.length

    // Get recent issues count
    const issues = await firestoreService.getIssues(10)
    healthChecks.issues = issues.length

    // Get recent incident reports count
    const reports = await firestoreService.getRecentIncidentReports(10)
    healthChecks.incidentReports = reports.length

    return NextResponse.json({
      success: true,
      status: 'healthy',
      data: healthChecks
    })

  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: healthChecks
    }, { status: 500 })
  }
} 