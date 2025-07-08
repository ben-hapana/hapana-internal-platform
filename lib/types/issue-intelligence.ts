import { Timestamp } from 'firebase/firestore'

// Brand and Location Impact Tracking
export interface BrandImpact {
  brandId: string
  brandName: string
  totalAffectedMembers: number
  impactLevel: 'low' | 'medium' | 'high' | 'critical'
  locationImpacts: LocationImpact[]
  incidentReport?: IncidentReport,
  affectedServices: string[]
}

export interface LocationImpact {
  locationId: string
  locationName: string
  brandId: string
  affectedMembers: number
  totalMembers: number
  impactPercentage: number
  impactLevel: 'low' | 'medium' | 'high' | 'critical'
  affectedServices: string[]
}

export interface IncidentReport {
  id: string
  brandId: string
  issueId: string
  status: 'draft' | 'generated' | 'reviewed' | 'published'
  generatedAt: Timestamp
  generatedBy: string // AI or user ID
  content: {
    title: string
    summary: string
    impactAssessment: string
    timeline: string
    rootCause: string
    resolution: string
    preventiveMeasures: string
    communicationPlan: string
  }
  metadata: {
    totalAffectedMembers: number
    affectedLocations: number
    estimatedDowntime: string
    businessImpact: 'low' | 'medium' | 'high' | 'critical'
    customerSegments: string[]
  }
  approvedBy?: string
  publishedAt?: Timestamp
}

// Core Issue Interface (Updated)
export interface Issue {
  id: string
  title: string
  description: string
  status: 'active' | 'monitoring' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created: Timestamp
  updated: Timestamp
  
  // Linking
  happyFoxTicketIds: string[]
  jiraTicketKeys: string[]
  
  // Enhanced Impact Tracking
  brandImpacts: BrandImpact[]
  totalAffectedMembers: number
  totalAffectedBrands: number
  totalAffectedLocations: number
  
  // Classification
  category: string
  tags: string[]
  
  // AI/ML
  embedding: number[]
  similarityScore?: number
  
  // Stakeholder Management
  watchers: StakeholderRef[]
  notifications: NotificationSettings
  
  // Incident Reporting
  incidentReports: Record<string, string> // brandId -> reportId
  requiresIncidentReport: boolean
}

// HappyFox Ticket Reference
export interface HappyFoxTicketRef {
  ticketId: string
  status: string
  priority: string
  brand: BrandReference
  location: LocationReference
  customer: CustomerReference
  created: Timestamp
  lastUpdated: Timestamp
}

// Jira Ticket Reference
export interface JiraTicketRef {
  key: string
  issueId: string
  status: string
  priority: string
  assignee: string
  affectedBrands: BrandReference[]
  created: Timestamp
  lastUpdated: Timestamp
}

// Enhanced Reference Types
export interface BrandReference {
  id: string
  name: string
  code: string // e.g., 'HAP', 'FIT', 'WEL'
  region: string
  memberCount: number
}

export interface LocationReference {
  id: string
  name: string
  brandId: string
  address: string
  memberCount: number
  services: string[]
  timezone: string
}

export interface CustomerReference {
  id: string
  name: string
  email: string
  phone?: string
  brandId: string
  locationId: string
  tier: 'standard' | 'premium' | 'enterprise'
  membershipType: string
}

// Stakeholder Reference
export interface StakeholderRef {
  userId: string
  email: string
  role: 'owner' | 'watcher' | 'contributor'
  brands: string[]
  notificationPreferences: NotificationSettings
}

// Notification Settings
export interface NotificationSettings {
  email: boolean
  slack: boolean
  sms: boolean
  frequency: 'immediate' | 'daily' | 'weekly'
}

// Normalized Ticket Data (from HappyFox webhook)
export interface NormalizedTicketData {
  ticketId: string
  title: string
  description: string
  status: string
  priority: string
  customer: CustomerReference
  created: Date
  updated: Date
  tags: string[]
  attachments?: AttachmentRef[]
}

// Attachment Reference
export interface AttachmentRef {
  id: string
  filename: string
  url: string
  mimeType: string
  size: number
  source: 'happyfox' | 'jira'
  sourceId: string // ticketId or ticketKey
  uploadedBy: {
    id: string
    name: string
    email: string
  }
  created: Timestamp
  thumbnailUrl?: string
  isPublic: boolean
}

// Similar Issue Detection
export interface SimilarIssue {
  issue: Issue
  similarityScore: number
  matchType: 'semantic' | 'keyword' | 'customer' | 'brand-location'
  confidence: number
  reasons: string[]
}

