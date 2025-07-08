# Issue Intelligence System - Implementation Plan

## Overview

A world-class system to automatically detect, deduplicate, and manage customer issues across HappyFox and Jira, ensuring stakeholders stay informed about global issues affecting multiple brands and locations.

## High-Level Architecture

### Webhook-First Event-Driven Pipeline
```
HappyFox Webhook → Cloud Functions → Pub/Sub → Processing Services → Firestore
Jira Webhook → Cloud Functions → Pub/Sub → Processing Services → Firestore
Backup Sync Jobs → Cloud Scheduler → Cloud Run → External APIs → Firestore (fallback)
```

### Core Components

#### A. Webhook Handlers (Cloud Functions) - PRIMARY
- **HappyFox Webhook Handler**: Real-time ticket events
- **Jira Webhook Handler**: Real-time issue events
- **Responsibilities**:
  - Validate webhook signatures (HMAC for HappyFox, optional secret for Jira)
  - Extract and normalize event data
  - Publish to Pub/Sub for async processing
  - Return immediate 200 OK response
  - Handle webhook retries and deduplication

#### B. Backup Sync Services (Cloud Run) - FALLBACK
- **HappyFox Sync Service**: Periodic reconciliation sync
- **Jira Sync Service**: Periodic reconciliation sync  
- **Responsibilities**:
  - Detect missed webhook events
  - Handle webhook delivery failures
  - Perform initial historical data import
  - Reconcile data inconsistencies

#### C. Event Processing Service (Cloud Run)
- **Purpose**: Process webhook events and sync ticket data
- **Responsibilities**:
  - Normalize webhook payloads
  - Update Firestore collections
  - Trigger issue intelligence analysis
  - Handle event deduplication and ordering

#### D. Issue Intelligence Service (Cloud Run)
- **Purpose**: Determine if incoming ticket relates to existing issue
- **Triggered by**: Webhook events for new/updated tickets
- **AI/ML Components**:
  - **Vertex AI Matching API** for semantic similarity
  - **Document AI** for extracting structured data
  - **Custom embedding model** for domain-specific matching

#### E. Incident Report Service (Cloud Run)
- **Purpose**: Generate automated incident reports for affected brands
- **Triggered by**: Issues affecting multiple members or critical services
- **AI/ML Components**:
  - **OpenAI GPT-4** for report generation
  - **Brand-specific templates** for customized reports
  - **Member impact calculation** based on location data
  - **Timeline reconstruction** from ticket history

## Technical Implementation Strategy

### Phase 1: Foundation & Webhook Infrastructure (Weeks 1-3)

#### 1. Webhook Configuration & Setup

##### HappyFox Webhook Configuration
```typescript
// HappyFox webhook events to subscribe to
const HAPPYFOX_WEBHOOK_EVENTS = [
  'ticket_created',
  'ticket_updated', 
  'ticket_closed',
  'ticket_assigned',
  'ticket_status_changed',
  'ticket_priority_changed'
]

// HappyFox webhook payload structure
interface HappyFoxWebhookPayload {
  event: string
  ticket: {
    id: number
    subject: string
    text: string
    html_text: string
    status: { id: number, name: string }
    priority: { id: number, name: string }
    category: { id: number, name: string }
    user: {
      id: number
      name: string
      email: string
      phone?: string
    }
    assignee?: {
      id: number
      name: string
      email: string
    }
    custom_fields: Record<string, any>
    created_at: string
    updated_at: string
    tags: string[]
    attachments: Array<{
      id: number
      filename: string
      url: string
      content_type: string
      size: number
    }>
  }
  timestamp: string
  webhook_id: string
}

// Configure HappyFox webhook endpoint
const HAPPYFOX_WEBHOOK_CONFIG = {
  url: 'https://your-cloud-function-url/webhooks/happyfox',
  events: HAPPYFOX_WEBHOOK_EVENTS,
  secret: process.env.HAPPYFOX_WEBHOOK_SECRET, // For HMAC validation
  active: true
}
```

