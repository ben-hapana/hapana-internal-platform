import { VertexAI } from '@google-cloud/vertexai'
import { 
  SimilarIssue, 
  Issue, 
  NormalizedTicketData 
} from '@/lib/types/issue-intelligence'

export interface EmbeddingResult {
  embedding: number[]
  error?: string
}

export interface SimilarityAnalysis {
  semanticScore: number
  keywordScore: number
  brandLocationScore: number
  combinedScore: number
  matchType: 'semantic' | 'keyword' | 'brand-location' | 'customer'
  confidence: number
  reasons: string[]
}

export class SimilarityService {
  private vertexAI: VertexAI
  private textEmbeddingModel: any // eslint-disable-line @typescript-eslint/no-explicit-any
  
  constructor() {
    // Initialize Vertex AI
    this.vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID || 'hapana-internal-platform',
      location: process.env.GOOGLE_CLOUD_REGION || 'us-central1'
    })
    
    // Initialize text embedding model - use the prediction service
    this.textEmbeddingModel = this.vertexAI.preview.getGenerativeModel({
      model: 'textembedding-gecko@003'
    })
  }

  /**
   * Generate embedding for ticket text (title + description)
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      // Clean and prepare text
      const cleanText = this.preprocessText(text)
      
      if (cleanText.length === 0) {
        return { embedding: [], error: 'Empty text after preprocessing' }
      }

      // Generate embedding using Vertex AI Text Embeddings API
      // Use the embedContent method for text embedding models
      const request = {
        content: {
          parts: [{ text: cleanText }]
        }
      }

      const response = await this.textEmbeddingModel.embedContent(request)
      const embedding = response.embedding?.values || []

      if (embedding.length === 0) {
        return { embedding: [], error: 'No embedding generated' }
      }

      return { embedding }

    } catch (error) {
      console.error('Failed to generate embedding:', error)
      return { 
        embedding: [], 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length || embedding1.length === 0) {
      return 0
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2)
    return magnitude === 0 ? 0 : dotProduct / magnitude
  }

  /**
   * Comprehensive similarity analysis between ticket and issue
   */
  async analyzeSimilarity(
    ticketData: NormalizedTicketData, 
    issue: Issue
  ): Promise<SimilarityAnalysis> {
    
    const reasons: string[] = []
    
    // 1. Semantic Similarity (using embeddings)
    const semanticScore = await this.calculateSemanticSimilarity(ticketData, issue)
    if (semanticScore > 0.7) reasons.push(`High semantic similarity: ${(semanticScore * 100).toFixed(1)}%`)
    
    // 2. Keyword Overlap
    const keywordScore = this.calculateKeywordSimilarity(ticketData, issue)
    if (keywordScore > 0.5) reasons.push(`Keyword overlap: ${(keywordScore * 100).toFixed(1)}%`)
    
    // 3. Brand/Location Matching
    const brandLocationScore = this.calculateBrandLocationSimilarity(ticketData, issue)
    if (brandLocationScore > 0.8) reasons.push(`Same brand/location affected`)
    
    // 4. Combined Score (weighted average)
    const combinedScore = this.calculateCombinedScore(
      semanticScore, 
      keywordScore, 
      brandLocationScore
    )
    
    // 5. Determine match type and confidence
    const { matchType, confidence } = this.determineMatchType(
      semanticScore, 
      keywordScore, 
      brandLocationScore
    )
    
    return {
      semanticScore,
      keywordScore,
      brandLocationScore,
      combinedScore,
      matchType,
      confidence,
      reasons
    }
  }

  /**
   * Find similar issues for a given ticket
   */
  async findSimilarIssues(
    ticketData: NormalizedTicketData,
    candidateIssues: Issue[],
    threshold: number = 0.3
  ): Promise<SimilarIssue[]> {
    
    const similarIssues: SimilarIssue[] = []
    
    // Generate embedding for the new ticket
    const ticketText = `${ticketData.title} ${ticketData.description}`
    const ticketEmbeddingResult = await this.generateEmbedding(ticketText)
    
    if (ticketEmbeddingResult.error) {
      console.warn('Failed to generate ticket embedding, falling back to keyword matching')
      return this.fallbackKeywordMatching(ticketData, candidateIssues, threshold)
    }

    // Analyze similarity with each candidate issue
    for (const issue of candidateIssues) {
      if (issue.status === 'resolved') continue
      
      try {
        const analysis = await this.analyzeSimilarity(ticketData, issue)
        
        if (analysis.combinedScore >= threshold) {
          similarIssues.push({
            issue,
            similarityScore: analysis.combinedScore,
            matchType: analysis.matchType as SimilarityAnalysis['matchType'],
            confidence: analysis.confidence,
            reasons: analysis.reasons
          })
        }
        
      } catch (error) {
        console.warn(`Failed to analyze similarity for issue ${issue.id}:`, error)
        continue
      }
    }

    // Sort by similarity score (highest first)
    return similarIssues.sort((a, b) => b.similarityScore - a.similarityScore)
  }

  /**
   * Calculate semantic similarity using embeddings
   */
  private async calculateSemanticSimilarity(
    ticketData: NormalizedTicketData, 
    issue: Issue
  ): Promise<number> {
    
    const ticketText = `${ticketData.title} ${ticketData.description}`
    const issueText = `${issue.title} ${issue.description}`
    
    // Use cached embeddings if available
    if (issue.embedding && issue.embedding.length > 0) {
      const ticketEmbeddingResult = await this.generateEmbedding(ticketText)
      if (!ticketEmbeddingResult.error) {
        return this.calculateCosineSimilarity(ticketEmbeddingResult.embedding, issue.embedding)
      }
    }
    
    // Generate both embeddings
    const [ticketResult, issueResult] = await Promise.all([
      this.generateEmbedding(ticketText),
      this.generateEmbedding(issueText)
    ])
    
    if (ticketResult.error || issueResult.error) {
      return 0
    }
    
    return this.calculateCosineSimilarity(ticketResult.embedding, issueResult.embedding)
  }

  /**
   * Calculate keyword-based similarity
   */
  private calculateKeywordSimilarity(
    ticketData: NormalizedTicketData, 
    issue: Issue
  ): number {
    
    const ticketKeywords = this.extractKeywords(`${ticketData.title} ${ticketData.description}`)
    const issueKeywords = this.extractKeywords(`${issue.title} ${issue.description}`)
    
    if (ticketKeywords.size === 0 || issueKeywords.size === 0) {
      return 0
    }
    
    // Calculate Jaccard similarity
    const intersection = new Set([...ticketKeywords].filter(x => issueKeywords.has(x)))
    const union = new Set([...ticketKeywords, ...issueKeywords])
    
    return intersection.size / union.size
  }

  /**
   * Calculate brand/location similarity
   */
  private calculateBrandLocationSimilarity(
    ticketData: NormalizedTicketData, 
    issue: Issue
  ): number {
    
    const ticketBrandId = ticketData.customer.brandId
    const ticketLocationId = ticketData.customer.locationId
    
    // Check if any brand impact matches
    const brandMatch = issue.brandImpacts.some(impact => impact.brandId === ticketBrandId)
    if (!brandMatch) return 0
    
    // Check for location match within the brand
    const brandImpact = issue.brandImpacts.find(impact => impact.brandId === ticketBrandId)
    if (!brandImpact) return 0.5 // Brand match only
    
    const locationMatch = brandImpact.locationImpacts.some(
      impact => impact.locationId === ticketLocationId
    )
    
    return locationMatch ? 1.0 : 0.7 // Full match vs brand-only match
  }

  /**
   * Calculate weighted combined score
   */
  private calculateCombinedScore(
    semanticScore: number, 
    keywordScore: number, 
    brandLocationScore: number
  ): number {
    
    // Weights based on importance
    const semanticWeight = 0.5
    const keywordWeight = 0.3
    const brandLocationWeight = 0.2
    
    return (
      semanticScore * semanticWeight +
      keywordScore * keywordWeight +
      brandLocationScore * brandLocationWeight
    )
  }

  /**
   * Determine match type and confidence
   */
  private determineMatchType(
    semanticScore: number, 
    keywordScore: number, 
    brandLocationScore: number
  ): { matchType: SimilarityAnalysis['matchType'], confidence: number } {
    
    if (semanticScore > 0.8 && keywordScore > 0.6) {
      return { matchType: 'customer', confidence: Math.min(semanticScore + keywordScore, 1.0) }
    }
    
    if (semanticScore > 0.7) {
      return { matchType: 'semantic', confidence: semanticScore }
    }
    
    if (keywordScore > 0.6) {
      return { matchType: 'keyword', confidence: keywordScore }
    }
    
    if (brandLocationScore > 0.8) {
      return { matchType: 'brand-location', confidence: brandLocationScore }
    }
    
    return { matchType: 'semantic', confidence: Math.max(semanticScore, keywordScore, brandLocationScore) }
  }

  /**
   * Fallback keyword matching when embeddings fail
   */
  private fallbackKeywordMatching(
    ticketData: NormalizedTicketData,
    candidateIssues: Issue[],
    threshold: number
  ): SimilarIssue[] {
    
    const similarIssues: SimilarIssue[] = []
    
    for (const issue of candidateIssues) {
      if (issue.status === 'resolved') continue
      
      const keywordScore = this.calculateKeywordSimilarity(ticketData, issue)
      const brandLocationScore = this.calculateBrandLocationSimilarity(ticketData, issue)
      
      const combinedScore = keywordScore * 0.7 + brandLocationScore * 0.3
      
      if (combinedScore >= threshold) {
        similarIssues.push({
          issue,
          similarityScore: combinedScore,
          matchType: 'keyword',
          confidence: combinedScore,
          reasons: [`Keyword similarity: ${(keywordScore * 100).toFixed(1)}%`]
        })
      }
    }
    
    return similarIssues.sort((a, b) => b.similarityScore - a.similarityScore)
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): Set<string> {
    const keywords = new Set<string>()
    
    // Clean and tokenize
    const cleanText = this.preprocessText(text)
    const words = cleanText.toLowerCase().split(/\s+/)
    
    // Filter meaningful words (length > 2, not common words)
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'will', 'with'])
    
    for (const word of words) {
      if (word.length > 2 && !stopWords.has(word) && /^[a-zA-Z]+$/.test(word)) {
        keywords.add(word)
      }
    }
    
    return keywords
  }

  /**
   * Preprocess text for analysis
   */
  private preprocessText(text: string): string {
    return text
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }
}

// Export singleton instance
export const similarityService = new SimilarityService() 