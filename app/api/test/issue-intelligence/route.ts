import { NextRequest, NextResponse } from 'next/server'
import { issueOrchestrationService } from '@/lib/services/issue-intelligence/issue-orchestration'
import { incidentReportService } from '@/lib/services/ai-ml/incident-report-service'
import type { NormalizedTicketData } from '@/lib/types/issue-intelligence'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'test-similarity') {
      // First, ensure we have sample data
      await createSampleData()
      
      // Test similarity detection
      const testTicket: NormalizedTicketData = {
        ticketId: 'TEST-001',
        title: 'Login issues with mobile app',
        description: 'Users unable to authenticate using mobile application after recent update',
        status: 'open',
        priority: 'high',
        customer: {
          id: 'test-customer',
          name: 'Test Customer',
          email: 'test@example.com',
          brandId: 'hapana',
          locationId: 'gym-001',
          tier: 'standard',
          membershipType: 'regular'
        },
        created: new Date(),
        updated: new Date(),
        tags: ['login', 'mobile', 'authentication']
      }

      const result = await issueOrchestrationService.processNewTicket(testTicket)

      return NextResponse.json({
        success: true,
        data: {
          action: result.action,
          issueId: result.issueId,
          confidence: result.confidence,
          similarIssuesFound: result.similarIssues?.length || 0,
          message: 'Similarity detection test completed'
        }
      })
    }

    if (action === 'test-incident-report') {
      // Test incident report generation
      const { issueId, brandId } = body

      if (!issueId || !brandId) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'MISSING_PARAMS', 
              message: 'issueId and brandId required for incident report test' 
            } 
          },
          { status: 400 }
        )
      }

      const reportRequest = {
        issueId,
        brandId,
        severity: 'medium' as const,
        requestedBy: 'test-user',
        customInstructions: 'This is a test incident report generation'
      }

      const report = await incidentReportService.generateIncidentReport(reportRequest)

      return NextResponse.json({
        success: true,
        data: {
          reportId: report.id,
          title: report.content.title,
          summary: report.content.summary,
          message: 'Incident report test completed'
        }
      })
    }

    if (action === 'test-algolia-search') {
      // Test Algolia search service
      const { AlgoliaSearchService } = await import('@/lib/services/search/algolia-search-service')
      
      const searchService = new AlgoliaSearchService()
      
      // Test connection
      const connectionTest = await searchService.testConnection()
      
      if (!connectionTest.success) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'ALGOLIA_CONNECTION_FAILED',
            message: connectionTest.message
          }
        })
      }
      
      // Test search functionality on both tickets and issues
      try {
        const ticketSearchResults = await searchService.searchTickets('test', {
          source: ['happyfox']
        }, {
          hitsPerPage: 5
        })
        
        const { query = 'payment' } = body
        const issueSearchResults = await searchService.searchIssues(query, {}, {
          hitsPerPage: 5
        })
        
        return NextResponse.json({
          success: true,
          data: {
            connectionStatus: connectionTest.message,
            ticketSearchResults: {
              totalHits: ticketSearchResults.totalHits,
              hitsCount: ticketSearchResults.hits.length,
              processingTime: ticketSearchResults.processingTimeMS,
              query: ticketSearchResults.query
            },
            issueSearchResults: {
              totalHits: issueSearchResults.totalHits,
              hitsCount: issueSearchResults.hits.length,
              processingTime: issueSearchResults.processingTimeMS,
              query: issueSearchResults.query,
              hits: issueSearchResults.hits.map(hit => ({
                id: hit.objectID,
                title: hit.title,
                content: hit.content,
                status: hit.status,
                priority: hit.priority
              }))
            },
            message: 'Algolia search test completed successfully'
          }
        })
      } catch (searchError) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'ALGOLIA_SEARCH_FAILED',
            message: searchError instanceof Error ? searchError.message : 'Search test failed'
          }
        })
      }
    }

    if (action === 'create-sample-issue') {
      // Ensure we have sample data first
      await createSampleData()
      
      // Create a sample issue for testing
      const { firestoreService } = await import('@/lib/services/issue-intelligence/firestore-service')
      
      const sampleIssue = {
        title: 'Sample Authentication Issue',
        description: 'This is a sample issue created for testing the issue intelligence system. Multiple users are experiencing login failures.',
        status: 'active' as const,
        priority: 'high' as const,
        category: 'authentication',
        tags: ['login', 'authentication', 'mobile'],
        
        happyFoxTicketIds: ['HF-TEST-001', 'HF-TEST-002'],
        jiraTicketKeys: ['AUTH-TEST-001'],
        
        brandImpacts: [{
          brandId: 'hapana',
          brandName: 'Hapana Fitness',
          totalAffectedMembers: 25,
          impactLevel: 'medium' as const,
          locationImpacts: [{
            locationId: 'gym-001',
            locationName: 'Downtown Gym',
            brandId: 'hapana',
            affectedMembers: 15,
            totalMembers: 200,
            impactPercentage: 7.5,
            impactLevel: 'low' as const,
            affectedServices: ['mobile-app', 'login']
          }],
          affectedServices: ['mobile-app', 'login']
        }],
        
        totalAffectedMembers: 25,
        totalAffectedBrands: 1,
        totalAffectedLocations: 1,
        
        embedding: [],
        watchers: [],
        notifications: {
          email: true,
          slack: false,
          sms: false,
          frequency: 'immediate' as const
        },
        
        incidentReports: {},
        requiresIncidentReport: true
      }

      const issueId = await firestoreService.createIssue(sampleIssue)

      return NextResponse.json({
        success: true,
        data: {
          issueId,
          message: 'Sample issue created successfully'
        }
      })
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INVALID_ACTION', 
          message: 'Valid actions: test-similarity, test-incident-report, test-algolia-search, create-sample-issue' 
        } 
      },
      { status: 400 }
    )

  } catch (error) {
    console.error('Test failed:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'TEST_FAILED', 
          message: error instanceof Error ? error.message : 'Unknown error occurred' 
        } 
      },
      { status: 500 }
    )
  }
}

// Helper function to create sample data
async function createSampleData() {
  const { firestoreService } = await import('@/lib/services/issue-intelligence/firestore-service')
  
  try {
    // Check if sample brand already exists
    const existingBrand = await firestoreService.getBrand('hapana')
    if (!existingBrand) {
      // Create sample brand
      await firestoreService.createBrand({
        id: 'hapana',
        name: 'Hapana Fitness',
        code: 'HAP',
        region: 'North America',
        memberCount: 350
      })
    }
    
    // Check if sample locations exist
    const existingLocations = await firestoreService.getLocationsByBrand('hapana')
    if (existingLocations.length === 0) {
      // Create sample locations
      await firestoreService.createLocation({
        id: 'gym-001',
        name: 'Downtown Gym',
        brandId: 'hapana',
        address: '123 Main St, Downtown',
        memberCount: 200,
        services: ['fitness', 'personal-training', 'classes'],
        timezone: 'America/New_York'
      })
      
      await firestoreService.createLocation({
        id: 'gym-002',
        name: 'Uptown Gym',
        brandId: 'hapana',
        address: '456 Oak Ave, Uptown',
        memberCount: 150,
        services: ['fitness', 'yoga', 'swimming'],
        timezone: 'America/New_York'
      })
    }
  } catch (error) {
    console.warn('Failed to create sample data:', error)
    // Continue anyway - the test might still work with fallback behavior
  }
} 