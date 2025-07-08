import { NextRequest, NextResponse } from 'next/server'
import { mockDataService } from '@/lib/services/sync/mock-data-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { step = 'mock-data' } = body

    if (step === 'mock-data') {
      // Test 1: Generate mock data
      const tickets = mockDataService.generateMockHappyFoxTickets(5)
      return NextResponse.json({
        success: true,
        message: 'Mock data generated successfully',
        data: { count: tickets.length, sample: tickets[0] }
      })
    }

    if (step === 'firestore') {
      // Test 2: Test Firestore connection
      const { firestoreService } = await import('@/lib/services/issue-intelligence/firestore-service')
      
      // Try to get sync state (simple read operation)
      const syncState = await firestoreService.getSyncState('happyfox')
      
      return NextResponse.json({
        success: true,
        message: 'Firestore connection successful',
        data: { syncState }
      })
    }

    if (step === 'algolia') {
      // Test 3: Test Algolia connection
      const { algoliasearch } = await import('algoliasearch')
      
      const client = algoliasearch(
        process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
        process.env.ALGOLIA_ADMIN_API_KEY!
      )
      
      // Try a simple operation
      const testRecord = {
        objectID: 'test_123',
        title: 'Test Record',
        content: 'This is a test'
      }
      
      await client.saveObject({
        indexName: 'tickets',
        body: testRecord
      })
      
      return NextResponse.json({
        success: true,
        message: 'Algolia connection successful'
      })
    }

    if (step === 'single-ticket') {
      // Test 4: Process a single ticket through the full pipeline
      const tickets = mockDataService.generateMockHappyFoxTickets(1)
      const ticket = tickets[0]
      
      // Import services
      const { dataSyncService } = await import('@/lib/services/sync/data-sync-service')
      
      // Process the ticket
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await dataSyncService.syncHappyFoxTicket(ticket as any)
      
      return NextResponse.json({
        success: true,
        message: 'Single ticket processed successfully',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { ticketId: (ticket as any).id }
      })
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INVALID_STEP', 
          message: 'Valid steps: mock-data, firestore, algolia, single-ticket' 
        } 
      },
      { status: 400 }
    )

  } catch (error) {
    console.error('Test sync error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: 'TEST_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test sync endpoint',
    availableSteps: ['mock-data', 'firestore', 'algolia', 'single-ticket']
  })
} 