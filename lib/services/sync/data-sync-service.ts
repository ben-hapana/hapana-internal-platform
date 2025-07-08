/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { firestoreService } from '../issue-intelligence/firestore-service'
import { 
  HappyFoxTicketRef, 
  HappyFoxTicketUpdate, 
  JiraTicketRef,
  JiraTicketComment, 
  SyncState,
  SearchIndexMetadata,
  BrandReference,
  LocationReference,
  CustomerReference
} from '@/lib/types/issue-intelligence'
import { Timestamp } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'

// Algolia indexing is now handled by AlgoliaSearchService

export class DataSyncService {
  constructor() {
    // DataSyncService now uses AlgoliaSearchService for indexing
    // No direct Algolia client initialization needed
  }

  // ============ HAPPYFOX SYNC ============

  async syncHappyFoxData(fullSync: boolean = false): Promise<void> {
    console.log('🚀 Starting HappyFox sync process', { fullSync })
    
    const syncState = await this.getSyncState('happyfox')
    const startTime = new Date()
    
    try {
      await this.updateSyncStatus('happyfox', 'syncing')
      console.log('📊 Updated sync status to syncing')
      
      // Get tickets from HappyFox API
      console.log('📡 Fetching tickets from HappyFox API...')
      const tickets = await this.fetchHappyFoxTickets(fullSync ? undefined : syncState?.lastSyncTimestamp)
      console.log(`✅ Fetched ${tickets.length} tickets from HappyFox API`)
      
      if (tickets.length === 0) {
        console.log('ℹ️ No tickets to sync, finishing process')
        await this.updateSyncStatus('happyfox', 'idle')
        return
      }

      let processed = 0
      let errors = 0

      // Process tickets in batches to avoid Firestore limits
      const BATCH_SIZE = 10 // Firestore batch limit is 500, but we'll be conservative
      console.log(`📦 Processing ${tickets.length} tickets in batches of ${BATCH_SIZE}`)

      for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
        const batchTickets = tickets.slice(i, i + BATCH_SIZE)
        console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tickets.length / BATCH_SIZE)} (${batchTickets.length} tickets)`)

        try {
          await this.processBatchHappyFoxTickets(batchTickets)
          processed += batchTickets.length
          console.log(`✅ Successfully processed batch with ${batchTickets.length} tickets`)
        } catch (error) {
          console.error(`❌ Failed to process batch:`, error)
          errors += batchTickets.length
          
          // Try processing tickets individually in case of batch failure
          console.log('🔄 Attempting individual ticket processing for failed batch...')
          for (const ticket of batchTickets) {
            try {
              await this.syncHappyFoxTicket(ticket)
              console.log(`✅ Individual sync successful for ticket ${ticket.id}`)
              processed++
              errors-- // Reduce error count since this one succeeded
            } catch (individualError) {
              console.error(`❌ Individual sync failed for ticket ${ticket.id}:`, individualError)
            }
          }
        }

        // Add a small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < tickets.length) {
          console.log('⏱️ Waiting 100ms before next batch...')
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      console.log(`📈 Sync completed: ${processed} processed, ${errors} errors`)

      // Update sync state
      await this.updateSyncState('happyfox', {
        lastSyncTimestamp: Timestamp.fromDate(startTime) as any,
        syncStatus: 'idle',
        totalProcessed: (syncState?.totalProcessed || 0) + processed,
        totalErrors: (syncState?.totalErrors || 0) + errors,
        syncBatch: {
          batchId: `happyfox_${Date.now()}`,
          startTime: Timestamp.fromDate(startTime) as any,
          endTime: Timestamp.now() as any,
          recordsProcessed: processed,
          recordsSkipped: 0,
          recordsErrored: errors
        }
      })

      console.log('✅ HappyFox sync process completed successfully')

    } catch (error) {
      console.error('❌ HappyFox sync process failed:', error)
      await this.updateSyncStatus('happyfox', 'error', error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  async processBatchHappyFoxTickets(tickets: any[]): Promise<void> {
    console.log(`📦 Starting batch processing of ${tickets.length} HappyFox tickets`)
    
    // Import Firestore admin for batch operations
    const { adminDb } = await import('@/firebase/firebase-admin')
    const batch = adminDb.batch()
    
    const searchRecords: any[] = []
    let batchOperations = 0

    for (const ticketData of tickets) {
      try {
        console.log(`🎫 Processing ticket ${ticketData.id}: ${ticketData.subject}`)
        
        // Transform HappyFox API data to our format
        const ticket: HappyFoxTicketRef = {
          ticketId: ticketData.id.toString(),
          status: ticketData.status.name,
          priority: ticketData.priority.name,
          brand: await this.extractBrandFromHappyFoxTicket(ticketData),
          location: await this.extractLocationFromHappyFoxTicket(ticketData),
          customer: await this.extractCustomerFromHappyFoxTicket(ticketData),
          created: Timestamp.fromDate(new Date(ticketData.created_at)) as any,
          lastUpdated: Timestamp.fromDate(new Date(ticketData.updated_at)) as any
        }

        // Add to Firestore batch
        const ticketRef = adminDb.collection('happyfox-tickets').doc(ticket.ticketId)
        batch.set(ticketRef, {
          ...ticket,
          lastUpdated: FieldValue.serverTimestamp()
        })
        batchOperations++

        // Prepare Algolia search record
        const searchableRecord = {
          objectID: `happyfox_${ticketData.id}`,
          source: 'happyfox',
          ticketId: ticketData.id.toString(),
          title: ticketData.subject,
          content: ticketData.first_message || ticketData.text || '',
          status: ticketData.status.name,
          priority: ticketData.priority.name,
          customer: ticketData.user.name,
          customerEmail: ticketData.user.email,
          tags: ticketData.tags ? ticketData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
          created: new Date(ticketData.created_at).getTime(),
          updated: new Date(ticketData.last_updated_at || ticketData.updated_at).getTime(),
          _tags: [
            `source:happyfox`,
            `status:${ticketData.status.name}`,
            `priority:${ticketData.priority.name}`,
            ...(ticketData.tags ? ticketData.tags.split(',').map((tag: string) => `tag:${tag.trim()}`).filter(Boolean) : [])
          ]
        }
        searchRecords.push(searchableRecord)

        console.log(`✅ Prepared ticket ${ticketData.id} for batch processing`)

      } catch (error) {
        console.error(`❌ Failed to prepare ticket ${ticketData.id} for batch:`, error)
        throw error
      }
    }

    console.log(`💾 Committing Firestore batch with ${batchOperations} operations`)
    
    // Commit the Firestore batch
    await batch.commit()
    console.log('✅ Firestore batch committed successfully')

    // Index in Algolia (do this after Firestore to avoid conflicts)
    if (searchRecords.length > 0) {
      console.log(`🔍 Indexing ${searchRecords.length} records in Algolia`)
      try {
        const { AlgoliaSearchService } = await import('../search/algolia-search-service')
        const algoliaService = new AlgoliaSearchService()
        
        // Batch index in Algolia
        for (const record of searchRecords) {
          await algoliaService.indexTicket(record)
        }
        console.log('✅ Algolia indexing completed')
      } catch (error) {
        console.log('⚠️ Algolia indexing failed (continuing anyway):', error instanceof Error ? error.message : 'Unknown error')
      }
    }

    console.log(`✅ Batch processing completed for ${tickets.length} tickets`)
  }

  async syncHappyFoxTicket(ticketData: any): Promise<void> {
    console.log(`🎫 Syncing individual HappyFox ticket ${ticketData.id}`)
    
    try {
      console.log('📋 Extracting brand information...')
      const brand = await this.extractBrandFromHappyFoxTicket(ticketData)
      console.log('✅ Brand extracted:', brand)

      console.log('📍 Extracting location information...')
      const location = await this.extractLocationFromHappyFoxTicket(ticketData)
      console.log('✅ Location extracted:', location)

      console.log('👤 Extracting customer information...')
      const customer = await this.extractCustomerFromHappyFoxTicket(ticketData)
      console.log('✅ Customer extracted:', customer)

      console.log('🏗️ Creating ticket object...')
      // Transform HappyFox API data to our format
      const ticket: HappyFoxTicketRef = {
        ticketId: ticketData.id.toString(),
        status: ticketData.status.name,
        priority: ticketData.priority.name,
        brand: brand,
        location: location,
        customer: customer,
        created: Timestamp.fromDate(new Date(ticketData.created_at)) as any,
        lastUpdated: Timestamp.fromDate(new Date(ticketData.updated_at)) as any
      }
      console.log('✅ Ticket object created:', JSON.stringify(ticket, null, 2))

      console.log(`💾 Saving ticket ${ticketData.id} to Firestore`)
      await firestoreService.createHappyFoxTicket(ticket)
      console.log(`✅ Ticket ${ticketData.id} saved to Firestore`)

      // Index in Algolia
      try {
        console.log(`🔍 Indexing ticket ${ticketData.id} in Algolia`)
        await this.indexHappyFoxTicketInAlgolia(ticketData)
        console.log(`✅ Ticket ${ticketData.id} indexed in Algolia`)
      } catch (error) {
        console.log(`⚠️ Algolia indexing failed for ticket ${ticketData.id}:`, error instanceof Error ? error.message : 'Unknown error')
      }

    } catch (error) {
      console.error(`❌ Error in syncHappyFoxTicket for ticket ${ticketData.id}:`, error)
      console.error('📊 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ticketData: {
          id: ticketData.id,
          subject: ticketData.subject,
          status: ticketData.status,
          priority: ticketData.priority,
          user: ticketData.user
        }
      })
      throw error
    }
  }

  async syncHappyFoxTicketUpdates(ticketId: string): Promise<void> {
    // Fetch updates from HappyFox API
    const updates = await this.fetchHappyFoxTicketUpdates(ticketId)
    
    for (const updateData of updates) {
      const update: Omit<HappyFoxTicketUpdate, 'id'> = {
        ticketId: ticketId,
        type: this.mapHappyFoxUpdateType(updateData.type),
        content: updateData.text || updateData.message,
        htmlContent: updateData.html_text,
        author: {
          id: updateData.user.id.toString(),
          name: updateData.user.name,
          email: updateData.user.email,
          type: updateData.user.is_staff ? 'staff' : 'customer'
        },
        isPublic: updateData.is_public || false,
        attachments: [], // Will be synced separately
        created: Timestamp.fromDate(new Date(updateData.created_at)) as any,
        metadata: this.extractUpdateMetadata(updateData)
      }

      await firestoreService.createHappyFoxTicketUpdate(update)
    }
  }

  // ============ JIRA SYNC ============

  async syncJiraData(fullSync: boolean = false): Promise<void> {
    const syncState = await this.getSyncState('jira')
    const startTime = new Date()
    
    try {
      await this.updateSyncStatus('jira', 'syncing')
      
      // Get tickets from Jira API
      const tickets = await this.fetchJiraTickets(fullSync ? undefined : syncState?.lastSyncTimestamp)
      
      let processed = 0
      let errors = 0

      for (const ticket of tickets) {
        try {
          // Sync main ticket
          await this.syncJiraTicket(ticket)
          
          // Sync comments
          await this.syncJiraTicketComments(ticket.key)
          
          // Sync attachments
          await this.syncJiraAttachments(ticket.key)
          
          // Index in Algolia (skip if credentials not configured)
          try {
            await this.indexJiraTicketInAlgolia(ticket)
          } catch (error) {
            console.log('Skipping Algolia indexing:', error instanceof Error ? error.message : 'Unknown error')
          }
          
          processed++
        } catch (error) {
          console.error(`Failed to sync Jira ticket ${ticket.key}:`, error)
          errors++
        }
      }

      // Update sync state
      await this.updateSyncState('jira', {
        lastSyncTimestamp: Timestamp.fromDate(startTime) as any,
        syncStatus: 'idle',
        totalProcessed: (syncState?.totalProcessed || 0) + processed,
        totalErrors: (syncState?.totalErrors || 0) + errors,
        syncBatch: {
          batchId: `jira_${Date.now()}`,
          startTime: Timestamp.fromDate(startTime) as any,
          endTime: Timestamp.now() as any,
          recordsProcessed: processed,
          recordsSkipped: 0,
          recordsErrored: errors
        }
      })

    } catch (error) {
      await this.updateSyncStatus('jira', 'error', error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  async syncJiraTicketComments(ticketKey: string): Promise<void> {
    const comments = await this.fetchJiraTicketComments(ticketKey)
    
    for (const commentData of comments) {
      const comment: Omit<JiraTicketComment, 'id'> = {
        ticketKey: ticketKey,
        content: commentData.body,
        author: {
          accountId: commentData.author.accountId,
          displayName: commentData.author.displayName,
          emailAddress: commentData.author.emailAddress,
          avatarUrl: commentData.author.avatarUrls?.['48x48']
        },
        created: Timestamp.fromDate(new Date(commentData.created)) as any,
        updated: Timestamp.fromDate(new Date(commentData.updated)) as any,
        visibility: commentData.visibility,
        isInternal: !!commentData.visibility
      }

      await firestoreService.createJiraTicketComment(comment)
      
      // Index comment in Algolia for search (skip if credentials not configured)
      try {
        await this.indexJiraCommentInAlgolia(comment, ticketKey)
      } catch (error) {
        console.log('Skipping Algolia comment indexing:', error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  // ============ ALGOLIA INDEXING ============

  async indexHappyFoxTicketInAlgolia(ticket: any): Promise<void> {
    const searchableRecord = {
      objectID: `happyfox_${ticket.id}`,
      source: 'happyfox',
      ticketId: ticket.id.toString(),
      title: ticket.subject,
      content: ticket.first_message || ticket.text || '',
      status: ticket.status.name,
      priority: ticket.priority.name,
      customer: ticket.user.name,
      customerEmail: ticket.user.email,
      tags: ticket.tags ? ticket.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
      created: new Date(ticket.created_at).getTime(),
      updated: new Date(ticket.last_updated_at || ticket.updated_at).getTime(),
      // Facets for filtering
      _tags: [
        `source:happyfox`,
        `status:${ticket.status.name}`,
        `priority:${ticket.priority.name}`,
        ...(ticket.tags ? ticket.tags.split(',').map((tag: string) => `tag:${tag.trim()}`).filter(Boolean) : [])
      ]
    }

    // Use the AlgoliaSearchService to index the ticket
    const { AlgoliaSearchService } = await import('../search/algolia-search-service')
    const algoliaService = new AlgoliaSearchService()
    await algoliaService.indexTicket(searchableRecord)
    
    // Save metadata
    await this.saveSearchIndexMetadata('tickets', `happyfox_${ticket.id}`, 'happyfox-tickets', ticket.id.toString())
  }

  async indexJiraTicketInAlgolia(ticket: any): Promise<void> {
    const searchableRecord = {
      objectID: `jira_${ticket.key}`,
      source: 'jira',
      ticketKey: ticket.key,
      title: ticket.fields.summary,
      content: ticket.fields.description || '',
      status: ticket.fields.status.name,
      priority: ticket.fields.priority.name,
      assignee: ticket.fields.assignee?.displayName,
      reporter: ticket.fields.reporter.displayName,
      project: ticket.fields.project.name,
      labels: ticket.fields.labels || [],
      created: new Date(ticket.fields.created).getTime(),
      updated: new Date(ticket.fields.updated).getTime(),
      // Facets for filtering
      _tags: [
        `source:jira`,
        `status:${ticket.fields.status.name}`,
        `priority:${ticket.fields.priority.name}`,
        `project:${ticket.fields.project.key}`,
        ...(ticket.fields.labels || []).map((label: string) => `label:${label}`)
      ]
    }

    // Use the AlgoliaSearchService to index the ticket
    const { AlgoliaSearchService } = await import('../search/algolia-search-service')
    const algoliaService = new AlgoliaSearchService()
    await algoliaService.indexTicket(searchableRecord)
    
    // Save metadata
    await this.saveSearchIndexMetadata('tickets', `jira_${ticket.key}`, 'jira-tickets', ticket.key)
  }

  async indexJiraCommentInAlgolia(comment: Omit<JiraTicketComment, 'id'>, ticketKey: string): Promise<void> {
    const searchableRecord = {
      objectID: `jira_comment_${ticketKey}_${Date.now()}`,
      source: 'jira',
      type: 'comment',
      ticketKey: ticketKey,
      content: comment.content,
      author: comment.author.displayName,
      authorEmail: comment.author.emailAddress,
      created: comment.created.toDate().getTime(),
      updated: comment.updated.toDate().getTime(),
      isInternal: comment.isInternal,
      _tags: [
        `source:jira`,
        `type:comment`,
        `ticket:${ticketKey}`,
        `internal:${comment.isInternal}`
      ]
    }

    // Use the AlgoliaSearchService to index the comment
    const { AlgoliaSearchService } = await import('../search/algolia-search-service')
    const algoliaService = new AlgoliaSearchService()
    await algoliaService.indexComment(searchableRecord)
  }

  // ============ HELPER METHODS ============

  private async getSyncState(id: 'happyfox' | 'jira'): Promise<SyncState | null> {
    return await firestoreService.getSyncState(id)
  }

  async getSyncStatus(id: 'happyfox' | 'jira'): Promise<SyncState | null> {
    return await this.getSyncState(id)
  }

  // Missing sync methods referenced in the main sync functions
  private async syncHappyFoxAttachments(ticketId: string): Promise<void> {
    // TODO: Implement HappyFox attachments sync
    console.log(`Syncing HappyFox attachments for ticket ${ticketId}`)
  }

  private async syncJiraTicket(ticket: any): Promise<void> {
    // Transform Jira API data to our format
    const jiraTicket: JiraTicketRef = {
      key: ticket.key,
      issueId: ticket.id,
      status: ticket.fields.status.name,
      priority: ticket.fields.priority.name,
      assignee: ticket.fields.assignee?.displayName || 'Unassigned',
      affectedBrands: [], // Will be populated based on custom fields or project mapping
      created: Timestamp.fromDate(new Date(ticket.fields.created)) as any,
      lastUpdated: Timestamp.fromDate(new Date(ticket.fields.updated)) as any
    }

    await firestoreService.createJiraTicket(jiraTicket)
  }

  private async syncJiraAttachments(ticketKey: string): Promise<void> {
    // TODO: Implement Jira attachments sync
    console.log(`Syncing Jira attachments for ticket ${ticketKey}`)
  }

  private async updateSyncStatus(id: 'happyfox' | 'jira', status: SyncState['syncStatus'], errorMessage?: string): Promise<void> {
    const existing = await this.getSyncState(id)
    const syncState: SyncState = {
      id,
      lastSyncTimestamp: (existing?.lastSyncTimestamp || Timestamp.now()) as any,
      syncStatus: status,
      ...(errorMessage && { errorMessage }),
      totalProcessed: existing?.totalProcessed || 0,
      totalErrors: existing?.totalErrors || 0,
      syncBatch: (existing?.syncBatch || {
        batchId: `${id}_${Date.now()}`,
        startTime: Timestamp.now() as any,
        recordsProcessed: 0,
        recordsSkipped: 0,
        recordsErrored: 0
      }) as any
    }

    await firestoreService.updateSyncState(syncState)
  }

  private async updateSyncState(id: 'happyfox' | 'jira', updates: Partial<SyncState>): Promise<void> {
    const existing = await this.getSyncState(id)
    const syncState: SyncState = {
      ...existing,
      id,
      ...updates
    } as SyncState

    await firestoreService.updateSyncState(syncState)
  }

  private async saveSearchIndexMetadata(indexName: string, objectId: string, sourceCollection: string, sourceDocumentId: string): Promise<void> {
    const metadata: Omit<SearchIndexMetadata, 'id'> = {
      algoliaObjectId: objectId,
      indexName: indexName as 'tickets' | 'issues' | 'comments',
      sourceCollection,
      sourceDocumentId,
      lastIndexed: Timestamp.now() as any,
      indexedFields: ['title', 'content', 'status', 'priority', 'tags'],
      searchableContent: '', // Will be populated based on the record
      facets: {
        source: sourceCollection.includes('happyfox') ? 'happyfox' : 'jira',
        status: '',
        priority: '',
        brandId: '',
        tags: []
      }
    }

    await firestoreService.createSearchIndexMetadata(metadata)
  }

  // ============ API INTEGRATION METHODS ============
  // These would call the actual HappyFox and Jira APIs

  private async fetchHappyFoxTickets(since?: Timestamp, batchSize: number = 50): Promise<any[]> {
    const apiKey = process.env.HAPPYFOX_API_KEY
    const apiSecret = process.env.HAPPYFOX_API_SECRET
    const subdomain = process.env.HAPPYFOX_SUBDOMAIN
    
    if (!apiKey || !apiSecret || !subdomain) {
      console.log('HappyFox API credentials not configured, using mock data')
      const { mockDataService } = await import('./mock-data-service')
      return mockDataService.generateMockHappyFoxTickets(batchSize)
    }

    const tickets: any[] = []
    let page = 1
    let hasMore = true
    const maxPages = 5 // Limit to 5 pages for now to avoid overwhelming the system
    
    // HappyFox uses Basic Auth with API key and secret
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    // Use the custom domain format that we know works
    // Based on testing, support.hapana.com is the correct domain
    const baseUrl = `https://support.hapana.com/api/1.1/json`
    
