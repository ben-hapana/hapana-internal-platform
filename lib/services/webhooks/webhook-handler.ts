import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { 
  HappyFoxWebhookPayload, 
  NormalizedTicketData,
  BrandReference,
  LocationReference,
  CustomerReference,
  HappyFoxTicketRef,
  JiraTicketRef
} from '@/lib/types/issue-intelligence'
import { firestoreService } from '../issue-intelligence/firestore-service'

export interface WebhookValidationResult {
  isValid: boolean
  error?: string
  payload?: HappyFoxWebhookPayload | JiraWebhookPayload
}

export interface JiraWebhookPayload {
  webhookEvent: string
  issue: {
    id: string
    key: string
    fields: {
      summary: string
      description: string
      status: {
        name: string
      }
      priority: {
        name: string
      }
      assignee?: {
        displayName: string
        emailAddress: string
      }
      created: string
      updated: string
      labels: string[]
      customfield_10000?: string // Epic Link or similar
    }
  }
  user: {
    displayName: string
    emailAddress: string
  }
  timestamp: number
}

export class WebhookHandler {
  
  // ============ HAPPYFOX WEBHOOK HANDLING ============
  
  async validateHappyFoxWebhook(request: NextRequest): Promise<WebhookValidationResult> {
    try {
      const body = await request.text()
      const signature = request.headers.get('x-happyfox-signature')
      const secret = process.env.HAPPYFOX_WEBHOOK_SECRET

      if (!signature || !secret) {
        return { isValid: false, error: 'Missing signature or secret' }
      }

      // Validate HMAC signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex')

      const providedSignature = signature.replace('sha256=', '')

      if (!crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      )) {
        return { isValid: false, error: 'Invalid signature' }
      }

      const payload: HappyFoxWebhookPayload = JSON.parse(body)
      return { isValid: true, payload }

    } catch (error) {
      return { 
        isValid: false, 
        error: `Webhook validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  async processHappyFoxWebhook(payload: HappyFoxWebhookPayload): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log(`Processing HappyFox webhook: ${payload.event} for ticket ${payload.ticket.id}`)

      // Normalize the ticket data
      const normalizedTicket = await this.normalizeHappyFoxTicket(payload)
      
      // Store/update the ticket in Firestore
      await this.storeHappyFoxTicket(payload, normalizedTicket)
      
      // Trigger issue intelligence processing
      await this.triggerIssueIntelligence(normalizedTicket)

      // Log successful processing
      await firestoreService.createProcessingLog({
        ticketId: payload.ticket.id.toString(),
        action: `happyfox_${payload.event}`,
        status: 'success',
        processingTime: Date.now() - startTime,
        similarIssuesFound: 0, // Will be updated by issue intelligence
        confidence: 0,
        metadata: {
          event: payload.event,
          ticketStatus: payload.ticket.status.name,
          ticketPriority: payload.ticket.priority.name
        }
      })

    } catch (error) {
      console.error('Failed to process HappyFox webhook:', error)
      
      // Log error
      await firestoreService.createProcessingLog({
        ticketId: payload.ticket.id.toString(),
        action: `happyfox_${payload.event}`,
        status: 'error',
        processingTime: Date.now() - startTime,
        similarIssuesFound: 0,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          event: payload.event,
          ticketStatus: payload.ticket.status?.name,
          ticketPriority: payload.ticket.priority?.name
        }
      })
      
      throw error
    }
  }

  private async normalizeHappyFoxTicket(payload: HappyFoxWebhookPayload): Promise<NormalizedTicketData> {
    // Extract brand and location from custom fields or ticket data
    const brandInfo = await this.extractBrandFromHappyFoxTicket(payload)
    const locationInfo = await this.extractLocationFromHappyFoxTicket(payload, brandInfo)
    const customerInfo = await this.extractCustomerFromHappyFoxTicket(payload, brandInfo, locationInfo)

    return {
      ticketId: payload.ticket.id.toString(),
      title: payload.ticket.subject,
      description: payload.ticket.text,
      status: payload.ticket.status.name,
      priority: this.mapHappyFoxPriority(payload.ticket.priority.name),
      customer: customerInfo,
      created: new Date(payload.ticket.created_at),
      updated: new Date(payload.ticket.updated_at),
      tags: payload.ticket.tags || [],
      attachments: [] // TODO: Extract attachments if available
    }
  }

  private async extractBrandFromHappyFoxTicket(payload: HappyFoxWebhookPayload): Promise<BrandReference> {
    // Try to extract brand from custom fields
    const brandCode = (payload.ticket.custom_fields as Record<string, unknown>)?.brand || 
                     (payload.ticket.custom_fields as Record<string, unknown>)?.brand_code ||
                     'HAP' // Default fallback

    // Look up brand in Firestore
    const brands = await firestoreService.getAllBrands()
    const brand = brands.find((b: BrandReference) => b.code === brandCode)

    if (brand) {
      return brand
    }

    // Create default brand if not found
    const defaultBrand: BrandReference = {
      id: 'default',
      name: 'Unknown Brand',
      code: brandCode as string,
      region: 'Unknown',
      memberCount: 0
    }

    return defaultBrand
  }

  private async extractLocationFromHappyFoxTicket(
    payload: HappyFoxWebhookPayload, 
    brand: BrandReference
  ): Promise<LocationReference> {
    // Try to extract location from custom fields
    const locationName = (payload.ticket.custom_fields as Record<string, unknown>)?.location ||
                         (payload.ticket.custom_fields as Record<string, unknown>)?.gym_location ||
                         'Unknown Location'

    // Look up location in Firestore
    const locations = await firestoreService.getLocationsByBrand(brand.id)
    const location = locations.find((l: LocationReference) => 
      l.name.toLowerCase().includes((locationName as string).toLowerCase())
    )

    if (location) {
      return location
    }

    // Create default location if not found
    const defaultLocation: LocationReference = {
      id: 'default',
      name: locationName as string,
      brandId: brand.id,
      address: 'Unknown',
      memberCount: 0,
      services: [],
      timezone: 'UTC'
    }

    return defaultLocation
  }

  private async extractCustomerFromHappyFoxTicket(
    payload: HappyFoxWebhookPayload,
    brand: BrandReference,
    location: LocationReference
  ): Promise<CustomerReference> {
    // Check if customer already exists
    const existingCustomer = await firestoreService.getCustomerByEmail(payload.ticket.user.email)
    
    if (existingCustomer) {
      return existingCustomer
    }

    // Create new customer
    const newCustomer: CustomerReference = {
      id: `customer_${payload.ticket.user.id}`,
      name: payload.ticket.user.name,
      email: payload.ticket.user.email,
      brandId: brand.id,
      locationId: location.id,
      tier: 'standard', // Default tier
      membershipType: 'regular'
    }

    // Store customer in Firestore
    await firestoreService.createCustomer(newCustomer)

    return newCustomer
  }

  private async storeHappyFoxTicket(payload: HappyFoxWebhookPayload, normalized: NormalizedTicketData): Promise<void> {
    const brand = await firestoreService.getBrand(normalized.customer.brandId)
    const location = await firestoreService.getLocationsByBrand(normalized.customer.brandId)
    const foundLocation = location.find(l => l.id === normalized.customer.locationId)

    const ticket: HappyFoxTicketRef = {
      ticketId: payload.ticket.id.toString(),
      status: payload.ticket.status.name,
      priority: this.mapHappyFoxPriority(payload.ticket.priority.name),
      brand: brand || {
        id: normalized.customer.brandId,
        name: 'Unknown Brand',
        code: 'UNK',
        region: 'Unknown',
        memberCount: 0
      },
      location: foundLocation || {
        id: normalized.customer.locationId,
        name: 'Unknown Location',
        brandId: normalized.customer.brandId,
        address: 'Unknown',
        memberCount: 0,
        services: [],
        timezone: 'UTC'
      },
      customer: normalized.customer,
      // @ts-expect-error - Timestamp is not a valid type for the created and lastUpdated fields
      created: Timestamp.fromDate(new Date(payload.ticket.created_at)),
      // @ts-expect-error - Timestamp is not a valid type for the created and lastUpdated fields
      lastUpdated: Timestamp.fromDate(new Date(payload.ticket.updated_at))
    }

    await firestoreService.createHappyFoxTicket(ticket)
  }

  // ============ JIRA WEBHOOK HANDLING ============

  async validateJiraWebhook(request: NextRequest): Promise<WebhookValidationResult> {
    try {
      const body = await request.text()
      // Jira webhooks can use various authentication methods
      // For now, we'll implement a simple token-based validation
      const authHeader = request.headers.get('authorization')
      const expectedToken = process.env.JIRA_WEBHOOK_TOKEN

      if (!authHeader || !expectedToken) {
        return { isValid: false, error: 'Missing authorization header or token' }
      }

      if (authHeader !== `Bearer ${expectedToken}`) {
        return { isValid: false, error: 'Invalid authorization token' }
      }

      const payload: JiraWebhookPayload = JSON.parse(body)
      return { isValid: true, payload }

    } catch (error) {
      return { 
        isValid: false, 
        error: `Jira webhook validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  async processJiraWebhook(payload: JiraWebhookPayload): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log(`Processing Jira webhook: ${payload.webhookEvent} for issue ${payload.issue.key}`)

      // Store/update the Jira ticket
      await this.storeJiraTicket(payload)

      // If this is a new issue, check if it should be linked to existing issues
      if (payload.webhookEvent === 'jira:issue_created') {
        await this.checkJiraIssueForLinking(payload)
      }

      // Log successful processing
      await firestoreService.createProcessingLog({
        ticketId: payload.issue.key,
        action: `jira_${payload.webhookEvent}`,
        status: 'success',
        processingTime: Date.now() - startTime,
        similarIssuesFound: 0,
        confidence: 0,
        metadata: {
          event: payload.webhookEvent,
          issueType: payload.issue.fields.status.name,
          priority: payload.issue.fields.priority.name
        }
      })

    } catch (error) {
      console.error('Failed to process Jira webhook:', error)
      
      await firestoreService.createProcessingLog({
        ticketId: payload.issue.key,
        action: `jira_${payload.webhookEvent}`,
        status: 'error',
        processingTime: Date.now() - startTime,
        similarIssuesFound: 0,
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          event: payload.webhookEvent,
          issueType: payload.issue.fields.status?.name,
          priority: payload.issue.fields.priority?.name
        }
      })
      
      throw error
    }
  }

  private async storeJiraTicket(payload: JiraWebhookPayload): Promise<void> {
    const ticket: JiraTicketRef = {
      key: payload.issue.key,
      issueId: payload.issue.id,
      status: payload.issue.fields.status.name,
      priority: this.mapJiraPriority(payload.issue.fields.priority.name),
      assignee: payload.issue.fields.assignee?.displayName || 'Unassigned',
      affectedBrands: [], // TODO: Extract from custom fields
      // @ts-expect-error - Timestamp is not a valid type for the created and lastUpdated fields
      created: Timestamp.fromDate(new Date(payload.issue.fields.created)),
      // @ts-expect-error - Timestamp is not a valid type for the created and lastUpdated fields
      lastUpdated: Timestamp.fromDate(new Date(payload.issue.fields.updated))
    }

    await firestoreService.createJiraTicket(ticket)
  }

  private async checkJiraIssueForLinking(payload: JiraWebhookPayload): Promise<void> {
    // TODO: Implement logic to check if this Jira issue should be linked to existing issues
    // This could be based on:
    // - Keywords in summary/description
    // - Custom fields indicating related HappyFox tickets
    // - Labels or components
    console.log(`Checking Jira issue ${payload.issue.key} for potential linking`)
  }

  // ============ UTILITIES ============

  private mapHappyFoxPriority(priority: string): 'low' | 'medium' | 'high' | 'urgent' {
    const lowerPriority = priority.toLowerCase()
    if (lowerPriority.includes('urgent') || lowerPriority.includes('critical')) return 'urgent'
    if (lowerPriority.includes('high')) return 'high'
    if (lowerPriority.includes('low')) return 'low'
    return 'medium'
  }

  private mapJiraPriority(priority: string): 'low' | 'medium' | 'high' | 'urgent' {
    const lowerPriority = priority.toLowerCase()
    if (lowerPriority.includes('critical') || lowerPriority.includes('blocker')) return 'urgent'
    if (lowerPriority.includes('major') || lowerPriority.includes('high')) return 'high'
    if (lowerPriority.includes('trivial') || lowerPriority.includes('low')) return 'low'
    return 'medium'
  }

  private async triggerIssueIntelligence(ticketData: NormalizedTicketData): Promise<void> {
    try {
      // Import and use the issue orchestration service
      const { issueOrchestrationService } = await import('../issue-intelligence/issue-orchestration')
      
      const result = await issueOrchestrationService.processNewTicket(ticketData)
      
      console.log(`Issue intelligence processed ticket ${ticketData.ticketId}:`, {
        action: result.action,
        issueId: result.issueId,
        confidence: result.confidence,
        incidentReportsTriggered: result.incidentReportsTriggered
      })
      
    } catch (error) {
      console.error(`Failed to process issue intelligence for ticket ${ticketData.ticketId}:`, error)
      // Don't throw here - we want the webhook to succeed even if issue intelligence fails
    }
  }
}

// Export singleton instance
export const webhookHandler = new WebhookHandler() 