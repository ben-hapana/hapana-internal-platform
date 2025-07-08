import { NextRequest, NextResponse } from 'next/server'
import { firestoreService } from '@/lib/services/issue-intelligence/firestore-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const brandId = searchParams.get('brandId')

    // Get recent issues
    const issues = await firestoreService.getRecentIssues(limit)

    // Filter by status if provided
    let filteredIssues = issues
    if (status) {
      filteredIssues = filteredIssues.filter(issue => issue.status === status)
    }
    if (priority) {
      filteredIssues = filteredIssues.filter(issue => issue.priority === priority)
    }
    if (brandId) {
      filteredIssues = filteredIssues.filter(issue => 
        issue.brandImpacts.some(impact => impact.brandId === brandId)
      )
    }

    // Transform issues for UI
    const transformedIssues = await Promise.all(filteredIssues.map(async issue => {
      // Get actual ticket details
      const happyFoxTickets = await Promise.all(
        issue.happyFoxTicketIds.slice(0, 10).map(async ticketId => {
          try {
            const ticket = await firestoreService.getHappyFoxTicket(ticketId)
            return ticket ? {
              id: ticket.ticketId,
              title: `Ticket #${ticket.ticketId}`,
              status: ticket.status as 'open' | 'pending' | 'resolved',
              priority: ticket.priority,
              customer: ticket.customer.name,
              created: ticket.created.toDate(),
              updated: ticket.lastUpdated.toDate()
            } : null
          } catch {
            return null
          }
        })
      )

      const jiraTickets = await Promise.all(
        issue.jiraTicketKeys.slice(0, 10).map(async ticketKey => {
          try {
            const ticket = await firestoreService.getJiraTicket(ticketKey)
            return ticket ? {
              id: ticket.key,
              key: ticket.key,
              title: `Issue ${ticket.key}`,
              status: ticket.status as 'to-do' | 'in-progress' | 'done',
              priority: ticket.priority,
              assignee: ticket.assignee,
              created: ticket.created.toDate(),
              updated: ticket.lastUpdated.toDate()
            } : null
          } catch {
            return null
          }
        })
      )

      return {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        category: issue.category,
        created: issue.created,
        updated: issue.updated,
        
        // Impact summary
        totalAffectedBrands: issue.totalAffectedBrands,
        totalAffectedMembers: issue.totalAffectedMembers,
        totalAffectedLocations: issue.totalAffectedLocations,
        
        // Brand impacts
        brandImpacts: issue.brandImpacts.map(impact => ({
          brandId: impact.brandId,
          brandName: impact.brandName,
          totalAffectedMembers: impact.totalAffectedMembers,
          impactLevel: impact.impactLevel,
          locationCount: impact.locationImpacts?.length || 0
        })),
        
        // Linked tickets (both counts and arrays)
        happyFoxTicketCount: issue.happyFoxTicketIds.length,
        jiraTicketCount: issue.jiraTicketKeys.length,
        happyFoxTickets: happyFoxTickets.filter(Boolean),
        jiraTickets: jiraTickets.filter(Boolean),
        
        // Intelligence
        requiresIncidentReport: issue.requiresIncidentReport,
        hasIncidentReports: Object.keys(issue.incidentReports || {}).length > 0,
        
        // Tags
        tags: issue.tags
      }
    }))

    return NextResponse.json({
      success: true,
      data: {
        issues: transformedIssues,
        count: transformedIssues.length,
        filters: {
          status,
          priority,
          brandId,
          limit
        }
      }
    })

  } catch (error) {
    console.error('Failed to fetch issues:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'FETCH_FAILED', 
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