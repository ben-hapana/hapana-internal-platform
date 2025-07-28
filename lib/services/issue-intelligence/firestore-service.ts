import { getAdminDb } from '@/firebase/firebase-admin'
import { 
  IssueData, 
  IncidentReport, 
  Brand, 
  Location, 
  Customer,
  HappyFoxTicket,
  JiraTicket,
  TicketAttachment,
  SyncState,
  ProcessingLog,
  HappyFoxTicketUpdate,
  JiraTicketComment
} from '@/lib/types/issue-intelligence'
import { Timestamp } from 'firebase-admin/firestore'

// Collections
const COLLECTIONS = {
  ISSUES: 'issues',
  INCIDENT_REPORTS: 'incident-reports',
  BRANDS: 'brands',
  LOCATIONS: 'locations',
  CUSTOMERS: 'customers',
  HAPPYFOX_TICKETS: 'happyfox-tickets',
  HAPPYFOX_TICKET_UPDATES: 'happyfox-ticket-updates',
  JIRA_TICKETS: 'jira-tickets',
  JIRA_TICKET_COMMENTS: 'jira-ticket-comments',
  TICKET_ATTACHMENTS: 'ticket-attachments',
  INCIDENT_REPORT_TEMPLATES: 'incident-report-templates',
  PROCESSING_LOGS: 'processing-logs',
  SYNC_STATE: 'sync-state',
  SEARCH_INDEX_METADATA: 'search-index-metadata'
} as const

