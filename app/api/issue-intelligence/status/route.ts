import { NextResponse } from 'next/server'
import { firestoreService } from '@/lib/services/issue-intelligence/firestore-service'

export async function GET() {
  try {
    // Check system health
    const healthChecks = {
      firestore: false,
      brands: 0,
      locations: 0,
      customers: 0,
      issues: 0,
      templates: 0
    }

    try {
      // Test Firestore connection by getting brands
      const brands = await firestoreService.getAllBrands()
      healthChecks.firestore = true
      healthChecks.brands = brands.length

      // Get locations for first brand if available
      if (brands.length > 0) {
        const locations = await firestoreService.getLocationsByBrand(brands[0].id)
        healthChecks.locations = locations.length
      }

      // Get recent issues
      const issues = await firestoreService.getRecentIssues(10)
      healthChecks.issues = issues.length

    } catch (error) {
      console.error('Health check failed:', error)
    }

    return NextResponse.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        'webhook-handlers': {
          status: 'ready',
          endpoints: [
            '/api/webhooks/happyfox',
            '/api/webhooks/jira'
          ]
        },
        'issue-intelligence': {
          status: 'ready',
          features: [
            'similarity-detection',
            'issue-creation',
            'issue-linking',
            'impact-tracking'
          ]
        },
        'incident-reporting': {
          status: 'planned',
          features: [
            'auto-generation',
            'brand-specific-templates',
            'openai-integration'
          ]
        }
      },
      dataHealth: healthChecks,
      configuration: {
        collections: [
          'issues',
          'brands', 
          'locations',
          'customers',
          'happyfox-tickets',
          'jira-tickets',
          'incident-reports',
          'incident-report-templates',
          'processing-logs'
        ],
        features: {
          webhookValidation: true,
          issueDeduplication: true,
          brandImpactTracking: true,
          incidentReporting: false, // TODO: Implement
          stakeholderNotifications: false // TODO: Implement
        }
      },
      testing: {
        simulationEndpoint: '/api/test/webhook-simulation',
        sampleDataScript: 'npm run setup-sample-data'
      }
    })

  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 