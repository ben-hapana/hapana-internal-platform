import { 
  Issue, 
  NormalizedTicketData, 
  SimilarIssue, 
  ProcessingResult,
  BrandImpact,
  LocationImpact
} from '@/lib/types/issue-intelligence'
import { firestoreService } from './firestore-service'
import { similarityService } from '../ai-ml/similarity-service'

export class IssueOrchestrationService {
  
  async processNewTicket(ticketData: NormalizedTicketData): Promise<ProcessingResult> {
    
    try {
      console.log(`Processing ticket ${ticketData.ticketId}: ${ticketData.title}`)
      
      // 1. Check for similar existing issues
      const similarIssues = await this.findSimilarIssues(ticketData)
      
      // 2. Decide whether to create new issue or link to existing
      let issue: Issue
      let action: ProcessingResult['action']
      
      if (similarIssues.length > 0 && similarIssues[0].similarityScore > 0.8) {
        // Link to existing issue
        issue = await this.linkToExistingIssue(similarIssues[0].issue, ticketData)
        action = 'linked'
        console.log(`Linked ticket ${ticketData.ticketId} to existing issue ${issue.id}`)
      } else {
        // Create new issue
        issue = await this.createNewIssue(ticketData)
        action = 'created'
        console.log(`Created new issue ${issue.id} for ticket ${ticketData.ticketId}`)
      }
      
      // 3. Update issue with enhanced impact tracking
      await this.updateIssueImpact(issue.id, ticketData)
      
      // 4. Check if incident reports should be generated
      const updatedIssue = await firestoreService.getIssue(issue.id)
      const incidentReportsTriggered: string[] = []
      
      if (updatedIssue && this.shouldGenerateIncidentReports(updatedIssue)) {
        const brandIds = updatedIssue.brandImpacts
          .filter(impact => impact.totalAffectedMembers >= this.getAutoReportThreshold())
          .map(impact => impact.brandId)
        
        incidentReportsTriggered.push(...brandIds)
        
        // TODO: Trigger incident report generation
        console.log(`Incident reports triggered for brands: ${brandIds.join(', ')}`)
      }
      
      return {
        action,
        issueId: issue.id,
        confidence: similarIssues.length > 0 ? similarIssues[0].similarityScore : 1.0,
        similarIssues: similarIssues.slice(0, 5), // Return top 5 similar issues
        jiraTicketCreated: false, // TODO: Implement Jira ticket creation
        stakeholdersNotified: [], // TODO: Implement stakeholder notifications
        incidentReportsTriggered
      }
      
    } catch (error) {
      console.error(`Failed to process ticket ${ticketData.ticketId}:`, error)
      throw error
    }
  }
  
  private async findSimilarIssues(ticketData: NormalizedTicketData): Promise<SimilarIssue[]> {
    try {
      console.log(`Finding similar issues for ticket: ${ticketData.title}`)
      
      // Get recent issues as candidates
      const recentIssues = await firestoreService.getRecentIssues(100)
      
      // Use AI similarity service for advanced matching
      const similarIssues = await similarityService.findSimilarIssues(
        ticketData, 
        recentIssues, 
        0.3 // Minimum similarity threshold
      )
      
      console.log(`Found ${similarIssues.length} similar issues`)
      return similarIssues
      
    } catch (error) {
      console.error('Failed to find similar issues:', error)
      
      // Fallback to simple text similarity if AI service fails
      return this.fallbackTextSimilarity(ticketData)
    }
  }

  private async fallbackTextSimilarity(ticketData: NormalizedTicketData): Promise<SimilarIssue[]> {
    try {
      const recentIssues = await firestoreService.getRecentIssues(100)
      const similarIssues: SimilarIssue[] = []
      
      for (const issue of recentIssues) {
        if (issue.status === 'resolved') continue
        
        const similarity = this.calculateTextSimilarity(
          ticketData.title + ' ' + ticketData.description,
          issue.title + ' ' + issue.description
        )
        
        if (similarity > 0.3) { // Minimum threshold
          similarIssues.push({
            issue,
            similarityScore: similarity,
            matchType: 'semantic',
            confidence: similarity,
            reasons: [`Text similarity: ${(similarity * 100).toFixed(1)}%`]
          })
        }
      }
      
      return similarIssues.sort((a, b) => b.similarityScore - a.similarityScore)
      
    } catch (error) {
      console.error('Fallback text similarity failed:', error)
      return []
    }
  }
  