##### Jira Webhook Configuration
```typescript
// Jira webhook events to subscribe to
const JIRA_WEBHOOK_EVENTS = [
  'jira:issue_created',
  'jira:issue_updated',
  'jira:issue_deleted',
  'worklog_updated',
  'comment_created',
  'comment_updated'
]

// Jira webhook payload structure
interface JiraWebhookPayload {
  timestamp: number
  webhookEvent: string
  issue_event_type_name?: string
  user: {
    self: string
    accountId: string
    displayName: string
    emailAddress: string
  }
  issue: {
    id: string
    key: string
    self: string
    fields: {
      summary: string
      description?: string
      status: { id: string, name: string, statusCategory: any }
      priority: { id: string, name: string }
      issuetype: { id: string, name: string }
      project: { id: string, key: string, name: string }
      assignee?: { accountId: string, displayName: string, emailAddress: string }
      reporter: { accountId: string, displayName: string, emailAddress: string }
      created: string
      updated: string
      labels: string[]
      components: Array<{ id: string, name: string }>
      fixVersions: Array<{ id: string, name: string }>
      customfield_10001?: string[] // Example: Affected Brands
      customfield_10002?: string[] // Example: Affected Locations
      // ... other custom fields
    }
  }
  changelog?: {
    id: string
    items: Array<{
      field: string
      fieldtype: string
      from: string
      fromString: string
      to: string
      toString: string
    }>
  }
}

// Configure Jira webhook
const JIRA_WEBHOOK_CONFIG = {
  name: 'Hapana Issue Intelligence Webhook',
  url: 'https://your-cloud-function-url/webhooks/jira',
  events: JIRA_WEBHOOK_EVENTS,
  filters: {
    'issue-related-events-section': 'project = SUP' // Only support project
  },
  excludeBody: false
}
```

#### 2. Enhanced Webhook Handlers

