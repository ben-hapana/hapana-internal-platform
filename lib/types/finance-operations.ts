import { Timestamp } from 'firebase/firestore'

// Core Finance Operations Types
export interface FinanceOperation {
  id: string
  name: string
  description: string
  scriptPath: string
  status: 'active' | 'inactive'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface OperationExecution {
  id: string
  operationId: string
  operationName: string
  executedBy: string // user ID
  executedByName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startTime: Timestamp
  endTime?: Timestamp
  duration?: number // milliseconds
  inputFile: FileReference
  outputFiles?: FileReference[]
  logs: ExecutionLog[]
  results?: OperationResult
  webhookUrl?: string
  metadata: Record<string, unknown>
}

export interface FileReference {
  id: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  uploadedBy: string
  uploadedAt: Timestamp
  storagePath: string
  downloadUrl?: string
  checksum: string
}

export interface ExecutionLog {
  timestamp: Timestamp
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: Record<string, unknown>
}

export interface OperationResult {
  success: boolean
  message: string
  recordsProcessed?: number
  recordsSuccessful?: number
  recordsFailed?: number
  totalAmount?: number
  currency?: string
  data?: Record<string, unknown>
  errors?: string[]
  warnings?: string[]
}

// API Response Types
export interface UploadResponse {
  success: boolean
  executionId: string
  fileId: string
  message: string
}

export interface ExecutionStatusResponse {
  success: boolean
  execution: OperationExecution
}

export interface WebhookPayload {
  executionId: string
  status: 'completed' | 'failed'
  results?: OperationResult
  timestamp: string
} 