    console.log(`Fetching HappyFox tickets from: ${baseUrl}`)
    
    while (hasMore && page <= maxPages) {
      try {
        // HappyFox API endpoint for tickets
        const url = new URL(`${baseUrl}/tickets/`)
        url.searchParams.set('page', page.toString())
        url.searchParams.set('size', Math.min(batchSize, 50).toString()) // HappyFox max is usually 50
        
        if (since) {
          // HappyFox uses updated_since parameter with ISO format
          url.searchParams.set('updated_since', since.toDate().toISOString())
        }

        console.log(`Fetching page ${page}: ${url.toString()}`)

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`HappyFox API error: ${response.status} ${response.statusText}`, errorText)
          throw new Error(`HappyFox API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`HappyFox API response structure:`, Object.keys(data))
        
        // HappyFox typically returns tickets in a 'data' array
        if (data.data && Array.isArray(data.data)) {
          tickets.push(...data.data)
          hasMore = data.data.length === Math.min(batchSize, 50) && page < maxPages
          console.log(`Page ${page}: Found ${data.data.length} tickets`)
        } else if (Array.isArray(data)) {
          // Some APIs return tickets directly as an array
          tickets.push(...data)
          hasMore = data.length === Math.min(batchSize, 50) && page < maxPages
          console.log(`Page ${page}: Found ${data.length} tickets (direct array)`)
        } else {
          console.log(`No more tickets found. Response structure:`, data)
          hasMore = false
        }
        
        page++
        
        // Rate limiting - HappyFox allows 300 requests per minute
        await new Promise(resolve => setTimeout(resolve, 250))
        
      } catch (error) {
        console.error(`Failed to fetch HappyFox tickets page ${page}:`, error)
        
        // If it's the first page, throw the error. Otherwise, return what we have
        if (page === 1) {
          throw error
        } else {
          console.log(`Stopping pagination due to error on page ${page}. Returning ${tickets.length} tickets.`)
          break
        }
      }
    }

    console.log(`Total HappyFox tickets fetched: ${tickets.length}`)
    return tickets
  }

  private async fetchHappyFoxTicketUpdates(ticketId: string): Promise<any[]> {
    const baseUrl = process.env.HAPPYFOX_API_BASE_URL
    const apiKey = process.env.HAPPYFOX_API_KEY
    const apiSecret = process.env.HAPPYFOX_API_SECRET
    
    if (!baseUrl || !apiKey || !apiSecret) {
      console.log('HappyFox API credentials not configured, returning empty updates for mock data')
      return [] // Return empty updates for mock tickets
    }

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    
    try {
      const response = await fetch(`${baseUrl}/ticket/${ticketId}/`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HappyFox API error: ${response.status} ${response.statusText}`)
      }