```typescript
// functions/src/webhooks/happyfox.ts
export const handleHappyFoxWebhook = functions.https.onRequest(async (req, res) => {
  const startTime = Date.now()
  
  try {
    // 1. Validate webhook signature
    const signature = req.headers['x-happyfox-signature'] as string
    const isValid = validateHappyFoxSignature(req.body, signature, process.env.HAPPYFOX_WEBHOOK_SECRET!)
    
    if (!isValid) {
      console.error('Invalid HappyFox webhook signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // 2. Parse and validate payload
    const payload: HappyFoxWebhookPayload = req.body
    
    if (!payload.ticket || !payload.event) {
      return res.status(400).json({ error: 'Invalid payload structure' })
    }

    // 3. Check for duplicate events (idempotency)
    const eventId = `happyfox-${payload.ticket.id}-${payload.event}-${payload.timestamp}`
    const isDuplicate = await checkDuplicateEvent(eventId)
    
    if (isDuplicate) {
      console.log(`Duplicate HappyFox event ignored: ${eventId}`)
      return res.status(200).json({ status: 'duplicate_ignored' })
    }

    // 4. Normalize the ticket data
    const normalizedEvent: TicketEvent = {
      eventId,
      source: 'happyfox',
      eventType: payload.event,
      ticketId: payload.ticket.id.toString(),
      timestamp: new Date(payload.timestamp),
      ticket: {
        id: payload.ticket.id.toString(),
        title: payload.ticket.subject,
        description: payload.ticket.text,
        htmlDescription: payload.ticket.html_text,
        status: payload.ticket.status.name,
        priority: payload.ticket.priority.name,
        category: payload.ticket.category.name,
        customer: {
          name: payload.ticket.user.name,
          email: payload.ticket.user.email,
          phone: payload.ticket.user.phone,
          // Extract brand/location from custom fields
          brand: extractBrandFromCustomFields(payload.ticket.custom_fields),
          location: extractLocationFromCustomFields(payload.ticket.custom_fields),
          tier: determineCustomerTier(payload.ticket.user.email)
        },
        assignee: payload.ticket.assignee ? {
          name: payload.ticket.assignee.name,
          email: payload.ticket.assignee.email
        } : undefined,
        tags: payload.ticket.tags,
        attachments: payload.ticket.attachments.map(att => ({
          id: att.id.toString(),
          filename: att.filename,
          url: att.url,
          mimeType: att.content_type,
          size: att.size
        })),
        customFields: payload.ticket.custom_fields,
        created: new Date(payload.ticket.created_at),
        updated: new Date(payload.ticket.updated_at)
      }
    }

    // 5. Publish to Pub/Sub for async processing
    await publishToPubSub('ticket-events', normalizedEvent)

    // 6. Store event for deduplication
    await storeEventId(eventId, Date.now() + 24 * 60 * 60 * 1000) // 24 hour TTL

    // 7. Return success immediately
    const processingTime = Date.now() - startTime
    res.status(200).json({ 
      status: 'received', 
      eventId,
      processingTime: `${processingTime}ms`
    })

  } catch (error) {
    console.error('HappyFox webhook processing error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// functions/src/webhooks/jira.ts
export const handleJiraWebhook = functions.https.onRequest(async (req, res) => {
  const startTime = Date.now()
  
  try {
    // 1. Optional: Validate webhook secret if configured
    const webhookSecret = req.headers['x-atlassian-webhook-identifier']
    // Jira doesn't have built-in HMAC, but you can add custom validation

    // 2. Parse and validate payload
    const payload: JiraWebhookPayload = req.body
    
    if (!payload.issue || !payload.webhookEvent) {
      return res.status(400).json({ error: 'Invalid payload structure' })
    }

    // 3. Filter events we care about
    if (!JIRA_WEBHOOK_EVENTS.includes(payload.webhookEvent)) {
      return res.status(200).json({ status: 'event_ignored' })
    }

    // 4. Check for duplicate events
    const eventId = `jira-${payload.issue.id}-${payload.webhookEvent}-${payload.timestamp}`
    const isDuplicate = await checkDuplicateEvent(eventId)
    
    if (isDuplicate) {
      console.log(`Duplicate Jira event ignored: ${eventId}`)
      return res.status(200).json({ status: 'duplicate_ignored' })
    }

    // 5. Normalize the issue data
    const normalizedEvent: TicketEvent = {
      eventId,
      source: 'jira',
      eventType: payload.webhookEvent,
      ticketId: payload.issue.key,
      timestamp: new Date(payload.timestamp),
      ticket: {
        id: payload.issue.key,
        title: payload.issue.fields.summary,
        description: payload.issue.fields.description || '',
        status: payload.issue.fields.status.name,
        priority: payload.issue.fields.priority.name,
        category: payload.issue.fields.issuetype.name,
        assignee: payload.issue.fields.assignee ? {
          name: payload.issue.fields.assignee.displayName,
          email: payload.issue.fields.assignee.emailAddress
        } : undefined,
        reporter: {
          name: payload.issue.fields.reporter.displayName,
          email: payload.issue.fields.reporter.emailAddress
        },
        project: {
          key: payload.issue.fields.project.key,
          name: payload.issue.fields.project.name
        },
        affectedBrands: extractAffectedBrands(payload.issue.fields),
        affectedLocations: extractAffectedLocations(payload.issue.fields),
        labels: payload.issue.fields.labels,
        components: payload.issue.fields.components,
        customFields: extractJiraCustomFields(payload.issue.fields),
        created: new Date(payload.issue.fields.created),
        updated: new Date(payload.issue.fields.updated)
      },
      changelog: payload.changelog
    }

    // 6. Publish to Pub/Sub for async processing
    await publishToPubSub('ticket-events', normalizedEvent)

    // 7. Store event for deduplication
    await storeEventId(eventId, Date.now() + 24 * 60 * 60 * 1000)

    // 8. Return success immediately
    const processingTime = Date.now() - startTime
    res.status(200).json({ 
      status: 'received', 
      eventId,
      processingTime: `${processingTime}ms`
    })

  } catch (error) {
    console.error('Jira webhook processing error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Shared interfaces
interface TicketEvent {
  eventId: string
  source: 'happyfox' | 'jira'
  eventType: string
  ticketId: string
  timestamp: Date
  ticket: NormalizedTicketData
  changelog?: any
}
```

#### 3. Event Processing Service

