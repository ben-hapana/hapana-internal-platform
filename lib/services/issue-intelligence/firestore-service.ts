import { adminDb } from '@/firebase/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { 
  Issue, 
  IncidentReport, 
  BrandReference, 
  LocationReference, 
  CustomerReference,
  HappyFoxTicketRef,
  JiraTicketRef,
  ProcessingLog,
  HappyFoxTicketUpdate,
  JiraTicketComment,
  AttachmentRef,
  SyncState,
  SearchIndexMetadata
} from '@/lib/types/issue-intelligence'

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

export class IssueIntelligenceFirestoreService {
  
  // ============ ISSUES ============
  
  async createIssue(issue: Omit<Issue, 'id' | 'created' | 'updated'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.ISSUES).add({
      ...issue,
      created: FieldValue.serverTimestamp(),
      updated: FieldValue.serverTimestamp()
    })
    return docRef.id
  }

  async updateIssue(id: string, updates: Partial<Issue>): Promise<void> {
    await adminDb.collection(COLLECTIONS.ISSUES).doc(id).update({
      ...updates,
      updated: FieldValue.serverTimestamp()
    })
  }

  async getIssue(id: string): Promise<Issue | null> {
    const doc = await adminDb.collection(COLLECTIONS.ISSUES).doc(id).get()
    return doc.exists ? { id: doc.id, ...doc.data() } as Issue : null
  }

  async getRecentIssues(limit: number = 50): Promise<Issue[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.ISSUES)
      .orderBy('updated', 'desc')
      .limit(limit)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Issue))
  }

  // ============ INCIDENT REPORTS ============

  async createIncidentReport(report: Omit<IncidentReport, 'id'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).add(report)
    return docRef.id
  }

  // ============ BRANDS & LOCATIONS ============

  async getBrand(id: string): Promise<BrandReference | null> {
    const doc = await adminDb.collection(COLLECTIONS.BRANDS).doc(id).get()
    return doc.exists ? { id: doc.id, ...doc.data() } as BrandReference : null
  }

  async createBrand(brand: BrandReference): Promise<void> {
    await adminDb.collection(COLLECTIONS.BRANDS).doc(brand.id).set(brand)
  }

  async getAllBrands(): Promise<BrandReference[]> {
    const snapshot = await adminDb.collection(COLLECTIONS.BRANDS).get()
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BrandReference))
  }

  async getLocationsByBrand(brandId: string): Promise<LocationReference[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.LOCATIONS)
      .where('brandId', '==', brandId)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as LocationReference))
  }

  async createLocation(location: LocationReference): Promise<void> {
    await adminDb.collection(COLLECTIONS.LOCATIONS).doc(location.id).set(location)
  }

  // ============ CUSTOMERS ============

  async createCustomer(customer: Omit<CustomerReference, 'id'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.CUSTOMERS).add(customer)
    return docRef.id
  }

  async getCustomerByEmail(email: string): Promise<CustomerReference | null> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.CUSTOMERS)
      .where('email', '==', email)
      .limit(1)
      .get()
    
    return snapshot.empty ? null : {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as CustomerReference
  }

  // ============ TICKETS ============

  async createHappyFoxTicket(ticket: HappyFoxTicketRef): Promise<void> {
    await adminDb.collection(COLLECTIONS.HAPPYFOX_TICKETS).doc(ticket.ticketId).set({
      ...ticket,
      lastUpdated: FieldValue.serverTimestamp()
    })
  }

  async createJiraTicket(ticket: JiraTicketRef): Promise<void> {
    await adminDb.collection(COLLECTIONS.JIRA_TICKETS).doc(ticket.key).set({
      ...ticket,
      lastUpdated: FieldValue.serverTimestamp()
    })
  }

  async getHappyFoxTicket(ticketId: string): Promise<HappyFoxTicketRef | null> {
    const doc = await adminDb.collection(COLLECTIONS.HAPPYFOX_TICKETS).doc(ticketId).get()
    return doc.exists ? doc.data() as HappyFoxTicketRef : null
  }

  async getJiraTicket(ticketKey: string): Promise<JiraTicketRef | null> {
    const doc = await adminDb.collection(COLLECTIONS.JIRA_TICKETS).doc(ticketKey).get()
    return doc.exists ? doc.data() as JiraTicketRef : null
  }

  async getIncidentReport(reportId: string): Promise<IncidentReport | null> {
    const doc = await adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).doc(reportId).get()
    return doc.exists ? { id: doc.id, ...doc.data() } as IncidentReport : null
  }

  async getIncidentReportsByIssue(issueId: string): Promise<IncidentReport[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.INCIDENT_REPORTS)
      .where('issueId', '==', issueId)
      .orderBy('generatedAt', 'desc')
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as IncidentReport))
  }

  async getIncidentReportByBrand(issueId: string, brandId: string): Promise<IncidentReport | null> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.INCIDENT_REPORTS)
      .where('issueId', '==', issueId)
      .where('brandId', '==', brandId)
      .limit(1)
      .get()
    
    return snapshot.empty ? null : {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as IncidentReport
  }

  async updateIncidentReportStatus(reportId: string, status: IncidentReport['status']): Promise<void> {
    await adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).doc(reportId).update({
      status,
      updated: FieldValue.serverTimestamp()
    })
  }

  // ============ LOGGING ============

  async createProcessingLog(log: Omit<ProcessingLog, 'id' | 'timestamp'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.PROCESSING_LOGS).add({
      ...log,
      timestamp: FieldValue.serverTimestamp()
    })
    return docRef.id
  }

  // ============ HAPPYFOX TICKET UPDATES ============

  async createHappyFoxTicketUpdate(update: Omit<HappyFoxTicketUpdate, 'id'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.HAPPYFOX_TICKET_UPDATES).add({
      ...update,
      created: FieldValue.serverTimestamp()
    })
    return docRef.id
  }

  async getHappyFoxTicketUpdates(ticketId: string): Promise<HappyFoxTicketUpdate[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.HAPPYFOX_TICKET_UPDATES)
      .where('ticketId', '==', ticketId)
      .orderBy('created', 'desc')
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as HappyFoxTicketUpdate))
  }

  // ============ JIRA TICKET COMMENTS ============

  async createJiraTicketComment(comment: Omit<JiraTicketComment, 'id'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.JIRA_TICKET_COMMENTS).add(comment)
    return docRef.id
  }

  async getJiraTicketComments(ticketKey: string): Promise<JiraTicketComment[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.JIRA_TICKET_COMMENTS)
      .where('ticketKey', '==', ticketKey)
      .orderBy('created', 'asc')
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as JiraTicketComment))
  }



  // ============ TICKET ATTACHMENTS ============

  async createAttachment(attachment: Omit<AttachmentRef, 'id'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.TICKET_ATTACHMENTS).add(attachment)
    return docRef.id
  }

  async getAttachmentsBySource(sourceId: string, source: 'happyfox' | 'jira'): Promise<AttachmentRef[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.TICKET_ATTACHMENTS)
      .where('sourceId', '==', sourceId)
      .where('source', '==', source)
      .orderBy('created', 'desc')
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttachmentRef))
  }

  // ============ SYNC STATE MANAGEMENT ============

  async updateSyncState(syncState: SyncState): Promise<void> {
    await adminDb.collection(COLLECTIONS.SYNC_STATE).doc(syncState.id).set(syncState)
  }

  async getSyncState(id: 'happyfox' | 'jira'): Promise<SyncState | null> {
    const doc = await adminDb.collection(COLLECTIONS.SYNC_STATE).doc(id).get()
    return doc.exists ? doc.data() as SyncState : null
  }

  // ============ SEARCH INDEX METADATA ============

  async createSearchIndexMetadata(metadata: Omit<SearchIndexMetadata, 'id'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.SEARCH_INDEX_METADATA).add({
      ...metadata,
      lastIndexed: FieldValue.serverTimestamp()
    })
    return docRef.id
  }

  async updateSearchIndexMetadata(id: string, updates: Partial<SearchIndexMetadata>): Promise<void> {
    await adminDb.collection(COLLECTIONS.SEARCH_INDEX_METADATA).doc(id).update({
      ...updates,
      lastIndexed: FieldValue.serverTimestamp()
    })
  }

  async getSearchIndexMetadata(sourceCollection: string, sourceDocumentId: string): Promise<SearchIndexMetadata | null> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.SEARCH_INDEX_METADATA)
      .where('sourceCollection', '==', sourceCollection)
      .where('sourceDocumentId', '==', sourceDocumentId)
      .limit(1)
      .get()
    
    return snapshot.empty ? null : {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    } as SearchIndexMetadata
  }
}

// Export singleton instance
export const firestoreService = new IssueIntelligenceFirestoreService() 