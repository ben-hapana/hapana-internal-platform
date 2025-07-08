import { adminDb } from '@/firebase/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// Data Models (same as client-side)
export interface TestResult {
  id?: string
  testName: string
  environment: 'production' | 'staging' | 'development'
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  errorMessage?: string
  timestamp: FirebaseFirestore.Timestamp
  userId: string
  userEmail: string
}

// Collections
const COLLECTIONS = {
  TEST_RESULTS: 'testResults',
  SUPPORT_TICKETS: 'supportTickets', 
  USER_PROFILES: 'userProfiles',
  SYSTEM_CONFIG: 'systemConfig'
} as const

// Test Results Service (Server-side with Admin SDK)
export const serverTestResultsService = {
  // Create a new test result
  async create(testResult: Omit<TestResult, 'id' | 'timestamp'>): Promise<string> {
    const docRef = await adminDb.collection(COLLECTIONS.TEST_RESULTS).add({
      ...testResult,
      timestamp: FieldValue.serverTimestamp()
    })
    return docRef.id
  },

  // Update test result (e.g., when test completes)
  async update(id: string, updates: Partial<TestResult>): Promise<void> {
    await adminDb.collection(COLLECTIONS.TEST_RESULTS).doc(id).update({
      ...updates,
      timestamp: FieldValue.serverTimestamp()
    })
  },

  // Get test results by environment
  async getByEnvironment(environment: string): Promise<TestResult[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.TEST_RESULTS)
      .where('environment', '==', environment)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TestResult))
  },

  // Get recent test results
  async getRecent(limitCount: number = 20): Promise<TestResult[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.TEST_RESULTS)
      .orderBy('timestamp', 'desc')
      .limit(limitCount)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TestResult))
  },

  // Get all test results (for real-time updates)
  async getAll(): Promise<TestResult[]> {
    const snapshot = await adminDb
      .collection(COLLECTIONS.TEST_RESULTS)
      .orderBy('timestamp', 'desc')
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TestResult))
  }
} 