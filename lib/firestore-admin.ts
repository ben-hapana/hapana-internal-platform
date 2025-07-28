import { getAdminDb } from '@/firebase/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

// Collections
const COLLECTIONS = {
  TEST_RESULTS: 'test-results',
  USERS: 'users',
  SYSTEM_LOGS: 'system-logs'
} as const

// Test Results Interface
interface TestResult {
  id?: string
  testName: string
  environment: 'production' | 'staging' | 'development'
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  errorMessage?: string
  timestamp: Timestamp
  userId: string
  userEmail: string
  metadata?: Record<string, unknown>
}

export const firestoreAdmin = {
  // Test Results
  async createTestResult(testResult: Omit<TestResult, 'id' | 'timestamp'>): Promise<string> {
    const adminDb = getAdminDb()
    const docRef = await adminDb.collection(COLLECTIONS.TEST_RESULTS).add({
      ...testResult,
      timestamp: Timestamp.now()
    })
    return docRef.id
  },

  async updateTestResult(id: string, updates: Partial<TestResult>): Promise<void> {
    const adminDb = getAdminDb()
    await adminDb.collection(COLLECTIONS.TEST_RESULTS).doc(id).update({
      ...updates,
      timestamp: Timestamp.now()
    })
  },

  async getTestResults(
    environment?: string,
    limit: number = 50
  ): Promise<TestResult[]> {
    const adminDb = getAdminDb()
    let query = adminDb
      .collection(COLLECTIONS.TEST_RESULTS)
      .orderBy('timestamp', 'desc')
      .limit(limit)

    if (environment && environment !== 'all') {
      query = query.where('environment', '==', environment)
    }

    const snapshot = await query.get()
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TestResult[]
  },

  async getTestResultStats(): Promise<{
    total: number
    passed: number
    failed: number
    running: number
    pending: number
  }> {
    const adminDb = getAdminDb()
    const snapshot = await adminDb
      .collection(COLLECTIONS.TEST_RESULTS)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get()

    const results = snapshot.docs.map(doc => doc.data() as TestResult)
    
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      running: results.filter(r => r.status === 'running').length,
      pending: results.filter(r => r.status === 'pending').length
    }
  }
} 