```typescript
// services/event-processor.ts
class EventProcessorService {
  async processTicketEvent(event: TicketEvent): Promise<void> {
    const startTime = Date.now()
    
    try {
      // 1. Update the ticket in Firestore
      await this.updateTicketInFirestore(event)
      
      // 2. Trigger issue intelligence analysis for new/updated tickets
      if (event.eventType.includes('created') || event.eventType.includes('updated')) {
        await this.triggerIssueIntelligence(event)
      }
      
      // 3. Update linked issues if ticket is already connected
      if (event.source === 'happyfox') {
        const existingTicket = await this.getHappyFoxTicket(event.ticketId)
        if (existingTicket?.linkedIssueId) {
          await this.updateLinkedIssue(existingTicket.linkedIssueId, event)
        }
      } else if (event.source === 'jira') {
        const existingTicket = await this.getJiraTicket(event.ticketId)
        if (existingTicket?.linkedIssueId) {
          await this.updateLinkedIssue(existingTicket.linkedIssueId, event)
        }
      }
      
      // 4. Log processing success
      await this.logProcessingResult({
        eventId: event.eventId,
        status: 'success',
        processingTime: Date.now() - startTime
      })
      
    } catch (error) {
      console.error(`Failed to process event ${event.eventId}:`, error)
      await this.logProcessingResult({
        eventId: event.eventId,
        status: 'error',
        error: error.message,
        processingTime: Date.now() - startTime
      })
      throw error
    }
  }

  private async updateTicketInFirestore(event: TicketEvent): Promise<void> {
    const collection = event.source === 'happyfox' ? 'happyfox-tickets' : 'jira-tickets'
    
    // Generate embedding for new content
    let embedding: number[] | undefined
    if (event.ticket.description) {
      embedding = await this.similarityService.generateEmbedding(
        `${event.ticket.title} ${event.ticket.description}`
      )
    }

    const ticketData = {
      ...event.ticket,
      embedding,
      lastSynced: Timestamp.now(),
      lastWebhookEvent: event.eventType,
      lastWebhookTimestamp: Timestamp.fromDate(event.timestamp)
    }

    await this.firestore
      .collection(collection)
      .doc(event.ticketId)
      .set(ticketData, { merge: true })
  }
}
```

#### 4. Backup Reconciliation Strategy

```typescript
// services/reconciliation.ts
class ReconciliationService {
  // Run every hour to catch missed webhooks
  async reconcileRecentChanges(): Promise<void> {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000) // Last 2 hours
    
    await Promise.all([
      this.reconcileHappyFoxTickets(since),
      this.reconcileJiraTickets(since)
    ])
  }

  private async reconcileHappyFoxTickets(since: Date): Promise<void> {
    // Get tickets updated since timestamp from HappyFox API
    const apiTickets = await this.happyFoxAPI.getTickets({
      updated_since: since.toISOString(),
      limit: 100
    })

    // Compare with Firestore data
    for (const apiTicket of apiTickets.data) {
      const firestoreTicket = await this.getHappyFoxTicket(apiTicket.id.toString())
      
      if (!firestoreTicket || 
          new Date(apiTicket.updated_at) > firestoreTicket.updated.toDate()) {
        // Ticket is missing or outdated in Firestore
        console.log(`Reconciling HappyFox ticket ${apiTicket.id}`)
        await this.syncHappyFoxTicket(apiTicket)
      }
    }
  }

  // Similar implementation for Jira reconciliation
}
```

#### 5. Incident Report Service Implementation

