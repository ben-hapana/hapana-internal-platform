'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SearchResult {
  objectID: string;
  source: 'happyfox' | 'jira' | 'issue';
  title: string;
  content: string;
  status: string;
  priority: string;
  created: number | string;
  updated: number | string;
  highlights?: {
    title?: string;
    content?: string;
  };
}

interface SearchResponse {
  query: string;
  totalHits: number;
  processingTimeMS: number;
  results: SearchResult[] | {
    tickets: { hits: SearchResult[]; totalHits: number };
    issues: { hits: SearchResult[]; totalHits: number };
    comments: { hits: SearchResult[]; totalHits: number };
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'tickets' | 'happyfox' | 'jira' | 'issues' | 'all'>('tickets');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&source=${source}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatDate = (date: number | string) => {
    const d = typeof date === 'number' ? new Date(date) : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'happyfox': return 'bg-blue-100 text-blue-800';
      case 'jira': return 'bg-green-100 text-green-800';
      case 'issue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'done': return 'bg-green-100 text-green-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      case 'in progress': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const renderHighlightedText = (text: string | undefined, fallback: string) => {
    if (!text) return fallback;
    return <div dangerouslySetInnerHTML={{ __html: text }} />;
  };

  const renderResults = () => {
    if (!results) return null;

    // Handle "all" source results
    if (typeof results.results === 'object' && 'tickets' in results.results) {
      return (
        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tickets">
              Tickets ({results.results.tickets.totalHits})
            </TabsTrigger>
            <TabsTrigger value="issues">
              Issues ({results.results.issues.totalHits})
            </TabsTrigger>
            <TabsTrigger value="comments">
              Comments ({results.results.comments.totalHits})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tickets">
            {renderResultList(results.results.tickets.hits)}
          </TabsContent>
          
          <TabsContent value="issues">
            {renderResultList(results.results.issues.hits)}
          </TabsContent>
          
          <TabsContent value="comments">
            {renderResultList(results.results.comments.hits)}
          </TabsContent>
        </Tabs>
      );
    }

    // Handle single source results
    return renderResultList(results.results as SearchResult[]);
  };

  const renderResultList = (hits: SearchResult[]) => {
    if (hits.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No results found
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {hits.map((result) => (
          <Card key={result.objectID} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">
                  {renderHighlightedText(result.highlights?.title, result.title)}
                </CardTitle>
                <div className="flex gap-2 ml-4">
                  <Badge className={getSourceColor(result.source)}>
                    {result.source.toUpperCase()}
                  </Badge>
                  <Badge className={getStatusColor(result.status)}>
                    {result.status}
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-sm text-gray-600">
                ID: {result.objectID} • Priority: {result.priority}
              </CardDescription>
            </CardHeader>
            
            {result.content && (
              <CardContent className="pt-0">
                <div className="text-sm text-gray-700">
                  {renderHighlightedText(result.highlights?.content, result.content)}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Created: {formatDate(result.created)} • Updated: {formatDate(result.updated)}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Search Tickets & Issues</h1>
        <p className="text-gray-600">
          Search across HappyFox tickets, Jira issues, and internal issues
        </p>
      </div>

      {/* Search Interface */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter search query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-gray-600">Search in:</span>
            {(['tickets', 'happyfox', 'jira', 'issues', 'all'] as const).map((s) => (
              <Button
                key={s}
                variant={source === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSource(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="mb-8 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div>
          <div className="mb-4 text-sm text-gray-600">
            Found {results.totalHits} results in {results.processingTimeMS}ms for &quot;{results.query}&quot;
          </div>
          {renderResults()}
        </div>
      )}

      {/* Sample Queries */}
      {!results && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Try these sample searches:</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'payment',
                'authentication',
                'Pilates',
                'STRONG',
                'login',
                'mobile app'
              ].map((sampleQuery) => (
                <Button
                  key={sampleQuery}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery(sampleQuery);
                    setSource('tickets');
                  }}
                  className="justify-start"
                                  >
                    &quot;{sampleQuery}&quot;
                  </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 