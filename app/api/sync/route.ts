import { NextRequest, NextResponse } from 'next/server'
import { dataSyncService } from '@/lib/services/sync/data-sync-service'
import { AlgoliaSearchService } from '@/lib/services/search/algolia-search-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, source, fullSync = false } = body

    if (action === 'sync') {
      if (source === 'happyfox') {
        await dataSyncService.syncHappyFoxData(fullSync)
        return NextResponse.json({
          success: true,
          message: 'HappyFox sync completed successfully'
        })
      } else if (source === 'jira') {
        await dataSyncService.syncJiraData(fullSync)
        return NextResponse.json({
          success: true,
          message: 'Jira sync completed successfully'
        })
      } else if (source === 'all') {
        // Sync both in parallel
        await Promise.all([
          dataSyncService.syncHappyFoxData(fullSync),
          dataSyncService.syncJiraData(fullSync)
        ])
        return NextResponse.json({
          success: true,
          message: 'Full sync completed successfully'
        })
      } else {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'INVALID_SOURCE', 
              message: 'Valid sources: happyfox, jira, all' 
            } 
          },
          { status: 400 }
        )
      }
    }

    if (action === 'status') {
      // Get sync status for both systems
      const happyfoxStatus = await dataSyncService.getSyncStatus('happyfox')
      const jiraStatus = await dataSyncService.getSyncStatus('jira')

      return NextResponse.json({
        success: true,
        data: {
          happyfox: happyfoxStatus,
          jira: jiraStatus
        }
      })
    }

    if (action === 'index-sample-issues') {
      // Index some sample issues to Algolia for testing
      const algoliaService = new AlgoliaSearchService()
      
      const sampleIssues = [
        {
          objectID: 'issue-1',
          title: 'Payment Processing Delays',
          content: 'Multiple customers reporting delays in payment processing across different brands',
          status: 'active',
          priority: 'high',
          created: Date.now(),
          updated: Date.now(),
          source: 'issue' as const,
          category: 'payments',
          tags: ['payment', 'processing', 'delay']
        },
        {
          objectID: 'issue-2', 
          title: 'Login Authentication Issues',
          content: 'Users unable to authenticate with their credentials, affecting multiple locations',
          status: 'monitoring',
          priority: 'medium',
          created: Date.now() - 86400000, // 1 day ago
          updated: Date.now() - 3600000, // 1 hour ago
          source: 'issue' as const,
          category: 'authentication',
          tags: ['login', 'auth', 'credentials']
        },
        {
          objectID: 'issue-3',
          title: 'Database Connection Timeouts',
          content: 'Intermittent database connection timeouts causing service disruptions',
          status: 'resolved',
          priority: 'urgent',
          created: Date.now() - 172800000, // 2 days ago
          updated: Date.now() - 7200000, // 2 hours ago
          source: 'issue' as const,
          category: 'infrastructure',
          tags: ['database', 'timeout', 'connection']
        }
      ]

      // Index the sample issues
      for (const issue of sampleIssues) {
        await algoliaService.indexIssue(issue)
      }

      return NextResponse.json({
        success: true,
        message: `Indexed ${sampleIssues.length} sample issues to Algolia`,
        data: { count: sampleIssues.length }
      })
    }

    if (action === 'mock-sync') {
      // Perform mock sync to demonstrate the full workflow
      const { source = 'both' } = body
      
      try {
        const results = []
        
        if (source === 'happyfox' || source === 'both') {
          await dataSyncService.syncHappyFoxData(true)
          results.push({ source: 'happyfox', status: 'success', message: 'Mock HappyFox sync completed' })
        }
        
        if (source === 'jira' || source === 'both') {
          await dataSyncService.syncJiraData(true)
          results.push({ source: 'jira', status: 'success', message: 'Mock Jira sync completed' })
        }

        return NextResponse.json({
          success: true,
          message: 'Mock sync completed successfully',
          data: { results }
        })
        
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'MOCK_SYNC_FAILED',
            message: error instanceof Error ? error.message : 'Mock sync failed'
          }
        })
      }
    }

    if (action === 'bulk-sync') {
      // Perform initial bulk sync of all data
      const { sources = ['happyfox', 'jira'] } = body
      
      const results = []
      
      for (const source of sources) {
        try {
          if (source === 'happyfox') {
            await dataSyncService.syncHappyFoxData(true) // Full sync
            results.push({ source: 'happyfox', status: 'success' })
          } else if (source === 'jira') {
            await dataSyncService.syncJiraData(true) // Full sync
            results.push({ source: 'jira', status: 'success' })
          }
        } catch (error) {
          results.push({ 
            source, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Bulk sync completed',
        data: { results }
      })
    }

    if (action === 'test-connection') {
      // Test API connections
      const { source } = body
      
      if (!source || !['happyfox', 'jira'].includes(source)) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'INVALID_SOURCE', 
              message: 'Source must be happyfox or jira' 
            } 
          },
          { status: 400 }
        )
      }

      try {
        let connectionTest
        
        if (source === 'happyfox') {
          // Test HappyFox connection by fetching a small batch
          const baseUrl = process.env.HAPPYFOX_API_BASE_URL
          const apiKey = process.env.HAPPYFOX_API_KEY
          const apiSecret = process.env.HAPPYFOX_API_SECRET
          
          if (!baseUrl || !apiKey || !apiSecret) {
            throw new Error('HappyFox API credentials not configured')
          }

          const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
          const response = await fetch(`${baseUrl}/tickets/?size=1&format=json`, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            throw new Error(`HappyFox API error: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()
          connectionTest = {
            source: 'happyfox',
            status: 'connected',
            message: `Successfully connected to HappyFox. Found ${data.count || 0} total tickets.`
          }
        } else if (source === 'jira') {
          // Test Jira connection
          const baseUrl = process.env.JIRA_API_BASE_URL
          const email = process.env.JIRA_API_EMAIL
          const token = process.env.JIRA_API_TOKEN
          
          if (!baseUrl || !email || !token) {
            throw new Error('Jira API credentials not configured')
          }

          const auth = Buffer.from(`${email}:${token}`).toString('base64')
          const response = await fetch(`${baseUrl}/rest/api/3/search?maxResults=1`, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            throw new Error(`Jira API error: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()
          connectionTest = {
            source: 'jira',
            status: 'connected',
            message: `Successfully connected to Jira. Found ${data.total || 0} total issues.`
          }
        }

        return NextResponse.json({
          success: true,
          data: connectionTest
        })

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: error instanceof Error ? error.message : 'Connection test failed'
          }
        })
      }
    }

    if (action === 'simple-sync') {
      // Simple sync with minimal error handling to identify the issue
      try {
        const { source = 'happyfox', count = 5 } = body
        
        if (source === 'happyfox') {
          // Generate mock data
          const { mockDataService } = await import('@/lib/services/sync/mock-data-service')
          const tickets = mockDataService.generateMockHappyFoxTickets(count)
          
          // Process each ticket with minimal operations
          const results: Array<{ ticketId: number; status: string; error?: string }> = []
          for (const ticket of tickets) {
            try {
              // Just store in Firestore, skip Algolia for now
              const { firestoreService } = await import('@/lib/services/issue-intelligence/firestore-service')
              
              // Transform ticket data
              const { Timestamp } = await import('firebase-admin/firestore')
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ticketData = ticket as any
              
              const happyFoxTicket = {
                ticketId: ticketData.id.toString(),
                status: ticketData.status.name,
                priority: ticketData.priority.name,
                brand: { id: 'hapana', name: 'Hapana Fitness', code: 'HAP', region: 'North America', memberCount: 2500 },
                location: { id: 'gym-001', name: 'Downtown Hapana', brandId: 'hapana', address: '123 Main St', memberCount: 450, services: ['gym', 'pool'], timezone: 'America/New_York' },
                customer: { id: ticketData.user.id.toString(), name: ticketData.user.name, email: ticketData.user.email, brandId: 'hapana', locationId: 'gym-001', tier: 'standard' as const, membershipType: 'monthly' },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                created: Timestamp.fromDate(new Date(ticketData.created_at)) as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                lastUpdated: Timestamp.fromDate(new Date(ticketData.updated_at)) as any
              }
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await firestoreService.storeHappyFoxTicket(happyFoxTicket as any)
              results.push({ ticketId: ticketData.id, status: 'success' })
              
            } catch (error) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              results.push({ ticketId: (ticket as any).id, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
            }
          }
          
          return NextResponse.json({
            success: true,
            message: 'Simple sync completed',
            data: { processed: results.length, results }
          })
        }
        
        return NextResponse.json({
          success: false,
          error: { code: 'UNSUPPORTED_SOURCE', message: 'Only happyfox supported for simple sync' }
        })
        
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'SIMPLE_SYNC_FAILED',
            message: error instanceof Error ? error.message : 'Simple sync failed'
          }
        })
      }
    }

    if (action === 'debug-sync') {
      // Debug sync to isolate the issue step by step
      try {
        const { step = 'fetch' } = body
        const { dataSyncService } = await import('@/lib/services/sync/data-sync-service')
        
        if (step === 'fetch') {
          // Test just the fetch method
          const tickets = await dataSyncService['fetchHappyFoxTickets']()
          return NextResponse.json({
            success: true,
            message: 'Fetch completed',
            data: { count: tickets.length, sample: tickets[0] }
          })
        }
        
        if (step === 'single-ticket-sync') {
          // Test processing a single ticket through syncHappyFoxTicket
          const tickets = await dataSyncService['fetchHappyFoxTickets'](undefined, 1)
          if (tickets.length > 0) {
            await dataSyncService.syncHappyFoxTicket(tickets[0])
            return NextResponse.json({
              success: true,
              message: 'Single ticket sync completed',
              data: { ticketId: tickets[0].id }
            })
          }
          return NextResponse.json({
            success: false,
            error: { code: 'NO_TICKETS', message: 'No tickets to process' }
          })
        }
        
        if (step === 'sync-state') {
          // Test sync state operations
          const syncState = await dataSyncService.getSyncStatus('happyfox')
          await dataSyncService['updateSyncStatus']('happyfox', 'syncing')
          
          return NextResponse.json({
            success: true,
            message: 'Sync state operations completed',
            data: { syncState }
          })
        }
        
        return NextResponse.json({
          success: false,
          error: { code: 'INVALID_STEP', message: 'Valid steps: fetch, single-ticket-sync, sync-state' }
        })
        
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'DEBUG_SYNC_FAILED',
            message: error instanceof Error ? error.message : 'Debug sync failed',
            stack: error instanceof Error ? error.stack : undefined
          }
        })
      }
    }

    if (action === 'debug-env') {
      // Debug environment variables
      return NextResponse.json({
        success: true,
        data: {
          happyfox: {
            apiKey: process.env.HAPPYFOX_API_KEY ? `${process.env.HAPPYFOX_API_KEY.substring(0, 8)}...` : 'NOT SET',
            apiSecret: process.env.HAPPYFOX_API_SECRET ? `${process.env.HAPPYFOX_API_SECRET.substring(0, 8)}...` : 'NOT SET',
            subdomain: process.env.HAPPYFOX_SUBDOMAIN || 'NOT SET'
          },
          algolia: {
            appId: process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || 'NOT SET',
            searchKey: process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY ? 'SET' : 'NOT SET',
            adminKey: process.env.ALGOLIA_ADMIN_API_KEY ? 'SET' : 'NOT SET'
          }
        }
      })
    }

    if (action === 'test-fetch') {
      // Test just the API fetch without any database operations
      try {
        const { DataSyncService } = await import('@/lib/services/sync/data-sync-service')
        const syncService = new DataSyncService()
        
        // Use reflection to access the private method for testing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tickets = await (syncService as any).fetchHappyFoxTickets(undefined, 5)
        
        return NextResponse.json({
          success: true,
          message: `Fetched ${tickets.length} tickets from HappyFox API`,
          data: {
            count: tickets.length,
            sample: tickets[0] || null,
            structure: tickets[0] ? Object.keys(tickets[0]) : []
          }
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'FETCH_TEST_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        })
      }
    }

    if (action === 'simple-happyfox-sync') {
      // Simple test of HappyFox batch processing
      try {
        console.log('🧪 Starting simple HappyFox sync test')
        
        const { DataSyncService } = await import('@/lib/services/sync/data-sync-service')
        const syncService = new DataSyncService()
        
        // Fetch just a few tickets
        console.log('📡 Fetching tickets...')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tickets = await (syncService as any).fetchHappyFoxTickets(undefined, 3)
        console.log(`✅ Fetched ${tickets.length} tickets`)
        
        if (tickets.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No tickets to process',
            data: { processed: 0 }
          })
        }

        // Process just the first ticket individually to test
        console.log('🔄 Processing first ticket individually...')
        await syncService.syncHappyFoxTicket(tickets[0])
        console.log('✅ Individual ticket processing successful')
        
        return NextResponse.json({
          success: true,
          message: `Successfully processed 1 ticket`,
          data: {
            processed: 1,
            sample: {
              id: tickets[0].id,
              subject: tickets[0].subject,
              status: tickets[0].status?.name
            }
          }
        })
        
      } catch (error) {
        console.error('❌ Simple HappyFox sync failed:', error)
        return NextResponse.json({
          success: false,
          error: {
            code: 'SIMPLE_SYNC_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? error.stack : undefined
          }
        }, { status: 500 })
      }
    }

    if (action === 'one-ticket-test') {
      // Simple test: 1 ticket from HappyFox -> Firestore -> Algolia
      try {
        console.log('🧪 Starting one-ticket test')
        
        // Step 1: Fetch 1 ticket from HappyFox API
        console.log('📡 Step 1: Fetching 1 ticket from HappyFox...')
        const apiKey = process.env.HAPPYFOX_API_KEY
        const apiSecret = process.env.HAPPYFOX_API_SECRET
        
        if (!apiKey || !apiSecret) {
          throw new Error('HappyFox API credentials not configured')
        }

        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
        const url = 'https://support.hapana.com/api/1.1/json/tickets/?page=1&size=1'
        
        console.log(`📞 Calling: ${url}`)
        const response = await fetch(url, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`HappyFox API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        console.log('📦 API Response keys:', Object.keys(data))
        
        const tickets = data.data || data.tickets || data
        if (!Array.isArray(tickets) || tickets.length === 0) {
          throw new Error('No tickets found in API response')
        }

        const ticket = tickets[0]
        console.log('✅ Step 1 complete: Fetched ticket', {
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status?.name,
          priority: ticket.priority?.name
        })

        // Step 2: Save to Firestore
        console.log('💾 Step 2: Saving to Firestore...')
        const { getAdminDb } = await import('@/firebase/firebase-admin')
        const adminDb = getAdminDb()
        const { FieldValue } = await import('firebase-admin/firestore')
        
        const firestoreTicket = {
          ticketId: ticket.id.toString(),
          status: ticket.status?.name || 'unknown',
          priority: ticket.priority?.name || 'unknown',
          subject: ticket.subject || '',
          customerName: ticket.user?.name || 'unknown',
          customerEmail: ticket.user?.email || '',
          created: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp(),
          rawData: ticket // Store the full raw data for debugging
        }
        
        console.log('📝 Firestore document to save:', JSON.stringify(firestoreTicket, null, 2))
        
        await adminDb.collection('happyfox-tickets').doc(ticket.id.toString()).set(firestoreTicket)
        console.log('✅ Step 2 complete: Saved to Firestore')

        // Step 3: Index in Algolia
        console.log('🔍 Step 3: Indexing in Algolia...')
        const { AlgoliaSearchService } = await import('@/lib/services/search/algolia-search-service')
        const algoliaService = new AlgoliaSearchService()
        
        const searchRecord = {
          objectID: `happyfox_${ticket.id}`,
          source: 'happyfox',
          ticketId: ticket.id.toString(),
          title: ticket.subject || '',
          content: ticket.first_message || ticket.text || '',
          status: ticket.status?.name || 'unknown',
          priority: ticket.priority?.name || 'unknown',
          customer: ticket.user?.name || 'unknown',
          customerEmail: ticket.user?.email || '',
          created: new Date(ticket.created_at).getTime(),
          updated: new Date(ticket.updated_at).getTime(),
          _tags: [
            'source:happyfox',
            `status:${ticket.status?.name || 'unknown'}`,
            `priority:${ticket.priority?.name || 'unknown'}`
          ]
        }
        
        console.log('🔍 Algolia record to index:', JSON.stringify(searchRecord, null, 2))
        
        await algoliaService.indexTicket(searchRecord)
        console.log('✅ Step 3 complete: Indexed in Algolia')

        return NextResponse.json({
          success: true,
          message: 'Successfully processed 1 HappyFox ticket',
          data: {
            ticket: {
              id: ticket.id,
              subject: ticket.subject,
              status: ticket.status?.name,
              priority: ticket.priority?.name
            },
            firestoreDoc: ticket.id.toString(),
            algoliaObjectId: `happyfox_${ticket.id}`
          }
        })
        
      } catch (error) {
        console.error('❌ One-ticket test failed:', error)
        return NextResponse.json({
          success: false,
          error: {
            code: 'ONE_TICKET_TEST_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        }, { status: 500 })
      }
    }

    if (action === 'check-algolia-indexes') {
      // Check what's in our Algolia indexes
      try {
        console.log('🔍 Checking Algolia indexes...')
        
        const { AlgoliaSearchService } = await import('@/lib/services/search/algolia-search-service')
        const algoliaService = new AlgoliaSearchService()
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: Record<string, any> = {}
        
        // Check tickets index
        try {
          console.log('📋 Checking tickets index...')
          const ticketsResults = await algoliaService.searchTickets('', {}, { hitsPerPage: 10 })
          results.tickets = {
            totalHits: ticketsResults.totalHits,
            hits: ticketsResults.hits.map(hit => ({
              objectID: hit.objectID,
              source: hit.source,
              title: hit.title,
              status: hit.status
            }))
          }
        } catch (error) {
          results.tickets = { error: error instanceof Error ? error.message : 'Unknown error' }
        }
        
        // Check issues index  
        try {
          console.log('📋 Checking issues index...')
          const issuesResults = await algoliaService.searchIssues('', {}, { hitsPerPage: 10 })
          results.issues = {
            totalHits: issuesResults.totalHits,
            hits: issuesResults.hits.map(hit => ({
              objectID: hit.objectID,
              source: hit.source,
              title: hit.title,
              status: hit.status
            }))
          }
        } catch (error) {
          results.issues = { error: error instanceof Error ? error.message : 'Unknown error' }
        }
        
        // Check comments index
        try {
          console.log('📋 Checking comments index...')
          const commentsResults = await algoliaService.searchComments('', {}, { hitsPerPage: 10 })
          results.comments = {
            totalHits: commentsResults.totalHits,
            hits: commentsResults.hits.map(hit => ({
              objectID: hit.objectID,
              source: hit.source,
              title: hit.title
            }))
          }
        } catch (error) {
          results.comments = { error: error instanceof Error ? error.message : 'Unknown error' }
        }
        
        // Search specifically for our HappyFox ticket
        try {
          console.log('🎫 Searching for HappyFox tickets...')
          const happyfoxResults = await algoliaService.searchTickets('happyfox', {}, { hitsPerPage: 10 })
          results.happyfoxSearch = {
            totalHits: happyfoxResults.totalHits,
            hits: happyfoxResults.hits.map(hit => ({
              objectID: hit.objectID,
              source: hit.source,
              title: hit.title,
              status: hit.status
            }))
          }
        } catch (error) {
          results.happyfoxSearch = { error: error instanceof Error ? error.message : 'Unknown error' }
        }
        
        console.log('✅ Algolia index check completed')
        
        return NextResponse.json({
          success: true,
          data: results
        })
        
      } catch (error) {
        console.error('❌ Algolia index check failed:', error)
        return NextResponse.json({
          success: false,
          error: {
            code: 'ALGOLIA_CHECK_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }, { status: 500 })
      }
    }

    if (action === 'batch-ticket-test') {
      // Test batch processing of 5 HappyFox tickets
      try {
        console.log('🧪 Starting batch ticket test (5 tickets)')
        
        // Step 1: Fetch 5 tickets from HappyFox API
        console.log('📡 Step 1: Fetching 5 tickets from HappyFox...')
        const apiKey = process.env.HAPPYFOX_API_KEY
        const apiSecret = process.env.HAPPYFOX_API_SECRET
        
        if (!apiKey || !apiSecret) {
          throw new Error('HappyFox API credentials not configured')
        }

        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
        const url = 'https://support.hapana.com/api/1.1/json/tickets/?page=1&size=5'
        
        console.log(`📞 Calling: ${url}`)
        const response = await fetch(url, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`HappyFox API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        const tickets = data.data || data.tickets || data
        if (!Array.isArray(tickets) || tickets.length === 0) {
          throw new Error('No tickets found in API response')
        }

        console.log(`✅ Step 1 complete: Fetched ${tickets.length} tickets`)

        // Step 2: Batch save to Firestore
        console.log('💾 Step 2: Batch saving to Firestore...')
        const { getAdminDb } = await import('@/firebase/firebase-admin')
        const adminDb = getAdminDb()
        const { FieldValue } = await import('firebase-admin/firestore')
        
        const batch = adminDb.batch()
        const searchRecords = []

        for (const ticket of tickets) {
          console.log(`🎫 Processing ticket ${ticket.id}: ${ticket.subject}`)
          
          const firestoreTicket = {
            ticketId: ticket.id.toString(),
            status: ticket.status?.name || 'unknown',
            priority: ticket.priority?.name || 'unknown',
            subject: ticket.subject || '',
            customerName: ticket.user?.name || 'unknown',
            customerEmail: ticket.user?.email || '',
            created: FieldValue.serverTimestamp(),
            lastUpdated: FieldValue.serverTimestamp(),
            // Simplified - no complex brand/location/customer extraction
            brandName: 'Hapana', // Default brand
            locationName: 'Unknown Location', // Default location
            rawData: ticket
          }
          
          // Add to Firestore batch
          const docRef = adminDb.collection('happyfox-tickets').doc(ticket.id.toString())
          batch.set(docRef, firestoreTicket)
          
          // Prepare Algolia record
          const searchRecord = {
            objectID: `happyfox_${ticket.id}`,
            source: 'happyfox',
            ticketId: ticket.id.toString(),
            title: ticket.subject || '',
            content: ticket.first_message || ticket.text || '',
            status: ticket.status?.name || 'unknown',
            priority: ticket.priority?.name || 'unknown',
            customer: ticket.user?.name || 'unknown',
            customerEmail: ticket.user?.email || '',
            created: new Date(ticket.created_at).getTime(),
            updated: new Date(ticket.updated_at).getTime(),
            _tags: [
              'source:happyfox',
              `status:${ticket.status?.name || 'unknown'}`,
              `priority:${ticket.priority?.name || 'unknown'}`
            ]
          }
          searchRecords.push(searchRecord)
        }

        console.log(`💾 Committing Firestore batch with ${tickets.length} tickets`)
        await batch.commit()
        console.log('✅ Step 2 complete: Batch saved to Firestore')

        // Step 3: Batch index in Algolia
        console.log('🔍 Step 3: Batch indexing in Algolia...')
        const { AlgoliaSearchService } = await import('@/lib/services/search/algolia-search-service')
        const algoliaService = new AlgoliaSearchService()
        
        for (const record of searchRecords) {
          await algoliaService.indexTicket(record)
        }
        console.log('✅ Step 3 complete: Batch indexed in Algolia')

        return NextResponse.json({
          success: true,
          message: `Successfully processed ${tickets.length} HappyFox tickets in batch`,
          data: {
            processed: tickets.length,
            tickets: tickets.map(ticket => ({
              id: ticket.id,
              subject: ticket.subject,
              status: ticket.status?.name,
              priority: ticket.priority?.name
            })),
            firestoreCollection: 'happyfox-tickets',
            algoliaIndex: 'tickets'
          }
        })
        
      } catch (error) {
        console.error('❌ Batch ticket test failed:', error)
        return NextResponse.json({
          success: false,
          error: {
            code: 'BATCH_TICKET_TEST_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          }
        }, { status: 500 })
      }
    }

    if (action === 'test-search') {
      // Test the search functionality that the support page uses
      try {
        console.log('🔍 Testing search functionality...')
        
        const { query = 'mobile' } = body
        console.log(`🔎 Searching for: "${query}"`)
        
        const { AlgoliaSearchService } = await import('@/lib/services/search/algolia-search-service')
        const algoliaService = new AlgoliaSearchService()
        
        // Test the search that the support page would use
        const searchResults = await algoliaService.searchTickets(query, {}, { hitsPerPage: 10 })
        
        console.log(`✅ Search completed: ${searchResults.hits.length} results found`)
        
        return NextResponse.json({
          success: true,
          data: {
            query: query,
            totalHits: searchResults.totalHits,
            processingTime: searchResults.processingTimeMS,
            results: searchResults.hits.map(hit => ({
              objectID: hit.objectID,
              source: hit.source,
              title: hit.title,
              content: hit.content.substring(0, 200) + (hit.content.length > 200 ? '...' : ''),
              status: hit.status,
              priority: hit.priority,
              customer: hit.highlights?.title || hit.title,
              url: hit.url
            }))
          }
        })
        
      } catch (error) {
        console.error('❌ Search test failed:', error)
        return NextResponse.json({
          success: false,
          error: {
            code: 'SEARCH_TEST_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }, { status: 500 })
      }
    }

    if (action === 'full-happyfox-sync') {
      // Full sync of all HappyFox tickets
      try {
        console.log('🚀 Starting FULL HappyFox sync...')
        
        const apiKey = process.env.HAPPYFOX_API_KEY
        const apiSecret = process.env.HAPPYFOX_API_SECRET
        
        if (!apiKey || !apiSecret) {
          throw new Error('HappyFox API credentials not configured')
        }

        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
        const baseUrl = 'https://support.hapana.com/api/1.1/json/tickets/'
        
        const allTickets = []
        let page = 1
        let hasMore = true
        const maxPages = 20 // Reasonable limit to prevent infinite loops
        const pageSize = 50 // HappyFox max per page

        // Step 1: Fetch ALL tickets from HappyFox API
        console.log('📡 Step 1: Fetching ALL tickets from HappyFox...')
        
        while (hasMore && page <= maxPages) {
          console.log(`📞 Fetching page ${page}...`)
          
          const url = `${baseUrl}?page=${page}&size=${pageSize}`
          const response = await fetch(url, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          })

          if (!response.ok) {
            throw new Error(`HappyFox API error on page ${page}: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()
          const tickets = data.data || data.tickets || data
          
          if (!Array.isArray(tickets) || tickets.length === 0) {
            console.log(`📄 Page ${page}: No more tickets found`)
            hasMore = false
            break
          }

          console.log(`📄 Page ${page}: Found ${tickets.length} tickets`)
          allTickets.push(...tickets)
          
          // Check if we've reached the end
          if (tickets.length < pageSize) {
            console.log(`📄 Page ${page}: Last page (fewer tickets than page size)`)
            hasMore = false
          } else {
            page++
            // Rate limiting - be respectful to HappyFox API
            console.log('⏱️ Waiting 500ms before next API call...')
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }

        console.log(`✅ Step 1 complete: Fetched ${allTickets.length} total tickets from ${page} pages`)

        if (allTickets.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No tickets found to sync',
            data: { processed: 0, pages: page - 1 }
          })
        }

        // Step 2: Process tickets in batches
        console.log('💾 Step 2: Processing tickets in batches...')
        const BATCH_SIZE = 10 // Even more conservative batch size
        const { getAdminDb } = await import('@/firebase/firebase-admin')
        const adminDb = getAdminDb()
        const { FieldValue } = await import('firebase-admin/firestore')
        const { AlgoliaSearchService } = await import('@/lib/services/search/algolia-search-service')
        const algoliaService = new AlgoliaSearchService()

        let totalProcessed = 0
        let totalErrors = 0
        const batchCount = Math.ceil(allTickets.length / BATCH_SIZE)

        for (let i = 0; i < allTickets.length; i += BATCH_SIZE) {
          const batchTickets = allTickets.slice(i, i + BATCH_SIZE)
          const currentBatch = Math.floor(i / BATCH_SIZE) + 1
          
          console.log(`🔄 Processing batch ${currentBatch}/${batchCount} (${batchTickets.length} tickets)`)

          try {
            // Process each ticket individually within the batch to isolate errors
            const successfulTickets = []
            const failedTickets = []

            for (const ticket of batchTickets) {
              try {
                // Validate ticket data first
                if (!ticket || !ticket.id) {
                  console.log(`⚠️ Skipping invalid ticket:`, ticket)
                  failedTickets.push(ticket)
                  continue
                }

                // Create Firestore document for this ticket
                const firestoreTicket = {
                  ticketId: ticket.id.toString(),
                  status: ticket.status?.name || 'unknown',
                  priority: ticket.priority?.name || 'unknown',
                  subject: ticket.subject || '',
                  customerName: ticket.user?.name || 'unknown',
                  customerEmail: ticket.user?.email || '',
                  created: FieldValue.serverTimestamp(),
                  lastUpdated: FieldValue.serverTimestamp(),
                  brandName: 'Hapana',
                  locationName: 'Unknown Location',
                  rawData: ticket
                }

                // Save to Firestore individually
                await adminDb.collection('happyfox-tickets').doc(ticket.id.toString()).set(firestoreTicket)

                // Create Algolia record
                const searchRecord = {
                  objectID: `happyfox_${ticket.id}`,
                  source: 'happyfox',
                  ticketId: ticket.id.toString(),
                  title: ticket.subject || '',
                  content: ticket.first_message || ticket.text || '',
                  status: ticket.status?.name || 'unknown',
                  priority: ticket.priority?.name || 'unknown',
                  customer: ticket.user?.name || 'unknown',
                  customerEmail: ticket.user?.email || '',
                  created: new Date(ticket.created_at).getTime(),
                  updated: new Date(ticket.updated_at).getTime(),
                  _tags: [
                    'source:happyfox',
                    `status:${ticket.status?.name || 'unknown'}`,
                    `priority:${ticket.priority?.name || 'unknown'}`
                  ]
                }

                // Index in Algolia individually
                await algoliaService.indexTicket(searchRecord)

                successfulTickets.push(ticket)
                console.log(`✅ Ticket ${ticket.id} processed successfully`)

              } catch (ticketError) {
                console.error(`❌ Failed to process ticket ${ticket?.id}:`, ticketError)
                failedTickets.push(ticket)
              }
            }

            totalProcessed += successfulTickets.length
            totalErrors += failedTickets.length

            console.log(`📊 Batch ${currentBatch}: ${successfulTickets.length} successful, ${failedTickets.length} failed`)

          } catch (batchError) {
            console.error(`❌ Entire batch ${currentBatch} failed:`, batchError)
            totalErrors += batchTickets.length
          }

          // Progress update
          console.log(`📊 Overall progress: ${totalProcessed}/${allTickets.length} processed, ${totalErrors} errors`)

          // Rate limiting between batches
          if (i + BATCH_SIZE < allTickets.length) {
            console.log('⏱️ Waiting 1 second before next batch...')
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        console.log(`✅ FULL SYNC COMPLETE: ${totalProcessed} tickets processed, ${totalErrors} errors`);

        return NextResponse.json({
          success: true,
          message: 'Full HappyFox sync completed',
          data: {
            totalTickets: allTickets.length,
            processed: totalProcessed,
            errors: totalErrors,
            pages: page - 1
          }
        });

      } catch (error) {
        console.error('❌ Full HappyFox sync failed:', error);
        return NextResponse.json({
          success: false,
          error: {
            code: 'FULL_SYNC_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }, { status: 500 });
      }
    }

    // Default response for unknown actions
    return NextResponse.json({
      success: false,
      error: 'Unknown action',
      availableActions: [
        'test-firestore',
        'test-algolia',
        'test-happyfox',
        'sync-happyfox',
        'check-algolia-indexes',
        'test-search',
        'full-happyfox-sync'
      ]
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Sync API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Sync API',
    description: 'Manage data synchronization between HappyFox, Firestore, and Algolia',
    availableActions: [
      'test-firestore',
      'test-algolia', 
      'test-happyfox',
      'sync-happyfox',
      'check-algolia-indexes',
      'test-search',
      'full-happyfox-sync'
    ],
    usage: {
      method: 'POST',
      body: {
        action: 'string (required)',
        query: 'string (optional, for search tests)',
        limit: 'number (optional, for pagination)'
      }
    }
  });
}