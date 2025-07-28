import { NextRequest, NextResponse } from 'next/server'
import { firestoreService } from '@/lib/services/issue-intelligence/firestore-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Get recent issues
    const issues = await firestoreService.getIssues(limit)

    // Filter by status if provided
    let filteredIssues = issues
    if (status && status !== 'all') {
      filteredIssues = issues.filter(issue => issue.status === status)
    }

    return NextResponse.json({
      success: true,
      data: {
        issues: filteredIssues,
        count: filteredIssues.length,
        totalCount: issues.length
      }
    })

  } catch (error) {
    console.error('Failed to retrieve issues:', error)
    
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields for manual issue creation
    if (!body.title || !body.description || !body.priority) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_REQUEST', 
            message: 'Missing required fields: title, description, priority' 
          } 
        },
        { status: 400 }
      )
    }

    // Create new issue manually (for testing or manual entry)
    const issueData = {
      title: body.title,
      description: body.description,
      status: 'active' as const,
      priority: body.priority,
      category: body.category || 'general',
      tags: body.tags || [],
      
      // Initialize empty arrays for new manual issues
      happyFoxTicketIds: [],
      jiraTicketKeys: [],
      brandImpacts: [],
      totalAffectedMembers: 0,
      totalAffectedBrands: 0,
      totalAffectedLocations: 0,
      
      // AI/ML placeholders
      embedding: [],
      
      // Stakeholder management
      watchers: [],
      notifications: {
        email: true,
        slack: false,
        sms: false,
        frequency: 'immediate' as const
      },
      
      // Incident reporting
      incidentReports: {},
      requiresIncidentReport: false
    }

    const issueId = await firestoreService.createIssue(issueData)

    return NextResponse.json({
      success: true,
      data: {
        issueId,
        message: 'Issue created successfully'
      }
    })

  } catch (error) {
    console.error('Failed to create issue:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'CREATION_FAILED', 
          message: error instanceof Error ? error.message : 'Unknown error occurred' 
        } 
      },
      { status: 500 }
    )
  }
} 