```typescript
// services/incident-report.ts
class IncidentReportService implements IncidentReportServiceInterface {
  private openai: OpenAI
  private firestore: FirebaseFirestore.Firestore

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  async generateReport(issue: Issue, brandId: string): Promise<IncidentReport> {
    const startTime = Date.now()
    
    try {
      // 1. Get brand-specific data
      const brandImpact = issue.brandImpacts.find(b => b.brandId === brandId)
      if (!brandImpact) {
        throw new Error(`Brand ${brandId} not affected by issue ${issue.id}`)
      }

      const brand = await this.getBrand(brandId)
      const template = await this.getReportTemplate(brandId)
      
      // 2. Gather context data
      const contextData = await this.gatherContextData(issue, brandImpact)
      
      // 3. Generate report content using OpenAI
      const reportContent = await this.generateReportContent(
        issue, 
        brandImpact, 
        contextData, 
        template
      )
      
      // 4. Create incident report
      const report: IncidentReport = {
        id: generateId(),
        brandId,
        issueId: issue.id,
        status: 'generated',
        generatedAt: Timestamp.now(),
        generatedBy: 'ai-system',
        content: reportContent,
        metadata: {
          totalAffectedMembers: brandImpact.totalAffectedMembers,
          affectedLocations: brandImpact.locationImpacts.length,
          estimatedDowntime: this.calculateDowntime(issue, brandImpact),
          businessImpact: brandImpact.impactLevel,
          customerSegments: this.determineCustomerSegments(brandImpact)
        }
      }
      
      // 5. Save to Firestore
      await this.firestore
        .collection('incident-reports')
        .doc(report.id)
        .set(report)
      
      // 6. Update issue with report reference
      await this.firestore
        .collection('issues')
        .doc(issue.id)
        .update({
          [`incidentReports.${brandId}`]: report.id
        })
      
      console.log(`Generated incident report ${report.id} for brand ${brandId} in ${Date.now() - startTime}ms`)
      return report
      
    } catch (error) {
      console.error(`Failed to generate incident report for brand ${brandId}:`, error)
      throw error
    }
  }

  private async gatherContextData(issue: Issue, brandImpact: BrandImpact): Promise<ContextData> {
    // Get related tickets for timeline
    const happyFoxTickets = await Promise.all(
      issue.happyFoxTicketIds.map(id => this.getHappyFoxTicket(id))
    )
    
    const jiraTickets = await Promise.all(
      issue.jiraTicketKeys.map(key => this.getJiraTicket(key))
    )
    
    // Get historical similar issues
    const similarIssues = await this.findHistoricalSimilarIssues(issue, brandImpact.brandId)
    
    return {
      issue,
      brandImpact,
      happyFoxTickets: happyFoxTickets.filter(Boolean),
      jiraTickets: jiraTickets.filter(Boolean),
      similarIssues,
      timeline: this.constructTimeline(happyFoxTickets, jiraTickets),
      impactAnalysis: this.analyzeImpact(brandImpact)
    }
  }

  private async generateReportContent(
    issue: Issue,
    brandImpact: BrandImpact,
    contextData: ContextData,
    template: IncidentReportTemplate
  ): Promise<IncidentReport['content']> {
    const sections = template.sections
    const content: IncidentReport['content'] = {
      title: '',
      summary: '',
      impactAssessment: '',
      timeline: '',
      rootCause: '',
      resolution: '',
      preventiveMeasures: '',
      communicationPlan: ''
    }

    // Generate each section using OpenAI
    for (const [sectionKey, sectionTitle] of Object.entries(sections)) {
      const prompt = this.buildPrompt(sectionKey, contextData, template)
      
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert incident report writer for ${contextData.brandImpact.brandName}. 
                       Generate professional, clear, and actionable incident report content.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3 // Lower temperature for more consistent, factual content
        })
        
        content[sectionKey as keyof IncidentReport['content']] = 
          response.choices[0]?.message?.content || `Error generating ${sectionTitle}`
          
      } catch (error) {
        console.error(`Failed to generate ${sectionKey} section:`, error)
        content[sectionKey as keyof IncidentReport['content']] = 
          `[Error: Unable to generate ${sectionTitle} - please review manually]`
      }
    }

    return content
  }

  private buildPrompt(sectionKey: string, contextData: ContextData, template: IncidentReportTemplate): string {
    const basePrompt = template.prompts[sectionKey] || this.getDefaultPrompt(sectionKey)
    
    // Replace placeholders with actual data
    return basePrompt
      .replace('{{ISSUE_TITLE}}', contextData.issue.title)
      .replace('{{ISSUE_DESCRIPTION}}', contextData.issue.description)
      .replace('{{BRAND_NAME}}', contextData.brandImpact.brandName)
      .replace('{{AFFECTED_MEMBERS}}', contextData.brandImpact.totalAffectedMembers.toString())
      .replace('{{AFFECTED_LOCATIONS}}', contextData.brandImpact.locationImpacts.map(l => l.locationName).join(', '))
      .replace('{{IMPACT_LEVEL}}', contextData.brandImpact.impactLevel)
      .replace('{{TIMELINE}}', this.formatTimeline(contextData.timeline))
      .replace('{{SIMILAR_ISSUES}}', this.formatSimilarIssues(contextData.similarIssues))
      .replace('{{TICKET_COUNT}}', (contextData.happyFoxTickets.length + contextData.jiraTickets.length).toString())
  }

  private getDefaultPrompt(sectionKey: string): string {
    const defaultPrompts: Record<string, string> = {
      title: `Generate a clear, concise incident title for {{BRAND_NAME}} that describes the issue: {{ISSUE_TITLE}}. 
              The title should be professional and suitable for executive communication.`,
      
      summary: `Write a brief executive summary of the incident affecting {{BRAND_NAME}}. 
                Include: what happened, when it started, how many members were affected ({{AFFECTED_MEMBERS}}), 
                and the current status. Keep it under 150 words.`,
      
      impactAssessment: `Provide a detailed impact assessment for {{BRAND_NAME}}:
                        - Total affected members: {{AFFECTED_MEMBERS}}
                        - Affected locations: {{AFFECTED_LOCATIONS}}
                        - Impact level: {{IMPACT_LEVEL}}
                        - Services affected and business impact
                        - Customer experience implications`,
      
      timeline: `Create a chronological timeline of the incident based on the following information:
                {{TIMELINE}}
                Include key events, discovery, escalation, and resolution milestones.`,
      
      rootCause: `Analyze the root cause of this incident: {{ISSUE_DESCRIPTION}}
                 Based on similar incidents: {{SIMILAR_ISSUES}}
                 Provide technical details and contributing factors.`,
      
      resolution: `Describe the resolution steps taken or planned for this incident.
                  Include immediate fixes, workarounds, and long-term solutions.`,
      
      preventiveMeasures: `Recommend specific preventive measures to avoid similar incidents:
                          - Technical improvements
                          - Process changes  
                          - Monitoring enhancements
                          - Training requirements`,
      
      communicationPlan: `Outline the communication plan for {{BRAND_NAME}}:
                         - Internal stakeholder notifications
                         - Member communication strategy
                         - Media response (if applicable)
                         - Follow-up communications`
    }
    
    return defaultPrompts[sectionKey] || `Generate content for ${sectionKey} section of the incident report.`
  }

  async getReportForBrand(issueId: string, brandId: string): Promise<IncidentReport | null> {
    const issue = await this.getIssue(issueId)
    if (!issue?.incidentReports[brandId]) {
      return null
    }
    
    const reportDoc = await this.firestore
      .collection('incident-reports')
      .doc(issue.incidentReports[brandId])
      .get()
    
    return reportDoc.exists ? reportDoc.data() as IncidentReport : null
  }

  async getAllReportsForIssue(issueId: string): Promise<IncidentReport[]> {
    const reportsQuery = this.firestore
      .collection('incident-reports')
      .where('issueId', '==', issueId)
    
    const snapshot = await reportsQuery.get()
    return snapshot.docs.map(doc => doc.data() as IncidentReport)
  }

  async updateReportStatus(reportId: string, status: IncidentReport['status']): Promise<void> {
    await this.firestore
      .collection('incident-reports')
      .doc(reportId)
      .update({ 
        status,
        ...(status === 'published' && { publishedAt: Timestamp.now() })
      })
  }
}

interface ContextData {
  issue: Issue
  brandImpact: BrandImpact
  happyFoxTickets: HappyFoxTicket[]
  jiraTickets: JiraTicket[]
  similarIssues: Issue[]
  timeline: TimelineEvent[]
  impactAnalysis: ImpactAnalysis
}

interface TimelineEvent {
  timestamp: Date
  event: string
  source: 'happyfox' | 'jira' | 'system'
  details: string
}

interface ImpactAnalysis {
  memberImpactByLocation: Record<string, number>
  serviceDisruptions: string[]
  businessImpactScore: number
  estimatedRevenueLoss?: number
}
```