// Ticket Classification
export interface TicketClassification {
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  entities: {
    brands: BrandReference[]
    locations: LocationReference[]
    products: string[]
    features: string[]
    services: string[]
  }
  confidence: number
  suggestedTags: string[]
  requiresIncidentReport: boolean
  estimatedImpact: {
    memberCount: number
    businessImpact: 'low' | 'medium' | 'high' | 'critical'
    serviceDisruption: boolean
  }
}

// Deduplication Criteria
export interface DeduplicationCriteria {
  semanticSimilarity: number      // 0.8+ threshold
  keywordOverlap: number          // Common terms percentage
  brandLocationMatch: boolean     // Same brand/location
  timeWindow: number              // Within X hours
  customerHistory: boolean        // Same customer previous tickets
  productFeatureMatch: boolean    // Same product/feature affected
}

// Processing Result
export interface ProcessingResult {
  action: 'created' | 'linked' | 'updated'
  issueId: string
  confidence: number
  similarIssues?: SimilarIssue[]
  jiraTicketCreated?: boolean
  stakeholdersNotified: string[]
  incidentReportsTriggered: string[] // brandIds
}

// Escalation Action
export interface EscalationAction {
  action: 'escalate' | 'maintain' | 'de-escalate'
  newPriority?: 'low' | 'medium' | 'high' | 'urgent'
  notifyExecutives?: boolean
  notifyManagement?: boolean
  createWarRoom?: boolean
  additionalStakeholders?: string[]
  reason: string
  triggerIncidentReports?: string[] // brandIds
}

// Escalation Rule
export interface EscalationRule {
  id: string
  name: string
  condition: {
    priority?: string[]
    categories?: string[]
    brands?: string[]
    timeInStatus?: number // minutes
    customerTier?: string[]
    affectedMemberCount?: number
    businessHours?: boolean
  }
  action: {
    notifyRoles: string[]
    escalateTo: string[]
    createJiraTicket?: boolean
    scheduleMeeting?: boolean
    updatePriority?: 'low' | 'medium' | 'high' | 'urgent'
    generateIncidentReports?: boolean
  }
  enabled: boolean
  created: Timestamp
  updated: Timestamp
}

// Stakeholder Mapping
export interface StakeholderMapping {
  brands: Record<string, string[]>        // Brand → responsible teams
  categories: Record<string, string[]>    // Issue type → experts
  escalationRules: EscalationRule[]       // When to notify whom
  communicationPreferences: NotificationSettings
  timeZones: Record<string, string>       // Location → timezone
}

// Notification Event
export interface NotificationEvent {
  type: 'created' | 'updated' | 'escalated' | 'resolved' | 'linked' | 'incident_report_generated'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  issueId: string
  triggeredBy: string
  changes?: Record<string, unknown>
  timestamp: Timestamp
}

// Customer Data
export interface CustomerData {
  name: string
  email: string
  brand: string
  location: string
  tier: 'standard' | 'premium' | 'enterprise'
  accountManager?: string
  timezone: string
}

// ML Model Configuration
export interface MLModelConfig {
  embeddingModel: string
  classificationModel: string
  similarityThreshold: number
  confidenceThreshold: number
  maxSimilarIssues: number
}

// System Configuration
export interface SystemConfig {
  ml: MLModelConfig
  escalation: {
    timeWindows: {
      urgent: number    // minutes
      high: number
      medium: number
      low: number
    }
    businessHours: {
      [timezone: string]: {
        start: string   // HH:mm format
        end: string
        days: number[]  // 0-6, Sunday = 0
      }
    }
  }
  notifications: {
    batchSize: number
    retryAttempts: number
    rateLimits: {
      email: number     // per hour
      slack: number
      sms: number
    }
  }
  sync: {
    happyFoxPollInterval: number  // minutes
    jiraPollInterval: number
    maxRetries: number
  }
  incidentReporting: {
    openaiApiKey: string
    model: string // e.g., 'gpt-4'
    autoGenerateThreshold: number // affected member count
    templates: Record<string, IncidentReportTemplate>
  }
}

// Incident Report Template
export interface IncidentReportTemplate {
  id: string
  name: string
  brandId?: string // brand-specific template
  sections: {
    title: string
    summary: string
    impactAssessment: string
    timeline: string
    rootCause: string
    resolution: string
    preventiveMeasures: string
    communicationPlan: string
  }
  prompts: {
    [key: string]: string // OpenAI prompts for each section
  }
}

// Webhook Payload (HappyFox)
export interface HappyFoxWebhookPayload {
  event: 'ticket_created' | 'ticket_updated' | 'ticket_closed'
  ticket: {
    id: number
    subject: string
    text: string
    status: {
      id: number
      name: string
    }
    priority: {
      id: number
      name: string
    }
    category: {
      id: number
      name: string
    }
    user: {
      id: number
      name: string
      email: string
    }
    assignee?: {
      id: number
      name: string
      email: string
    }
    custom_fields: Record<string, unknown>
    created_at: string
    updated_at: string
    tags: string[]
  }
  timestamp: string
}

