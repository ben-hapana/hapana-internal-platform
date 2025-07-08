import { NextRequest, NextResponse } from 'next/server'
import { incidentReportService } from '@/lib/services/ai-ml/incident-report-service'
import type { IncidentReportRequest } from '@/lib/services/ai-ml/incident-report-service'

export async function POST(request: NextRequest) {
  try {
    const body: IncidentReportRequest = await request.json()
    
    // Validate required fields
    if (!body.issueId || !body.brandId || !body.severity || !body.requestedBy) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_REQUEST', 
            message: 'Missing required fields: issueId, brandId, severity, requestedBy' 
          } 
        },
        { status: 400 }
      )
    }

    // Generate incident report
    const incidentReport = await incidentReportService.generateIncidentReport(body)

    return NextResponse.json({
      success: true,
      data: {
        reportId: incidentReport.id,
        issueId: incidentReport.issueId,
        brandId: incidentReport.brandId,
        status: incidentReport.status,
        content: incidentReport.content,
        metadata: incidentReport.metadata,
        generatedAt: incidentReport.generatedAt
      }
    })

  } catch (error) {
    console.error('Failed to generate incident report:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'GENERATION_FAILED', 
          message: error instanceof Error ? error.message : 'Unknown error occurred' 
        } 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issueId')
    const brandId = searchParams.get('brandId') // Optional filter for specific brand

    if (!issueId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_REQUEST', 
            message: 'Missing required parameter: issueId' 
          } 
        },
        { status: 400 }
      )
    }

    // Get incident reports for the issue
    const { firestoreService } = await import('@/lib/services/issue-intelligence/firestore-service')
    
    let reports
    if (brandId) {
      // Get specific brand report
      const report = await firestoreService.getIncidentReportByBrand(issueId, brandId)
      reports = report ? [report] : []
    } else {
      // Get all reports for the issue
      reports = await firestoreService.getIncidentReportsByIssue(issueId)
    }

    return NextResponse.json({
      success: true,
      data: {
        reports,
        count: reports.length
      }
    })

  } catch (error) {
    console.error('Failed to retrieve incident reports:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'RETRIEVAL_FAILED', 
          message: error instanceof Error ? error.message : 'Unknown error occurred' 
        } 
      },
      { status: 500 }
    )
  }
} 