#### 6. Enhanced Issue Orchestration with Incident Reporting

```typescript
// services/issue-orchestration.ts (Enhanced)
class IssueOrchestrationService {
  async processNewTicket(ticketData: NormalizedTicketData): Promise<ProcessingResult> {
    // ... existing similarity detection logic ...
    
    const result = await this.createOrLinkIssue(ticketData, similarIssues)
    
    // Check if incident reports should be generated
    if (this.shouldGenerateIncidentReports(result.issue)) {
      const brandIds = result.issue.brandImpacts
        .filter(impact => impact.totalAffectedMembers >= this.getAutoReportThreshold())
        .map(impact => impact.brandId)
      
      result.incidentReportsTriggered = brandIds
      
      // Generate reports asynchronously
      for (const brandId of brandIds) {
        this.incidentReportService.generateReport(result.issue, brandId)
          .catch(error => console.error(`Failed to generate report for brand ${brandId}:`, error))
      }
    }
    
    return result
  }

  private shouldGenerateIncidentReports(issue: Issue): boolean {
    return issue.requiresIncidentReport || 
           issue.totalAffectedMembers >= this.getAutoReportThreshold() ||
           issue.priority === 'urgent' ||
           issue.brandImpacts.some(impact => impact.impactLevel === 'critical')
  }

  private getAutoReportThreshold(): number {
    // Get from system config
    return 100 // members
  }
}
```

#### 7. UI Components for Incident Report Management