// API Response Types
export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  timestamp: string
}

// Service Interfaces
export interface SimilarityServiceInterface {
  findSimilarIssues(ticketData: NormalizedTicketData): Promise<SimilarIssue[]>
  generateEmbedding(text: string): Promise<number[]>
  calculateSimilarity(embedding1: number[], embedding2: number[]): number
}

export interface ClassificationServiceInterface {
  classifyTicket(ticketData: NormalizedTicketData): Promise<TicketClassification>
  extractEntities(text: string): Promise<TicketClassification['entities']>
  categorizeIssue(title: string, description: string): Promise<string>
}

export interface NotificationServiceInterface {
  notifyStakeholders(issue: Issue, event: NotificationEvent): Promise<void>
  sendEmail(to: string, subject: string, body: string): Promise<boolean>
  sendSlackMessage(channel: string, message: string): Promise<boolean>
  sendSMS(phone: string, message: string): Promise<boolean>
}

export interface EscalationServiceInterface {
  evaluateEscalation(issue: Issue): Promise<EscalationAction>
  executeEscalation(issue: Issue, action: EscalationAction): Promise<void>
  checkEscalationRules(issue: Issue): Promise<EscalationRule[]>
}

export interface IncidentReportServiceInterface {
  generateReport(issue: Issue, brandId: string): Promise<IncidentReport>
  getReportForBrand(issueId: string, brandId: string): Promise<IncidentReport | null>
  getAllReportsForIssue(issueId: string): Promise<IncidentReport[]>
  updateReportStatus(reportId: string, status: IncidentReport['status']): Promise<void>
}

// Database Collections
export interface FirestoreCollections {
  issues: Issue
  escalationRules: EscalationRule
  stakeholderMappings: StakeholderMapping
  systemConfig: SystemConfig
  notificationEvents: NotificationEvent
  processingLogs: ProcessingLog
  incidentReports: IncidentReport
  brands: BrandReference
  locations: LocationReference
  customers: CustomerReference
}

// Processing Log for debugging and analytics
export interface ProcessingLog {
  id: string
  ticketId: string
  issueId?: string
  action: string
  status: 'success' | 'error' | 'warning'
  processingTime: number // milliseconds
  similarIssuesFound: number
  confidence: number
  error?: string
  metadata: Record<string, unknown>
  timestamp: Timestamp
}

// HappyFox Ticket Updates/Messages (similar to comments)
export interface HappyFoxTicketUpdate {
  id: string
  ticketId: string
  type: 'note' | 'reply' | 'status_change' | 'assignment' | 'priority_change'
  content: string
  htmlContent?: string
  author: {
    id: string
    name: string
    email: string
    type: 'staff' | 'customer'
  }
  isPublic: boolean
  attachments: AttachmentRef[]
  created: Timestamp
  metadata?: {
    statusChange?: { from: string, to: string }
    priorityChange?: { from: string, to: string }
    assignmentChange?: { from: string, to: string }
  }
}

// Jira Ticket Comments
export interface JiraTicketComment {
  id: string
  ticketKey: string // References jira_tickets collection
  content: string
  author: {
    accountId: string
    displayName: string
    emailAddress: string
    avatarUrl?: string
  }
  created: Timestamp
  updated: Timestamp
  visibility?: {
    type: 'group' | 'role'
    value: string
  }
  isInternal: boolean
}



// Sync State Tracking
export interface SyncState {
  id: string // 'happyfox' | 'jira'
  lastSyncTimestamp: Timestamp
  lastSyncedId?: string // Last processed ticket ID
  syncStatus: 'idle' | 'syncing' | 'error'
  errorMessage?: string
  totalProcessed: number
  totalErrors: number
  syncBatch: {
    batchId: string
    startTime: Timestamp
    endTime?: Timestamp
    recordsProcessed: number
    recordsSkipped: number
    recordsErrored: number
  }
}

// Algolia Search Index Metadata
export interface SearchIndexMetadata {
  id: string // Document ID in Firestore
  algoliaObjectId: string // Object ID in Algolia
  indexName: 'tickets' | 'issues' | 'comments'
  sourceCollection: string
  sourceDocumentId: string
  lastIndexed: Timestamp
  indexedFields: string[]
  searchableContent: string // Concatenated searchable text
  facets: {
    source: 'happyfox' | 'jira'
    status: string
    priority: string
    brandId: string
    locationId?: string
    category?: string
    assignee?: string
    tags: string[]
  }
}

 