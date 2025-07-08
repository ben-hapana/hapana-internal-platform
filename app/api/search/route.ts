import { NextRequest, NextResponse } from 'next/server';
import { algoliaSearchService } from '@/lib/services/search/algolia-search-service';

interface SearchHit {
  objectID: string;
  source: string;
  title: string;
  content: string;
  status: string;
  priority: string;
  created: string;
  updated: string;
  highlights?: Record<string, string[]>;
}

interface SearchResultSet {
  hits: SearchHit[];
  totalHits: number;
  processingTimeMS: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    const source = searchParams.get('source') || 'tickets'; // Default to just tickets
    
    console.log(`🔍 Search request: query="${query}", limit=${limit}, source=${source}`);

    if (!query.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Query parameter "q" is required'
      }, { status: 400 });
    }

    // Test connection first
    const connectionTest = await algoliaSearchService.testConnection();
    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        error: 'Algolia connection failed',
        details: connectionTest.message
      }, { status: 500 });
    }

    // Perform search based on source
    let searchResults;
    
    if (source === 'all') {
      // Search across multiple indexes with error handling
      const results: Record<string, SearchResultSet> = {
        tickets: { hits: [], totalHits: 0, processingTimeMS: 0 },
        issues: { hits: [], totalHits: 0, processingTimeMS: 0 },
        comments: { hits: [], totalHits: 0, processingTimeMS: 0 }
      };
      
      // Search tickets
      try {
        const ticketResults = await algoliaSearchService.searchTickets(query, {}, { hitsPerPage: limit });
        results.tickets = ticketResults;
      } catch (error) {
        console.warn('Tickets search failed:', error);
        results.tickets.error = error instanceof Error ? error.message : 'Unknown error';
      }
      
      // Search issues
      try {
        const issueResults = await algoliaSearchService.searchIssues(query, {}, { hitsPerPage: limit });
        results.issues = issueResults;
      } catch (error) {
        console.warn('Issues search failed:', error);
        results.issues.error = error instanceof Error ? error.message : 'Unknown error';
      }
      
      // Search comments (skip if index doesn't exist)
      try {
        const commentResults = await algoliaSearchService.searchComments(query, {}, { hitsPerPage: limit });
        results.comments = commentResults;
      } catch (error) {
        console.warn('Comments search failed (expected if index does not exist):', error);
        results.comments.error = error instanceof Error ? error.message : 'Index does not exist';
      }
      
      searchResults = {
        query,
        totalHits: results.tickets.totalHits + results.issues.totalHits + results.comments.totalHits,
        processingTimeMS: Math.max(
          results.tickets.processingTimeMS || 0, 
          results.issues.processingTimeMS || 0, 
          results.comments.processingTimeMS || 0
        ),
        results
      };
    } else if (source === 'issues') {
      // Search just issues
      const issueResults = await algoliaSearchService.searchIssues(query, {}, { hitsPerPage: limit });
      
      searchResults = {
        query,
        totalHits: issueResults.totalHits,
        processingTimeMS: issueResults.processingTimeMS,
        results: issueResults.hits.map(hit => ({
          objectID: hit.objectID,
          source: hit.source,
          title: hit.title,
          content: hit.content,
          status: hit.status,
          priority: hit.priority,
          created: hit.created,
          updated: hit.updated,
          highlights: hit.highlights
        }))
      };
    } else {
      // Search just tickets (default behavior)
      const filters = source !== 'tickets' && source !== 'all' ? { source: [source as 'happyfox' | 'jira'] } : undefined;
      const ticketResults = await algoliaSearchService.searchTickets(query, filters, { hitsPerPage: limit });
      
      searchResults = {
        query,
        totalHits: ticketResults.totalHits,
        processingTimeMS: ticketResults.processingTimeMS,
        results: ticketResults.hits.map(hit => ({
          objectID: hit.objectID,
          source: hit.source,
          title: hit.title,
          content: hit.content,
          status: hit.status,
          priority: hit.priority,
          created: hit.created,
          updated: hit.updated,
          highlights: hit.highlights
        }))
      };
    }

    console.log(`✅ Search completed: ${searchResults.totalHits} total hits in ${searchResults.processingTimeMS}ms`);

    return NextResponse.json({
      success: true,
      data: searchResults
    });

  } catch (error) {
    console.error('❌ Search API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({
    error: 'Method not allowed. Use GET with query parameters.',
    usage: {
      method: 'GET',
      parameters: {
        q: 'string (required) - search query',
        limit: 'number (optional, default 10) - max results',
        source: 'string (optional, default "tickets") - tickets, happyfox, jira, issues, or all'
      },
      examples: [
        '/api/search?q=payment&limit=5',
        '/api/search?q=login&source=happyfox',
        '/api/search?q=bug&source=issues'
      ]
    }
  }, { status: 405 });
} 