```typescript
// components/incident-reports/incident-report-selector.tsx
export function IncidentReportSelector({ issueId }: { issueId: string }) {
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null)

  useEffect(() => {
    // Load all reports for this issue
    loadIncidentReports(issueId).then(setReports)
  }, [issueId])

  const handleBrandSelect = (brandId: string) => {
    setSelectedBrand(brandId)
    const report = reports.find(r => r.brandId === brandId)
    setSelectedReport(report || null)
  }

  const copyReportToClipboard = () => {
    if (selectedReport) {
      const formattedReport = formatReportForCopy(selectedReport)
      navigator.clipboard.writeText(formattedReport)
      toast.success('Incident report copied to clipboard')
    }
  }

  const regenerateReport = async () => {
    if (selectedBrand) {
      try {
        const newReport = await generateIncidentReport(issueId, selectedBrand)
        setSelectedReport(newReport)
        toast.success('Incident report regenerated')
      } catch (error) {
        toast.error('Failed to regenerate report')
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incident Reports</CardTitle>
        <CardDescription>
          Generate and copy brand-specific incident reports
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Brand Selector */}
        <div>
          <Label>Select Brand</Label>
          <Select value={selectedBrand} onValueChange={handleBrandSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a brand..." />
            </SelectTrigger>
            <SelectContent>
              {reports.map(report => (
                <SelectItem key={report.brandId} value={report.brandId}>
                  {report.metadata.brandName} ({report.metadata.totalAffectedMembers} members affected)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Report Actions */}
        {selectedReport && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={copyReportToClipboard}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Report
              </Button>
              <Button variant="outline" onClick={regenerateReport}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            </div>
            
            {/* Report Preview */}
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm">
                {formatReportForDisplay(selectedReport)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatReportForCopy(report: IncidentReport): string {
  return `
# ${report.content.title}

## Executive Summary
${report.content.summary}

## Impact Assessment
${report.content.impactAssessment}

## Timeline
${report.content.timeline}

## Root Cause Analysis
${report.content.rootCause}

## Resolution
${report.content.resolution}

## Preventive Measures
${report.content.preventiveMeasures}

## Communication Plan
${report.content.communicationPlan}

---
Generated: ${report.generatedAt.toDate().toLocaleString()}
Affected Members: ${report.metadata.totalAffectedMembers}
Affected Locations: ${report.metadata.affectedLocations}
Business Impact: ${report.metadata.businessImpact}
  `.trim()
}
```

## Benefits of Webhook-First Approach

### ⚡ **Real-Time Processing**
- **Instant notifications** when tickets are created/updated
- **Sub-second latency** from ticket creation to issue intelligence
- **Immediate stakeholder notifications** for urgent issues
- **Real-time UI updates** without polling

### 📊 **Reduced API Usage**
- **90% reduction** in API calls vs polling
- **No rate limiting issues** during normal operation
- **Cost savings** on API usage fees
- **Better relationship** with external service providers

### 🔄 **Event Ordering & Consistency**
- **Guaranteed event ordering** with timestamps
- **Idempotency** with duplicate event detection
- **Reliable delivery** with webhook retries
- **Audit trail** of all ticket changes

### 🛡️ **Reliability & Backup**
- **Webhook-first** with scheduled reconciliation backup
- **Automatic recovery** from missed events
- **Data consistency** validation
- **Zero data loss** architecture

This webhook-first approach will provide near real-time issue intelligence while maintaining the reliability of the scheduled sync backup system!

## Updated Implementation Roadmap

### Phase 1: Foundation & Data Sync (Weeks 1-3)
**Week 1: Infrastructure Setup**
- Set up GCP project and services
- Configure Firestore collections with enhanced schema
- Set up CI/CD pipelines
- Create webhook endpoints for HappyFox and Jira
- Implement signature validation and security

**Week 2: Data Sync Implementation**
- Build HappyFox sync service with enhanced brand/location tracking
- Build Jira sync service with cross-platform correlation
- Implement webhook-first data ingestion
- Create backup reconciliation services
- Set up monitoring and alerting

**Week 3: Basic Issue Intelligence**
- Implement similarity detection using Vertex AI
- Build basic deduplication logic
- Create issue creation and linking workflows
- Set up stakeholder notification system
- Implement basic escalation rules

### Phase 2: Enhanced Intelligence & Incident Reporting (Weeks 4-6)
**Week 4: Advanced AI/ML Pipeline**
- Deploy custom embedding models for domain-specific matching
- Implement multi-factor similarity scoring
- Build advanced classification system
- Create dynamic priority escalation
- Optimize performance and accuracy

