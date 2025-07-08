/* eslint-disable @typescript-eslint/no-explicit-any */
import { algoliasearch } from 'algoliasearch'
import type { SearchClient } from 'algoliasearch'

// Search result interfaces
export interface SearchResult {
  objectID: string
  source: 'happyfox' | 'jira' | 'issue'
  title: string
  content: string
  status: string
  priority: string
  created: number
  updated: number
  url?: string
  highlights?: {
    title?: string
    content?: string
  }
}

export interface SearchResponse {
  hits: SearchResult[]
  query: string
  totalHits: number
  processingTimeMS: number
  facets?: Record<string, Record<string, number>>
}

export interface SearchFilters {
  source?: ('happyfox' | 'jira' | 'issue')[]
  status?: string[]
  priority?: string[]
  dateRange?: {
    from: Date
    to: Date
  }
}

export class AlgoliaSearchService {
  private client: SearchClient | null = null
  private adminClient: SearchClient | null = null
  private isConfigured: boolean
  private isAdminConfigured: boolean
  private ticketsIndexName = 'tickets'
  private issuesIndexName = 'issues'  
  private commentsIndexName = 'comments'

  constructor() {
    this.isConfigured = !!(
      process.env.NEXT_PUBLIC_ALGOLIA_APP_ID && 
      process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY
    )
    
    this.isAdminConfigured = !!(
      process.env.NEXT_PUBLIC_ALGOLIA_APP_ID && 
      process.env.ALGOLIA_ADMIN_API_KEY
    )

    if (this.isConfigured) {
      this.client = algoliasearch(
        process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
        process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY!
      )
    }
    
    if (this.isAdminConfigured) {
      this.adminClient = algoliasearch(
        process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
        process.env.ALGOLIA_ADMIN_API_KEY!
      )
    }
  }

  private ensureConfigured(): void {
    if (!this.isConfigured || !this.client) {
      throw new Error('Algolia is not configured. Please check your environment variables.')
    }
  }
  
  private ensureAdminConfigured(): void {
    if (!this.isAdminConfigured || !this.adminClient) {
      throw new Error('Algolia admin is not configured. Please check your ALGOLIA_ADMIN_API_KEY environment variable.')
    }
  }

