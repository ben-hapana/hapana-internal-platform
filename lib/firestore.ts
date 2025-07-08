import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'

// Data Models
export interface TestResult {
  id?: string
  testName: string
  environment: 'production' | 'staging' | 'development'
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  errorMessage?: string
  timestamp: Timestamp
  userId: string
  userEmail: string
}

export interface SupportTicket {
  id?: string
  title: string
  description: string
  status: 'open' | 'pending' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: string
  sentiment: 'positive' | 'neutral' | 'negative'
  assignedTo?: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  tags: string[]
  source: 'web' | 'email' | 'phone' | 'chat'
  happyfoxId?: string
  jiraId?: string
}

export interface UserProfile {
  id?: string
  uid: string
  email: string
  displayName: string
  role: 'admin' | 'qa' | 'support' | 'viewer'
  department: string
  preferences: {
    notifications: boolean
    dashboardLayout: string
    theme: 'light' | 'dark' | 'system'
  }
  createdAt: Timestamp
  lastActive: Timestamp
}

// Collections
const COLLECTIONS = {
  TEST_RESULTS: 'testResults',
  SUPPORT_TICKETS: 'supportTickets', 
  USER_PROFILES: 'userProfiles',
  SYSTEM_CONFIG: 'systemConfig'
} as const

// Helper function to convert Firestore doc to typed object
function docToData<T>(doc: QueryDocumentSnapshot<DocumentData>): T {
  return {
    id: doc.id,
    ...doc.data()
  } as T
}

// Test Results Service
export const testResultsService = {
  // Create a new test result
  async create(testResult: Omit<TestResult, 'id' | 'timestamp'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.TEST_RESULTS), {
      ...testResult,
      timestamp: serverTimestamp()
    })
    return docRef.id
  },

  // Update test result (e.g., when test completes)
  async update(id: string, updates: Partial<TestResult>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.TEST_RESULTS, id)
    await updateDoc(docRef, {
      ...updates,
      timestamp: serverTimestamp()
    })
  },

  // Get test results by environment
  async getByEnvironment(environment: string): Promise<TestResult[]> {
    const q = query(
      collection(db, COLLECTIONS.TEST_RESULTS),
      where('environment', '==', environment),
      orderBy('timestamp', 'desc'),
      limit(50)
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => docToData<TestResult>(doc))
  },

  // Get recent test results
  async getRecent(limitCount: number = 20): Promise<TestResult[]> {
    const q = query(
      collection(db, COLLECTIONS.TEST_RESULTS),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => docToData<TestResult>(doc))
  },

  // Real-time listener for test results
  onTestResultsChange(callback: (results: TestResult[]) => void) {
    const q = query(
      collection(db, COLLECTIONS.TEST_RESULTS),
      orderBy('timestamp', 'desc'),
      limit(20)
    )
    return onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => docToData<TestResult>(doc))
      callback(results)
    })
  }
}

// Support Tickets Service
export const supportTicketsService = {
  // Create a new support ticket
  async create(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.SUPPORT_TICKETS), {
      ...ticket,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  },

  // Update support ticket
  async update(id: string, updates: Partial<SupportTicket>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.SUPPORT_TICKETS, id)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    })
  },

  // Get tickets by status
  async getByStatus(status: string): Promise<SupportTicket[]> {
    const q = query(
      collection(db, COLLECTIONS.SUPPORT_TICKETS),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => docToData<SupportTicket>(doc))
  },

  // Get recent tickets
  async getRecent(limitCount: number = 20): Promise<SupportTicket[]> {
    const q = query(
      collection(db, COLLECTIONS.SUPPORT_TICKETS),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => docToData<SupportTicket>(doc))
  },

  // Real-time listener for support tickets
  onTicketsChange(callback: (tickets: SupportTicket[]) => void) {
    const q = query(
      collection(db, COLLECTIONS.SUPPORT_TICKETS),
      orderBy('createdAt', 'desc'),
      limit(20)
    )
    return onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => docToData<SupportTicket>(doc))
      callback(tickets)
    })
  }
}

// User Profiles Service
export const userProfilesService = {
  // Create or update user profile
  async upsert(profile: Omit<UserProfile, 'id' | 'createdAt' | 'lastActive'>): Promise<void> {
    const userDoc = doc(db, COLLECTIONS.USER_PROFILES, profile.uid)
    const existingDoc = await getDoc(userDoc)
    
    if (existingDoc.exists()) {
      await updateDoc(userDoc, {
        ...profile,
        lastActive: serverTimestamp()
      })
    } else {
      await updateDoc(userDoc, {
        ...profile,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp()
      })
    }
  },

  // Get user profile by UID
  async getByUid(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, COLLECTIONS.USER_PROFILES, uid)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as UserProfile
    }
    return null
  }
} 