  private async createNewIssue(ticketData: NormalizedTicketData): Promise<Issue> {
    // Extract brand and location impact
    const brandImpact = await this.calculateBrandImpact(ticketData)
    
    const newIssue: Omit<Issue, 'id' | 'created' | 'updated'> = {
      title: ticketData.title,
      description: ticketData.description,
      status: 'active',
      priority: this.determinePriority(ticketData),
      
      // Linking
      happyFoxTicketIds: [ticketData.ticketId],
      jiraTicketKeys: [],
      
      // Enhanced Impact Tracking
      brandImpacts: [brandImpact],
      totalAffectedMembers: brandImpact.totalAffectedMembers,
      totalAffectedBrands: 1,
      totalAffectedLocations: brandImpact.locationImpacts.length,
      
      // Classification
      category: this.categorizeTicket(ticketData),
      tags: ticketData.tags,
      
      // AI/ML (placeholder)
      embedding: [], // TODO: Generate with proper AI service
      
      // Stakeholder Management
      watchers: [],
      notifications: {
        email: true,
        slack: false,
        sms: false,
        frequency: 'immediate'
      },
      
      // Incident Reporting
      incidentReports: {},
      requiresIncidentReport: this.shouldRequireIncidentReport(ticketData)
    }
    
    const issueId = await firestoreService.createIssue(newIssue)
    return { id: issueId, ...newIssue } as Issue
  }
  
  private async linkToExistingIssue(existingIssue: Issue, ticketData: NormalizedTicketData): Promise<Issue> {
    // Add this ticket to the existing issue
    const updatedTicketIds = [...existingIssue.happyFoxTicketIds, ticketData.ticketId]
    
    // Update the issue
    await firestoreService.updateIssue(existingIssue.id, {
      happyFoxTicketIds: updatedTicketIds,
      // @ts-expect-error - Timestamp is not a valid type for the updated field
      updated: new Date()
    })
    
    return {
      ...existingIssue,
      happyFoxTicketIds: updatedTicketIds
    }
  }
  
  private async updateIssueImpact(issueId: string, ticketData: NormalizedTicketData): Promise<void> {
    const issue = await firestoreService.getIssue(issueId)
    if (!issue) return
    
    // Calculate new brand impact
    const newBrandImpact = await this.calculateBrandImpact(ticketData)
    
    // Merge with existing brand impacts
    const existingBrandIndex = issue.brandImpacts.findIndex(
      impact => impact.brandId === newBrandImpact.brandId
    )
    
    let updatedBrandImpacts: BrandImpact[]
    
    if (existingBrandIndex >= 0) {
      // Update existing brand impact
      updatedBrandImpacts = [...issue.brandImpacts]
      updatedBrandImpacts[existingBrandIndex] = this.mergeBrandImpacts(
        updatedBrandImpacts[existingBrandIndex],
        newBrandImpact
      )
    } else {
      // Add new brand impact
      updatedBrandImpacts = [...issue.brandImpacts, newBrandImpact]
    }
    
    // Calculate totals
    const totalAffectedMembers = updatedBrandImpacts.reduce(
      (sum, impact) => sum + impact.totalAffectedMembers, 0
    )
    const totalAffectedBrands = updatedBrandImpacts.length
    const totalAffectedLocations = updatedBrandImpacts.reduce(
      (sum, impact) => sum + impact.locationImpacts.length, 0
    )
    
    // Update the issue
    await firestoreService.updateIssue(issueId, {
      brandImpacts: updatedBrandImpacts,
      totalAffectedMembers,
      totalAffectedBrands,
      totalAffectedLocations
    })
  }
  
  private async calculateBrandImpact(ticketData: NormalizedTicketData): Promise<BrandImpact> {
    // Get brand and location info
    const brand = await firestoreService.getBrand(ticketData.customer.brandId)
    const locations = await firestoreService.getLocationsByBrand(ticketData.customer.brandId)
    const affectedLocation = locations.find(l => l.id === ticketData.customer.locationId)
    
    if (!affectedLocation) {
      throw new Error(`Location ${ticketData.customer.locationId} not found`)
    }
    
    // Calculate location impact
    const locationImpact: LocationImpact = {
      locationId: affectedLocation.id,
      locationName: affectedLocation.name,
      brandId: affectedLocation.brandId,
      affectedMembers: 1, // Start with 1 (the customer who reported)
      totalMembers: affectedLocation.memberCount,
      impactPercentage: (1 / affectedLocation.memberCount) * 100,
      impactLevel: this.calculateImpactLevel(1, affectedLocation.memberCount),
      affectedServices: this.extractAffectedServices(ticketData)
    }
    
    return {
      brandId: ticketData.customer.brandId,
      brandName: brand?.name || 'Unknown Brand',
      totalAffectedMembers: 1,
      impactLevel: locationImpact.impactLevel,
      locationImpacts: [locationImpact],
      affectedServices: locationImpact.affectedServices
    }
  }
  
