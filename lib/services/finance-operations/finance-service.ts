import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  Timestamp 
} from 'firebase/firestore'
import { db } from '@/firebase/firebase'
import { 
  FinanceOperation, 
  OperationExecution, 
  FileReference, 
  ExecutionLog, 
  OperationResult 
} from '@/lib/types/finance-operations'

// Collection names
const COLLECTIONS = {
  FINANCE_OPERATIONS: 'finance_operations',
  OPERATION_EXECUTIONS: 'operation_executions',
  FILE_REFERENCES: 'file_references'
} as const

export class FinanceService {
  // Finance Operations CRUD
  async createOperation(operation: Omit<FinanceOperation, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.FINANCE_OPERATIONS), operation)
    return docRef.id
  }

  async getOperation(id: string): Promise<FinanceOperation | null> {
    const docRef = doc(db, COLLECTIONS.FINANCE_OPERATIONS, id)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as FinanceOperation
    }
    return null
  }

  async getAllOperations(): Promise<FinanceOperation[]> {
    const q = query(
      collection(db, COLLECTIONS.FINANCE_OPERATIONS),
      where('status', '==', 'active'),
      orderBy('name')
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FinanceOperation[]
  }

  // Operation Executions CRUD
  async createExecution(execution: Omit<OperationExecution, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.OPERATION_EXECUTIONS), execution)
    return docRef.id
  }

  async getExecution(id: string): Promise<OperationExecution | null> {
    const docRef = doc(db, COLLECTIONS.OPERATION_EXECUTIONS, id)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as OperationExecution
    }
    return null
  }

  async updateExecution(id: string, updates: Partial<OperationExecution>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.OPERATION_EXECUTIONS, id)
    await updateDoc(docRef, updates)
  }

  async getExecutionsByUser(userId: string, limitCount = 20): Promise<OperationExecution[]> {
    const q = query(
      collection(db, COLLECTIONS.OPERATION_EXECUTIONS),
      where('executedBy', '==', userId),
      orderBy('startTime', 'desc'),
      firestoreLimit(limitCount)
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as OperationExecution[]
  }

  async getRecentExecutions(limitCount = 20): Promise<OperationExecution[]> {
    const q = query(
      collection(db, COLLECTIONS.OPERATION_EXECUTIONS),
      orderBy('startTime', 'desc'),
      firestoreLimit(limitCount)
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as OperationExecution[]
  }

  // File References CRUD
  async createFileReference(fileRef: Omit<FileReference, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTIONS.FILE_REFERENCES), fileRef)
    return docRef.id
  }

  async getFileReference(id: string): Promise<FileReference | null> {
    const docRef = doc(db, COLLECTIONS.FILE_REFERENCES, id)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as FileReference
    }
    return null
  }

  // Execution Logging
  async addExecutionLog(executionId: string, log: Omit<ExecutionLog, 'timestamp'>): Promise<void> {
    const execution = await this.getExecution(executionId)
    if (!execution) throw new Error('Execution not found')

    const newLog: ExecutionLog = {
      ...log,
      timestamp: Timestamp.now()
    }

    const updatedLogs = [...execution.logs, newLog]
    await this.updateExecution(executionId, { logs: updatedLogs })
  }

  async updateExecutionStatus(
    executionId: string, 
    status: OperationExecution['status'],
    results?: OperationResult
  ): Promise<void> {
    const updates: Partial<OperationExecution> = { status }
    
    if (status === 'completed' || status === 'failed') {
      updates.endTime = Timestamp.now()
      if (results) {
        updates.results = results
      }
    }

    // Calculate duration if execution is complete
    const execution = await this.getExecution(executionId)
    if (execution && updates.endTime) {
      updates.duration = updates.endTime.toMillis() - execution.startTime.toMillis()
    }

    await this.updateExecution(executionId, updates)
  }

  // Utility methods
  async getExecutionStats(userId?: string): Promise<{
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
  }> {
    let q = query(collection(db, COLLECTIONS.OPERATION_EXECUTIONS))
    
    if (userId) {
      q = query(q, where('executedBy', '==', userId))
    }

    const querySnapshot = await getDocs(q)
    const executions = querySnapshot.docs.map(doc => doc.data()) as OperationExecution[]

    return {
      total: executions.length,
      pending: executions.filter(e => e.status === 'pending').length,
      processing: executions.filter(e => e.status === 'processing').length,
      completed: executions.filter(e => e.status === 'completed').length,
      failed: executions.filter(e => e.status === 'failed').length
    }
  }
}

export const financeService = new FinanceService() 