**Week 5: Incident Report Service**
- Integrate OpenAI API for report generation
- Create brand-specific report templates
- Implement member impact calculation algorithms
- Build timeline reconstruction from ticket history
- Create report approval and publishing workflows

**Week 6: UI Integration & Report Management**
- Build incident report selector component
- Implement copy-to-clipboard functionality
- Create brand dropdown and report preview
- Add report regeneration capabilities
- Implement real-time report status updates

### Phase 3: Integration & Orchestration (Weeks 7-8)
**Week 7: Cross-Platform Integration**
- Build Jira ticket creation from issues
- Implement bi-directional sync
- Create stakeholder intelligence system
- Build notification routing and preferences
- Implement escalation workflows

**Week 8: Issue Orchestration & Automation**
- Build comprehensive issue lifecycle management
- Implement automatic incident report triggering
- Create intelligent stakeholder assignment
- Build automated escalation and de-escalation
- Optimize end-to-end workflows

### Phase 4: Stakeholder Management & Advanced Features (Weeks 9-10)
**Week 9: Advanced Stakeholder Features**
- Build dynamic stakeholder assignment
- Implement timezone-aware notifications
- Create escalation path optimization
- Build stakeholder performance analytics
- Implement feedback loops for continuous improvement

**Week 10: Polish & Production Readiness**
- Comprehensive testing and quality assurance
- Performance optimization and monitoring setup
- Security audit and compliance verification
- Documentation and training materials
- Production deployment and rollout strategy

### Key Deliverables

#### Phase 1 Deliverables
- ✅ Webhook infrastructure with signature validation
- ✅ Firestore collections with enhanced schema
- ✅ Basic sync services for HappyFox and Jira
- ✅ Simple issue detection and linking
- ✅ Basic notification system

#### Phase 2 Deliverables
- ✅ Advanced AI/ML similarity detection
- ✅ Incident report generation service
- ✅ Brand-specific report templates
- ✅ UI components for report management
- ✅ Member impact tracking and calculation

#### Phase 3 Deliverables
- ✅ Cross-platform integration
- ✅ Automated Jira ticket creation
- ✅ Intelligent stakeholder assignment
- ✅ Escalation workflow automation
- ✅ Comprehensive issue orchestration

#### Phase 4 Deliverables
- ✅ Advanced stakeholder management
- ✅ Performance analytics and optimization
- ✅ Production-ready monitoring
- ✅ Security and compliance verification
- ✅ Complete documentation and training

## Success Metrics

### Core Intelligence Metrics
- **Deduplication Accuracy**: >95% correct issue linking
- **Response Time**: <30 seconds from webhook to issue creation/linking
- **False Positive Rate**: <5% incorrect issue associations
- **Escalation Accuracy**: >90% appropriate priority escalations
- **Stakeholder Notification Speed**: <60 seconds for urgent issues

### Enhanced Impact Tracking Metrics
- **Member Impact Accuracy**: ±5% variance in affected member counts
- **Location Impact Detection**: >98% accuracy in identifying affected locations
- **Brand Impact Correlation**: >95% accuracy in cross-brand issue detection
- **Service Disruption Detection**: >90% accuracy in identifying service outages

### Incident Reporting Metrics
- **Report Generation Speed**: <2 minutes for comprehensive incident reports
- **Report Accuracy**: >95% factual accuracy in generated content
- **Brand-Specific Customization**: 100% reports using correct brand templates
- **Auto-Generation Trigger Accuracy**: >98% appropriate automatic report creation
- **Copy-to-Clipboard Usage**: Track adoption and user satisfaction
- **Report Regeneration Rate**: <10% of reports require regeneration

### Business Impact Metrics
- **Issue Resolution Time**: 40% reduction in average resolution time
- **Executive Communication**: 80% reduction in time to create incident reports
- **Cross-Brand Coordination**: 60% improvement in multi-brand issue handling
- **Member Experience**: 25% reduction in duplicate support contacts
- **Operational Efficiency**: 50% reduction in manual issue triage time

### System Performance Metrics
- **Webhook Processing**: 99.9% successful webhook processing
- **AI/ML Model Performance**: <500ms for similarity detection
- **Firestore Query Performance**: <100ms for issue lookups
- **OpenAI API Performance**: <30s for incident report generation
- **Data Consistency**: 99.99% sync accuracy between HappyFox/Jira and Firestore
``` 