export const firestoreService = {
  // Issues
  async createIssue(issueData: Omit<IssueData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.ISSUES).add({
      ...issueData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    return docRef.id
  },

  async updateIssue(id: string, updates: Partial<IssueData>): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.ISSUES).doc(id).update({
      ...updates,
      updatedAt: Timestamp.now()
    })
  },

  async getIssue(id: string): Promise<IssueData | null> {
    const adminDb = getAdminDb()
    const doc = await adminDb.collection(COLLECTIONS.ISSUES).doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as IssueData
  },

  async getIssues(limit: number = 50): Promise<IssueData[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.ISSUES)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as IssueData[]
  },

  // Incident Reports
  async createIncidentReport(report: Omit<IncidentReport, 'id' | 'createdAt'>): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).add({
      ...report,
      createdAt: Timestamp.now()
    })
    return docRef.id
  },

  // Brand operations
  async getBrand(id: string): Promise<Brand | null> {
    const adminDb = getAdminDb()
    const doc = await adminDb.collection(COLLECTIONS.BRANDS).doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as Brand
  },

  async createOrUpdateBrand(brand: Brand): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.BRANDS).doc(brand.id).set(brand)
  },

  async getBrands(): Promise<Brand[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb.collection(COLLECTIONS.BRANDS).get()
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Brand[]
  },

  // Location operations
  async getLocationsByBrand(brandId: string): Promise<Location[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.LOCATIONS)
      .where('brandId', '==', brandId)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Location[]
  },

  async createOrUpdateLocation(location: Location): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.LOCATIONS).doc(location.id).set(location)
  },

  // Customer operations
  async createCustomer(customer: Omit<Customer, 'id'>): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.CUSTOMERS).add(customer)
    return docRef.id
  },

  async getCustomersByBrand(brandId: string): Promise<Customer[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.CUSTOMERS)
      .where('brandId', '==', brandId)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Customer[]
  },

  // Ticket operations
  async storeHappyFoxTicket(ticket: HappyFoxTicket): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.HAPPYFOX_TICKETS).doc(ticket.ticketId).set({
      ...ticket,
      lastUpdated: Timestamp.now()
    })
  },

  async storeJiraTicket(ticket: JiraTicket): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.JIRA_TICKETS).doc(ticket.key).set({
      ...ticket,
      lastUpdated: Timestamp.now()
    })
  },

  async getHappyFoxTicket(ticketId: string): Promise<HappyFoxTicket | null> {
    const adminDb = getAdminDb()
    const doc = await adminDb.collection(COLLECTIONS.HAPPYFOX_TICKETS).doc(ticketId).get()
    if (!doc.exists) return null
    return doc.data() as HappyFoxTicket
  },

  async getJiraTicket(ticketKey: string): Promise<JiraTicket | null> {
    const adminDb = getAdminDb()
    const doc = await adminDb.collection(COLLECTIONS.JIRA_TICKETS).doc(ticketKey).get()
    if (!doc.exists) return null
    return doc.data() as JiraTicket
  },

  async getIncidentReport(reportId: string): Promise<IncidentReport | null> {
    const adminDb = getAdminDb()
    const doc = await adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).doc(reportId).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as IncidentReport
  },

  async getRecentIncidentReports(limit: number = 10): Promise<IncidentReport[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.INCIDENT_REPORTS)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as IncidentReport[]
  },

  async getIncidentReportsByBrand(brandId: string, limit: number = 50): Promise<IncidentReport[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.INCIDENT_REPORTS)
      .where('brandId', '==', brandId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as IncidentReport[]
  },

  async updateIncidentReport(reportId: string, updates: Partial<IncidentReport>): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).doc(reportId).update({
      ...updates,
      updatedAt: Timestamp.now()
    })
  },

  // Processing logs
  async createProcessingLog(log: Omit<ProcessingLog, 'id' | 'timestamp'>): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.PROCESSING_LOGS).add({
      ...log,
      timestamp: Timestamp.now()
    })
    return docRef.id
  },

  // Ticket updates
  async createTicketUpdate(update: Omit<HappyFoxTicketUpdate, 'id' | 'timestamp'>): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.HAPPYFOX_TICKET_UPDATES).add({
      ...update,
      timestamp: Timestamp.now()
    })
    return docRef.id
  },

  async getTicketUpdates(ticketId: string): Promise<HappyFoxTicketUpdate[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.HAPPYFOX_TICKET_UPDATES)
      .where('ticketId', '==', ticketId)
      .orderBy('timestamp', 'desc')
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HappyFoxTicketUpdate[]
  },

  // Jira comments
  async createJiraComment(comment: Omit<JiraTicketComment, 'id'>): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.JIRA_TICKET_COMMENTS).add(comment)
    return docRef.id
  },

  async getJiraComments(ticketKey: string): Promise<JiraTicketComment[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.JIRA_TICKET_COMMENTS)
      .where('ticketKey', '==', ticketKey)
      .orderBy('createdAt', 'asc')
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as JiraTicketComment[]
  },

  // Attachments
  async createAttachment(attachment: Omit<TicketAttachment, 'id'>): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.TICKET_ATTACHMENTS).add(attachment)
    return docRef.id
  },

  async getAttachments(ticketId: string, source: 'happyfox' | 'jira'): Promise<TicketAttachment[]> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.TICKET_ATTACHMENTS)
      .where('ticketId', '==', ticketId)
      .where('source', '==', source)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TicketAttachment[]
  },

  // Sync state
  async updateSyncState(syncState: SyncState): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.SYNC_STATE).doc(syncState.id).set(syncState)
  },

  async getSyncState(id: string): Promise<SyncState | null> {
    const adminDb = getAdminDb()
    const doc = await adminDb.collection(COLLECTIONS.SYNC_STATE).doc(id).get()
    if (!doc.exists) return null
    return doc.data() as SyncState
  },

  // Search index metadata
  async createSearchIndexMetadata(metadata: { collection: string, lastIndexed: Timestamp, documentCount: number }): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.SEARCH_INDEX_METADATA).add({
      ...metadata,
      createdAt: Timestamp.now()
    })
    return docRef.id
  },

  async updateSearchIndexMetadata(id: string, updates: { lastIndexed: Timestamp, documentCount: number }): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.SEARCH_INDEX_METADATA).doc(id).update({
      ...updates,
      updatedAt: Timestamp.now()
    })
  },

  async getSearchIndexMetadata(): Promise<Array<{ id: string, collection: string, lastIndexed: Timestamp, documentCount: number }>> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.SEARCH_INDEX_METADATA)
      .orderBy('createdAt', 'desc')
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Array<{ id: string, collection: string, lastIndexed: Timestamp, documentCount: number }>
  }
} 