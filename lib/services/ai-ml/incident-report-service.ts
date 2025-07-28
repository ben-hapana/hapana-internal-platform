import OpenAI from 'openai'
import { 
  Issue, 
  IncidentReport, 
  BrandReference,
  HappyFoxTicketRef,
  JiraTicketRef,
  BrandImpact
} from '@/lib/types/issue-intelligence'
import { firestoreService } from '../issue-intelligence/firestore-service'
import { Timestamp } from 'firebase-admin/firestore'

export interface IncidentReportRequest {
  issueId: string
  brandId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  requestedBy: string
  customInstructions?: string
}

export interface GeneratedReport {
  title: string
  summary: string
  impactAnalysis: string
  affectedServices: string[]
  timeline: string
  currentStatus: string
  nextSteps: string[]
  brandSpecificNotes: string
  estimatedResolution?: string
  rawContent: string
}

export class IncidentReportService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  /**
   * Generate an incident report for a specific brand affected by an issue
   */
  async generateIncidentReport(request: IncidentReportRequest): Promise<IncidentReport> {
    try {
      console.log(`Generating incident report for issue ${request.issueId}, brand ${request.brandId}`)

      // 1. Gather issue data
      const issue = await firestoreService.getIssue(request.issueId)
      if (!issue) {
        throw new Error(`Issue ${request.issueId} not found`)
      }

      // 2. Get brand information
      const brand = await firestoreService.getBrand(request.brandId)
      if (!brand) {
        throw new Error(`Brand ${request.brandId} not found`)
      }

      // 3. Get related tickets
      const happyFoxTickets = await this.getHappyFoxTickets(issue.happyFoxTicketIds)
      const jiraTickets = await this.getJiraTickets(issue.jiraTicketKeys)

      // 4. Generate report using OpenAI
      const generatedReport = await this.generateReportContent(
        issue, 
        brand, 
        happyFoxTickets, 
        jiraTickets, 
        request
      )

      // 5. Create incident report object
      const incidentReport: IncidentReport = {
        id: `incident_${Date.now()}_${request.brandId}`,
        issueId: request.issueId,
        brandId: request.brandId,
        status: 'draft',
        // @ts-expect-error - Timestamp is not a valid type for the generatedAt field
        generatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as Timestamp,
        generatedBy: 'ai-assistant',
        content: {
          title: generatedReport.title,
          summary: generatedReport.summary,
          impactAssessment: generatedReport.impactAnalysis,
          timeline: generatedReport.timeline,
          rootCause: 'Under investigation',
          resolution: generatedReport.currentStatus,
          preventiveMeasures: generatedReport.nextSteps.join('\n'),
          communicationPlan: generatedReport.brandSpecificNotes
        },
        metadata: {
          totalAffectedMembers: issue.brandImpacts.find((impact: BrandImpact) => impact.brandId === request.brandId)?.totalAffectedMembers || 0,
          affectedLocations: issue.brandImpacts.find((impact: BrandImpact) => impact.brandId === request.brandId)?.locationImpacts?.length || 0,
          estimatedDowntime: generatedReport.estimatedResolution || 'Unknown',
          businessImpact: request.severity,
          customerSegments: ['All Members']
        }
      }

      // 6. Store in Firestore
      await firestoreService.createIncidentReport(incidentReport)

      console.log(`Generated incident report ${incidentReport.id}`)
      return incidentReport

    } catch (error) {
      console.error(`Failed to generate incident report:`, error)
      throw error
    }
  }

  /**
   * Generate report content using OpenAI
   */
  private async generateReportContent(
    issue: Issue,
    brand: BrandReference,
    happyFoxTickets: HappyFoxTicketRef[],
    jiraTickets: JiraTicketRef[],
    request: IncidentReportRequest
  ): Promise<GeneratedReport> {

    // Get brand impact for this specific brand
    const brandImpact = issue.brandImpacts.find(impact => impact.brandId === request.brandId)
    if (!brandImpact) {
      throw new Error(`No impact data found for brand ${request.brandId}`)
    }

    // Prepare context for OpenAI
    const context = this.prepareReportContext(issue, brand, brandImpact, happyFoxTickets, jiraTickets)

    const prompt = `
You are an expert incident report writer for fitness/wellness brands. Generate a comprehensive incident report based on the following information:

## Issue Details
${context.issueContext}

## Brand Information
${context.brandContext}

## Impact Analysis
${context.impactContext}

## Customer Tickets
${context.ticketsContext}

## Technical Details
${context.technicalContext}

${request.customInstructions ? `## Custom Instructions\n${request.customInstructions}\n` : ''}

Please generate a professional incident report with the following sections:

1. **Executive Summary** (2-3 sentences)
2. **Impact Analysis** (detailed breakdown of affected members, locations, services)
3. **Timeline** (chronological order of events)
4. **Current Status** (what's happening now)
5. **Next Steps** (specific action items)
6. **Brand-Specific Notes** (any special considerations for this brand)
7. **Estimated Resolution** (if applicable)

Format the response as JSON with these fields:
- title: Brief descriptive title
- summary: Executive summary
- impactAnalysis: Detailed impact breakdown
- affectedServices: Array of affected service names
- timeline: Chronological timeline
- currentStatus: Current situation
- nextSteps: Array of action items
- brandSpecificNotes: Brand-specific considerations
- estimatedResolution: Time estimate (optional)

Keep the tone professional but empathetic. Focus on facts and actionable information.
`

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert incident report writer for fitness and wellness brands. You write clear, professional, and actionable incident reports that help stakeholders understand the situation and next steps.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })

      const responseContent = completion.choices[0]?.message?.content
      if (!responseContent) {
        throw new Error('No response from OpenAI')
      }

      // Parse JSON response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from OpenAI response')
      }

      const parsedReport = JSON.parse(jsonMatch[0])

      return {
        title: parsedReport.title || `Incident Report - ${issue.title}`,
        summary: parsedReport.summary || 'Incident summary not available',
        impactAnalysis: parsedReport.impactAnalysis || 'Impact analysis not available',
        affectedServices: Array.isArray(parsedReport.affectedServices) ? parsedReport.affectedServices : [],
        timeline: parsedReport.timeline || 'Timeline not available',
        currentStatus: parsedReport.currentStatus || 'Status unknown',
        nextSteps: Array.isArray(parsedReport.nextSteps) ? parsedReport.nextSteps : [],
        brandSpecificNotes: parsedReport.brandSpecificNotes || '',
        estimatedResolution: parsedReport.estimatedResolution,
        rawContent: responseContent
      }

    } catch (error) {
      console.error('OpenAI generation failed:', error)
      
      // Fallback to template-based report
      return this.generateFallbackReport(issue, brand, brandImpact)
    }
  }

  /**
   * Prepare context for OpenAI prompt
   */
  private prepareReportContext(
    issue: Issue,
    brand: BrandReference,
    brandImpact: BrandImpact,
    happyFoxTickets: HappyFoxTicketRef[],
    jiraTickets: JiraTicketRef[]
  ) {
    const issueContext = `
Title: ${issue.title}
Description: ${issue.description}
Priority: ${issue.priority}
Status: ${issue.status}
Category: ${issue.category}
Total Affected Brands: ${issue.totalAffectedBrands}
Total Affected Members: ${issue.totalAffectedMembers}
Created: ${issue.created}
`

    const brandContext = `
Brand: ${brand.name} (${brand.code})
Region: ${brand.region}
Total Members: ${brand.memberCount}
`

    const impactContext = `
Affected Members in Brand: ${brandImpact.totalAffectedMembers}
Affected Locations: ${brandImpact.locationImpacts?.length || 0}
Impact Level: ${brandImpact.impactLevel}
Affected Services: ${brandImpact.affectedServices?.join(', ') || 'Unknown'}
`

    const ticketsContext = `
HappyFox Tickets (${happyFoxTickets.length}):
${happyFoxTickets.map(ticket => `- Ticket ${ticket.ticketId}: ${ticket.status} (Priority: ${ticket.priority})`).join('\n')}

Jira Tickets (${jiraTickets.length}):
${jiraTickets.map(ticket => `- ${ticket.key}: ${ticket.status} (Priority: ${ticket.priority})`).join('\n')}
`

    const technicalContext = `
Tags: ${issue.tags.join(', ')}
Requires Incident Report: ${issue.requiresIncidentReport}
`

    return {
      issueContext,
      brandContext,
      impactContext,
      ticketsContext,
      technicalContext
    }
  }

  /**
   * Fallback report generation when OpenAI fails
   */
  private generateFallbackReport(
    issue: Issue,
    brand: BrandReference,
    brandImpact: BrandImpact
  ): GeneratedReport {
    return {
      title: `Incident Report - ${issue.title}`,
      summary: `An incident has been detected affecting ${brand.name} with ${brandImpact.totalAffectedMembers} members impacted.`,
      impactAnalysis: `This incident affects ${brandImpact.totalAffectedMembers} members across ${brandImpact.locationImpacts?.length || 0} locations in ${brand.name}.`,
      affectedServices: brandImpact.affectedServices || [],
      timeline: `Issue first detected: ${issue.created}`,
      currentStatus: `Issue is currently ${issue.status} with priority level ${issue.priority}.`,
      nextSteps: [
        'Monitor affected systems',
        'Communicate with affected members',
        'Implement resolution plan'
      ],
      brandSpecificNotes: `This incident specifically affects ${brand.name} operations.`,
      estimatedResolution: undefined,
      rawContent: 'Generated using fallback template due to AI service unavailability.'
    }
  }

  /**
   * Get HappyFox tickets by IDs
   */
  private async getHappyFoxTickets(ticketIds: string[]): Promise<HappyFoxTicketRef[]> {
    const tickets: HappyFoxTicketRef[] = []
    
    for (const ticketId of ticketIds) {
      try {
        const ticket = await firestoreService.getHappyFoxTicket(ticketId)
        if (ticket) tickets.push(ticket)
      } catch (error) {
        console.warn(`Failed to get HappyFox ticket ${ticketId}:`, error)
      }
    }
    
    return tickets
  }

  /**
   * Get Jira tickets by keys
   */
  private async getJiraTickets(ticketKeys: string[]): Promise<JiraTicketRef[]> {
    const tickets: JiraTicketRef[] = []
    
    for (const ticketKey of ticketKeys) {
      try {
        const ticket = await firestoreService.getJiraTicket(ticketKey)
        if (ticket) tickets.push(ticket)
      } catch (error) {
        console.warn(`Failed to get Jira ticket ${ticketKey}:`, error)
      }
    }
    
    return tickets
  }

  /**
   * Get distribution list for a brand
   */
  private async getBrandDistributionList(brandId: string): Promise<string[]> {
    try {
      // TODO: Implement brand-specific distribution lists
      // For now, return a default list
      return [
        'operations@hapana.com',
        'support@hapana.com'
      ]
    } catch (error) {
      console.warn(`Failed to get distribution list for brand ${brandId}:`, error)
      return []
    }
  }
}

// Export singleton instance
export const incidentReportService = new IncidentReportService() 