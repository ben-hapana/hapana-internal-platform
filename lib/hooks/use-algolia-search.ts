import { useState, useEffect } from 'react'
import { useDebounce } from './use-debounce'
import { AlgoliaSearchService, SearchResult } from '@/lib/services/search/algolia-search-service'

interface IssueSearchResult {
  id: string
  title: string
  description: string
  status: string
  priority: string
  category: string
  created: Date
  updated: Date
  totalAffectedBrands?: number
  totalAffectedMembers?: number
  totalAffectedLocations?: number
  tags?: string[]
  highlights?: {
    title?: string
    content?: string
  }
}

interface UseAlgoliaSearchResult {
  results: IssueSearchResult[]
  isSearching: boolean
  error: string | null
  hasSearched: boolean
}

/**
 * Custom hook for performing debounced Algolia search on issues
 * @param query - The search query
 * @param delay - The debounce delay in milliseconds (default: 500ms)
 * @returns Search results, loading state, error state, and search status
 */
export function useAlgoliaSearch(query: string, delay: number = 500): UseAlgoliaSearchResult {
  const [results, setResults] = useState<IssueSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  
  const debouncedQuery = useDebounce(query, delay)
  
  useEffect(() => {
    const performSearch = async () => {
      // Don't search if query is empty or too short
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        setResults([])
        setError(null)
        setHasSearched(false)
        return
      }
      
      setIsSearching(true)
      setError(null)
      
      try {
        const searchService = new AlgoliaSearchService()
        const searchResponse = await searchService.searchIssues(debouncedQuery.trim())
        
        // Transform Algolia search results to our issue format
        const transformedResults: IssueSearchResult[] = searchResponse.hits.map((hit: SearchResult) => ({
          id: hit.objectID,
          title: hit.title,
          description: hit.content || 'No description available', // Algolia uses 'content' field
          status: hit.status,
          priority: hit.priority,
          category: 'general', // Default category since Algolia might not have this
          created: new Date(hit.created),
          updated: new Date(hit.updated),
          highlights: hit.highlights
        }))
        
        setResults(transformedResults)
        setHasSearched(true)
      } catch (err) {
        console.error('Algolia search error:', err)
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults([])
        setHasSearched(true)
      } finally {
        setIsSearching(false)
      }
    }
    
    performSearch()
  }, [debouncedQuery])
  
  return {
    results,
    isSearching,
    error,
    hasSearched
  }
} 