  /**
   * Search across all tickets (HappyFox + Jira)
   */
  async searchTickets(
    query: string, 
    filters?: SearchFilters,
    options?: {
      hitsPerPage?: number
      page?: number
    }
  ): Promise<SearchResponse> {
    this.ensureConfigured()

    const searchParams = {
      query,
      hitsPerPage: options?.hitsPerPage || 20,
      page: options?.page || 0,
      attributesToHighlight: ['title', 'content'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      facets: ['source', 'status', 'priority', '_tags'],
      ...this.buildAlgoliaFilters(filters)
    }

    const response = await this.client!.searchSingleIndex({
      indexName: this.ticketsIndexName,
      searchParams
    })
    
    return {
      hits: response.hits.map((hit: any) => this.transformTicketHit(hit)),
      query,
      totalHits: response.nbHits || 0,
      processingTimeMS: response.processingTimeMS || 0,
      facets: response.facets
    }
  }

  /**
   * Search across issues
   */
  async searchIssues(
    query: string,
    filters?: SearchFilters,
    options?: {
      hitsPerPage?: number
      page?: number
    }
  ): Promise<SearchResponse> {
    this.ensureConfigured()

    const searchParams = {
      query,
      hitsPerPage: options?.hitsPerPage || 20,
      page: options?.page || 0,
      attributesToHighlight: ['title', 'description'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      facets: ['status', 'priority', 'category', '_tags'],
      ...this.buildAlgoliaFilters(filters)
    }

    const response = await this.client!.searchSingleIndex({
      indexName: this.issuesIndexName,
      searchParams
    })
    
    return {
      hits: response.hits.map((hit: any) => this.transformIssueHit(hit)),
      query,
      totalHits: response.nbHits || 0,
      processingTimeMS: response.processingTimeMS || 0,
      facets: response.facets
    }
  }

  /**
   * Search across comments and updates
   */
  async searchComments(
    query: string,
    filters?: SearchFilters,
    options?: {
      hitsPerPage?: number
      page?: number
    }
  ): Promise<SearchResponse> {
    this.ensureConfigured()

    const searchParams = {
      query,
      hitsPerPage: options?.hitsPerPage || 20,
      page: options?.page || 0,
      attributesToHighlight: ['content'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      facets: ['source', 'type', '_tags'],
      ...this.buildAlgoliaFilters(filters)
    }

    const response = await this.client!.searchSingleIndex({
      indexName: this.commentsIndexName,
      searchParams
    })
    
    return {
      hits: response.hits.map((hit: any) => this.transformCommentHit(hit)),
      query,
      totalHits: response.nbHits || 0,
      processingTimeMS: response.processingTimeMS || 0,
      facets: response.facets
    }
  }

  /**
   * Universal search across all indexes
   */
  async searchAll(
    query: string,
    filters?: SearchFilters,
    options?: {
      hitsPerPage?: number
    }
  ): Promise<{
    tickets: SearchResponse
    issues: SearchResponse
    comments: SearchResponse
  }> {
    this.ensureConfigured()

    const hitsPerPage = options?.hitsPerPage || 10
    const algoliaFilters = this.buildAlgoliaFilters(filters)

    // Use the new multi-index search API
    const response = await this.client!.search({
      requests: [
        {
          indexName: this.ticketsIndexName,
          query,
          hitsPerPage,
          attributesToHighlight: ['title', 'content'],
          highlightPreTag: '<mark>',
          highlightPostTag: '</mark>',
          facets: ['source', 'status', 'priority', '_tags'],
          ...algoliaFilters
        },
        {
          indexName: this.issuesIndexName,
          query,
          hitsPerPage,
          attributesToHighlight: ['title', 'description'],
          highlightPreTag: '<mark>',
          highlightPostTag: '</mark>',
          facets: ['status', 'priority', 'category', '_tags'],
          ...algoliaFilters
        },
        {
          indexName: this.commentsIndexName,
          query,
          hitsPerPage,
          attributesToHighlight: ['content'],
          highlightPreTag: '<mark>',
          highlightPostTag: '</mark>',
          facets: ['source', 'type', '_tags'],
          ...algoliaFilters
        }
      ]
    })

    return {
      tickets: {
        hits: (response.results[0] as any).hits.map((hit: any) => this.transformTicketHit(hit)),
        query,
        totalHits: (response.results[0] as any).nbHits || 0,
        processingTimeMS: (response.results[0] as any).processingTimeMS || 0,
        facets: (response.results[0] as any).facets
      },
      issues: {
        hits: (response.results[1] as any).hits.map((hit: any) => this.transformIssueHit(hit)),
        query,
        totalHits: (response.results[1] as any).nbHits || 0,
        processingTimeMS: (response.results[1] as any).processingTimeMS || 0,
        facets: (response.results[1] as any).facets
      },
      comments: {
        hits: (response.results[2] as any).hits.map((hit: any) => this.transformCommentHit(hit)),
        query,
        totalHits: (response.results[2] as any).nbHits || 0,
        processingTimeMS: (response.results[2] as any).processingTimeMS || 0,
        facets: (response.results[2] as any).facets
      }
    }
  }

  /**
   * Get search suggestions/autocomplete
   */
  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (query.length < 2) return []
    
    this.ensureConfigured()

    const response = await this.client!.searchSingleIndex({
      indexName: this.ticketsIndexName,
      searchParams: {
        query,
        hitsPerPage: limit,
        attributesToRetrieve: ['title'],
        distinct: true
      }
    })

    return response.hits.map((hit: any) => hit.title).filter(Boolean)
  }

  /**
   * Index management methods for data synchronization
   */
  async indexTicket(ticket: any): Promise<void> {
    this.ensureAdminConfigured()
    
    await this.adminClient!.saveObject({
      indexName: this.ticketsIndexName,
      body: ticket
    })
  }

  async indexIssue(issue: any): Promise<void> {
    this.ensureAdminConfigured()
    
    await this.adminClient!.saveObject({
      indexName: this.issuesIndexName,
      body: issue
    })
  }

  async indexComment(comment: any): Promise<void> {
    this.ensureAdminConfigured()
    
    await this.adminClient!.saveObject({
      indexName: this.commentsIndexName,
      body: comment
    })
  }

  async batchIndexTickets(tickets: any[]): Promise<void> {
    this.ensureAdminConfigured()
    
    await this.adminClient!.saveObjects({
      indexName: this.ticketsIndexName,
      objects: tickets
    })
  }

  async batchIndexIssues(issues: any[]): Promise<void> {
    this.ensureAdminConfigured()
    
    await this.adminClient!.saveObjects({
      indexName: this.issuesIndexName,
      objects: issues
    })
  }

  async batchIndexComments(comments: any[]): Promise<void> {
    this.ensureAdminConfigured()
    
    await this.adminClient!.saveObjects({
      indexName: this.commentsIndexName,
      objects: comments
    })
  }

  async deleteFromIndex(indexName: string, objectID: string): Promise<void> {
    this.ensureAdminConfigured()
    
    await this.adminClient!.deleteObject({
      indexName,
      objectID
    })
  }

  async clearIndex(indexName: string): Promise<void> {
    this.ensureAdminConfigured()
    
    await this.adminClient!.clearObjects({
      indexName
    })
  }

  /**
   * Test the Algolia connection and API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      this.ensureConfigured()
      
      // Test with a simple search that should always work
      const response = await this.client!.searchSingleIndex({
        indexName: this.ticketsIndexName,
        searchParams: {
          query: '',
          hitsPerPage: 1
        }
      })
      
      return {
        success: true,
        message: `Connected successfully. Index has ${response.nbHits || 0} records.`
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // ============ PRIVATE HELPER METHODS ============

  private buildAlgoliaFilters(filters?: SearchFilters): Record<string, any> {
    const algoliaFilters: Record<string, any> = {}

    if (filters?.source && filters.source.length > 0) {
      algoliaFilters.filters = filters.source.map(s => `source:${s}`).join(' OR ')
    }

    if (filters?.status && filters.status.length > 0) {
      const statusFilter = filters.status.map(s => `status:"${s}"`).join(' OR ')
      algoliaFilters.filters = algoliaFilters.filters 
        ? `(${algoliaFilters.filters}) AND (${statusFilter})`
        : statusFilter
    }

    if (filters?.priority && filters.priority.length > 0) {
      const priorityFilter = filters.priority.map(p => `priority:"${p}"`).join(' OR ')
      algoliaFilters.filters = algoliaFilters.filters
        ? `(${algoliaFilters.filters}) AND (${priorityFilter})`
        : priorityFilter
    }

    if (filters?.dateRange) {
      const from = Math.floor(filters.dateRange.from.getTime() / 1000)
      const to = Math.floor(filters.dateRange.to.getTime() / 1000)
      algoliaFilters.numericFilters = [`created:${from} TO ${to}`]
    }

    return algoliaFilters
  }

  private transformTicketHit(hit: any): SearchResult {
    return {
      objectID: hit.objectID,
      source: hit.source,
      title: hit.title || hit.subject,
      content: hit.content || hit.text || '',
      status: hit.status,
      priority: hit.priority,
      created: hit.created,
      updated: hit.updated,
      url: this.buildTicketUrl(hit),
      highlights: {
        title: hit._highlightResult?.title?.value,
        content: hit._highlightResult?.content?.value
      }
    }
  }

  private transformIssueHit(hit: any): SearchResult {
    return {
      objectID: hit.objectID,
      source: 'issue' as const,
      title: hit.title,
      content: hit.content || hit.description || '',
      status: hit.status,
      priority: hit.priority,
      created: hit.created,
      updated: hit.updated,
      url: `/support?issue=${hit.objectID}`,
      highlights: {
        title: hit._highlightResult?.title?.value,
        content: hit._highlightResult?.content?.value || hit._highlightResult?.description?.value
      }
    }
  }

  private transformCommentHit(hit: any): SearchResult {
    return {
      objectID: hit.objectID,
      source: hit.source,
      title: `Comment on ${hit.ticketKey || hit.ticketId}`,
      content: hit.content,
      status: 'comment',
      priority: 'medium',
      created: hit.created,
      updated: hit.updated,
      url: this.buildCommentUrl(hit),
      highlights: {
        content: hit._highlightResult?.content?.value
      }
    }
  }

  private buildTicketUrl(hit: any): string {
    if (hit.source === 'happyfox') {
      return `/support?ticket=${hit.ticketId}&source=happyfox`
    } else if (hit.source === 'jira') {
      return `/support?ticket=${hit.ticketKey}&source=jira`
    }
    return '/support'
  }

  private buildCommentUrl(hit: any): string {
    if (hit.source === 'happyfox') {
      return `/support?ticket=${hit.ticketId}&source=happyfox#comment-${hit.objectID}`
    } else if (hit.source === 'jira') {
      return `/support?ticket=${hit.ticketKey}&source=jira#comment-${hit.objectID}`
    }
    return '/support'
  }
}

// Export singleton instance
export const algoliaSearchService = new AlgoliaSearchService() 