      const ticketData = await response.json()
      return ticketData.updates || []
      
    } catch (error) {
      console.error(`Failed to fetch HappyFox ticket updates for ${ticketId}:`, error)
      throw error
    }
  }

  private async fetchJiraTickets(since?: Timestamp, batchSize: number = 100): Promise<any[]> {
    const baseUrl = process.env.JIRA_API_BASE_URL
    const email = process.env.JIRA_API_EMAIL
    const token = process.env.JIRA_API_TOKEN
    
    if (!baseUrl || !email || !token) {
      console.log('Jira API credentials not configured, using mock data')
      const { mockDataService } = await import('./mock-data-service')
      return mockDataService.generateMockJiraTickets(batchSize)
    }

    const tickets: any[] = []
    let startAt = 0
    let hasMore = true
    
    const auth = Buffer.from(`${email}:${token}`).toString('base64')
    
    while (hasMore) {
      try {
        let jql = 'ORDER BY updated DESC'
        
        if (since) {
          const sinceDate = since.toDate().toISOString().split('T')[0]
          jql = `updated >= "${sinceDate}" ORDER BY updated DESC`
        }

        const url = new URL(`${baseUrl}/rest/api/3/search`)
        url.searchParams.set('jql', jql)
        url.searchParams.set('startAt', startAt.toString())
        url.searchParams.set('maxResults', batchSize.toString())
        url.searchParams.set('expand', 'changelog')

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`Jira API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        
        if (data.issues && Array.isArray(data.issues)) {
          tickets.push(...data.issues)
          hasMore = data.issues.length === batchSize
          startAt += batchSize
        } else {
          hasMore = false
        }
        
        // Rate limiting - Jira Cloud allows 300 requests per minute
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (error) {
        console.error(`Failed to fetch Jira tickets starting at ${startAt}:`, error)
        throw error
      }
    }

    return tickets
  }

  private async fetchJiraTicketComments(ticketKey: string): Promise<any[]> {
    const baseUrl = process.env.JIRA_API_BASE_URL
    const email = process.env.JIRA_API_EMAIL
    const token = process.env.JIRA_API_TOKEN
    
    if (!baseUrl || !email || !token) {
      console.log('Jira API credentials not configured, returning empty comments for mock data')
      return [] // Return empty comments for mock tickets
    }

    const auth = Buffer.from(`${email}:${token}`).toString('base64')
    
    try {
      const response = await fetch(`${baseUrl}/rest/api/3/issue/${ticketKey}/comment`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Jira API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.comments || []
      
    } catch (error) {
      console.error(`Failed to fetch Jira comments for ${ticketKey}:`, error)
      throw error
    }
  }

  // ============ DATA TRANSFORMATION HELPERS ============

  private async extractBrandFromHappyFoxTicket(ticketData: any): Promise<BrandReference> {
    // Extract brand from custom fields or use default
    const brandCode = ticketData.custom_fields?.brand || 'HAP'
    
    // For demo purposes, map to our mock brands
    const brandMap: Record<string, BrandReference> = {
      'HAP': { id: 'hapana', name: 'Hapana Fitness', code: 'HAP', region: 'North America', memberCount: 2500 },
      'FIT': { id: 'fitplus', name: 'FitPlus Wellness', code: 'FIT', region: 'Europe', memberCount: 1800 },
      'WEL': { id: 'wellness', name: 'Wellness Centers', code: 'WEL', region: 'Asia Pacific', memberCount: 3200 }
    }
    
    return brandMap[brandCode] || brandMap['HAP']
  }

  private async extractLocationFromHappyFoxTicket(ticketData: any): Promise<LocationReference> {
    // Extract location from custom fields or use default
    const locationName = ticketData.custom_fields?.location || 'Downtown Hapana'
    
    // For demo purposes, map to our mock locations
    const locationMap: Record<string, LocationReference> = {
      'Downtown Hapana': { id: 'gym-001', name: 'Downtown Hapana', brandId: 'hapana', address: '123 Main St', memberCount: 450, services: ['gym', 'pool', 'classes'], timezone: 'America/New_York' },
      'Uptown Hapana': { id: 'gym-002', name: 'Uptown Hapana', brandId: 'hapana', address: '456 Oak Ave', memberCount: 380, services: ['gym', 'spa'], timezone: 'America/New_York' },
      'Central FitPlus': { id: 'fit-001', name: 'Central FitPlus', brandId: 'fitplus', address: '789 High St', memberCount: 320, services: ['gym', 'nutrition'], timezone: 'Europe/London' },
      'Tokyo Wellness': { id: 'wel-001', name: 'Tokyo Wellness', brandId: 'wellness', address: '321 Cherry Blvd', memberCount: 600, services: ['spa', 'meditation'], timezone: 'Asia/Tokyo' }
    }
    
    return locationMap[locationName] || locationMap['Downtown Hapana']
  }

  private async extractCustomerFromHappyFoxTicket(ticketData: any): Promise<CustomerReference> {
    // Transform HappyFox user data to CustomerReference
    // Extract brand and location info directly to avoid circular calls
    const brandCode = ticketData.custom_fields?.brand || 'HAP'
    const locationName = ticketData.custom_fields?.location || 'Downtown Hapana'
    
    // Simple mapping without additional async calls
    const brandId = brandCode === 'FIT' ? 'fitplus' : brandCode === 'WEL' ? 'wellness' : 'hapana'
    const locationId = locationName.includes('FitPlus') ? 'fit-001' : locationName.includes('Wellness') ? 'wel-001' : 'gym-001'
    
    return {
      id: ticketData.user.id.toString(),
      name: ticketData.user.name,
      email: ticketData.user.email,
      phone: ticketData.user.phone || undefined,
      brandId,
      locationId,
      tier: (ticketData.custom_fields?.member_tier as 'standard' | 'premium' | 'enterprise') || 'standard',
      membershipType: ticketData.custom_fields?.membership_type || 'monthly'
    }
  }

  private mapHappyFoxUpdateType(type: string): HappyFoxTicketUpdate['type'] {
    // Map HappyFox update types to our enum
    switch (type.toLowerCase()) {
      case 'note': return 'note'
      case 'reply': return 'reply'
      case 'status_change': return 'status_change'
      case 'assignment': return 'assignment'
      case 'priority_change': return 'priority_change'
      default: return 'note'
    }
  }

  private extractUpdateMetadata(updateData: any): HappyFoxTicketUpdate['metadata'] {
    // Extract metadata for status changes, assignments, etc.
    return undefined // TODO: Implement based on HappyFox API structure
  }
}

// Export singleton instance
export const dataSyncService = new DataSyncService() 