  private mergeBrandImpacts(existing: BrandImpact, newImpact: BrandImpact): BrandImpact {
    // Merge location impacts
    const mergedLocationImpacts = [...existing.locationImpacts]
    
    for (const newLocationImpact of newImpact.locationImpacts) {
      const existingIndex = mergedLocationImpacts.findIndex(
        l => l.locationId === newLocationImpact.locationId
      )
      
      if (existingIndex >= 0) {
        // Update existing location
        mergedLocationImpacts[existingIndex] = {
          ...mergedLocationImpacts[existingIndex],
          affectedMembers: mergedLocationImpacts[existingIndex].affectedMembers + 1,
          impactPercentage: ((mergedLocationImpacts[existingIndex].affectedMembers + 1) / 
                           mergedLocationImpacts[existingIndex].totalMembers) * 100
        }
      } else {
        // Add new location
        mergedLocationImpacts.push(newLocationImpact)
      }
    }
    
    // Recalculate totals
    const totalAffectedMembers = mergedLocationImpacts.reduce(
      (sum, impact) => sum + impact.affectedMembers, 0
    )
    
    return {
      ...existing,
      totalAffectedMembers,
      locationImpacts: mergedLocationImpacts,
      impactLevel: this.calculateOverallImpactLevel(mergedLocationImpacts)
    }
  }
  
  // ============ UTILITY METHODS ============
  
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)
    
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    
    return intersection.size / union.size
  }
  
  private determinePriority(ticketData: NormalizedTicketData): Issue['priority'] {
    // Simple priority mapping based on ticket priority and keywords
    if (ticketData.priority === 'urgent') return 'urgent'
    if (ticketData.priority === 'high') return 'high'
    
    // Check for urgent keywords
    const urgentKeywords = ['down', 'outage', 'critical', 'emergency', 'broken']
    const text = (ticketData.title + ' ' + ticketData.description).toLowerCase()
    
    if (urgentKeywords.some(keyword => text.includes(keyword))) {
      return 'urgent'
    }
    
    return ticketData.priority as Issue['priority']
  }
  
  private categorizeTicket(ticketData: NormalizedTicketData): string {
    // Simple categorization based on keywords
    const text = (ticketData.title + ' ' + ticketData.description).toLowerCase()
    
    if (text.includes('login') || text.includes('password') || text.includes('access')) {
      return 'authentication'
    }
    if (text.includes('payment') || text.includes('billing') || text.includes('charge')) {
      return 'billing'
    }
    if (text.includes('app') || text.includes('mobile') || text.includes('website')) {
      return 'technical'
    }
    if (text.includes('class') || text.includes('booking') || text.includes('schedule')) {
      return 'booking'
    }
    
    return 'general'
  }
  
  private shouldRequireIncidentReport(ticketData: NormalizedTicketData): boolean {
    const urgentKeywords = ['outage', 'down', 'critical', 'emergency', 'system']
    const text = (ticketData.title + ' ' + ticketData.description).toLowerCase()
    
    return urgentKeywords.some(keyword => text.includes(keyword)) ||
           ticketData.priority === 'urgent'
  }
  
  private calculateImpactLevel(affectedMembers: number, totalMembers: number): BrandImpact['impactLevel'] {
    const percentage = (affectedMembers / totalMembers) * 100
    
    if (percentage >= 50) return 'critical'
    if (percentage >= 20) return 'high'
    if (percentage >= 5) return 'medium'
    return 'low'
  }
  
  private calculateOverallImpactLevel(locationImpacts: LocationImpact[]): BrandImpact['impactLevel'] {
    const levels = locationImpacts.map(l => l.impactLevel)
    
    if (levels.includes('critical')) return 'critical'
    if (levels.includes('high')) return 'high'
    if (levels.includes('medium')) return 'medium'
    return 'low'
  }
  
  private extractAffectedServices(ticketData: NormalizedTicketData): string[] {
    const text = (ticketData.title + ' ' + ticketData.description).toLowerCase()
    const services: string[] = []
    
    if (text.includes('app') || text.includes('mobile')) services.push('mobile_app')
    if (text.includes('website') || text.includes('web')) services.push('website')
    if (text.includes('class') || text.includes('booking')) services.push('class_booking')
    if (text.includes('payment') || text.includes('billing')) services.push('payment_system')
    if (text.includes('access') || text.includes('entry')) services.push('facility_access')
    
    return services
  }
  
  private shouldGenerateIncidentReports(issue: Issue): boolean {
    return issue.requiresIncidentReport || 
           issue.totalAffectedMembers >= this.getAutoReportThreshold() ||
           issue.priority === 'urgent' ||
           issue.brandImpacts.some(impact => impact.impactLevel === 'critical')
  }
  
  private getAutoReportThreshold(): number {
    // TODO: Get from system config
    return 10 // affected members
  }
}

// Export singleton instance
export const issueOrchestrationService = new IssueOrchestrationService() 