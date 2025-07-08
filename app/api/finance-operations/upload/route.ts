import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { adminApp } from '@/firebase/firebase-admin'
import { fileUploadService } from '@/lib/services/finance-operations/file-upload-service'
import { financeService } from '@/lib/services/finance-operations/finance-service'
import { Timestamp } from 'firebase/firestore'
import { FileReference, FinanceOperation } from '@/lib/types/finance-operations'

export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Auth inside the function to avoid build-time errors
    const auth = getAuth(adminApp)
    
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.split('Bearer ')[1]
    const decodedToken = await auth.verifyIdToken(token)
    const userId = decodedToken.uid
    const userDisplayName = decodedToken.name || decodedToken.email || 'Unknown User'

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const operationId = formData.get('operationId') as string
    const webhookUrl = formData.get('webhookUrl') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!operationId) {
      return NextResponse.json(
        { success: false, error: 'Operation ID is required' },
        { status: 400 }
      )
    }

    // Verify operation exists
    const operation = await financeService.getOperation(operationId)
    if (!operation) {
      return NextResponse.json(
        { success: false, error: 'Invalid operation ID' },
        { status: 400 }
      )
    }

    // Upload file to Cloud Storage
    console.log(`📁 Uploading file: ${file.name} (${file.size} bytes)`)
    const fileReference = await fileUploadService.uploadFile(file, userId)

    // Create execution record
    const executionData = {
      operationId,
      operationName: operation.name,
      executedBy: userId,
      executedByName: userDisplayName,
      status: 'pending' as const,
      startTime: Timestamp.now(),
      inputFile: fileReference,
      logs: [],
      webhookUrl: webhookUrl || undefined,
      metadata: {
        originalFileName: file.name,
        fileSize: file.size,
        uploadTimestamp: new Date().toISOString()
      }
    }

    const executionId = await financeService.createExecution(executionData)

    // Log the upload
    await financeService.addExecutionLog(executionId, {
      level: 'info',
      message: `File uploaded successfully: ${file.name}`,
      data: {
        fileId: fileReference.id,
        fileSize: file.size,
        checksum: fileReference.checksum
      }
    })

    // Trigger Cloud Run function
    console.log(`🚀 Triggering Cloud Run for execution: ${executionId}`)
    await triggerCloudRunProcessing(executionId, fileReference, operation)

    return NextResponse.json({
      success: true,
      executionId,
      fileId: fileReference.id,
      message: 'File uploaded and processing started'
    })

  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      },
      { status: 500 }
    )
  }
}

async function triggerCloudRunProcessing(
  executionId: string,
  fileReference: FileReference,
  operation: FinanceOperation
) {
  try {
    const cloudRunUrl = process.env.CLOUD_RUN_FINANCE_OPERATIONS_URL
    if (!cloudRunUrl) {
      throw new Error('Cloud Run URL not configured')
    }

    // Update execution status to processing
    await financeService.updateExecutionStatus(executionId, 'processing')
    await financeService.addExecutionLog(executionId, {
      level: 'info',
      message: 'Starting Cloud Run processing'
    })

    // Prepare payload for Cloud Run
    const payload = {
      executionId,
      operationId: operation.id,
      operationName: operation.name,
      scriptPath: operation.scriptPath,
      fileReference: {
        id: fileReference.id,
        downloadUrl: fileReference.downloadUrl || '',
        filename: fileReference.filename,
        originalName: fileReference.originalName
      },
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/finance-operations/webhook`
    }

    // Call Cloud Run service
    const response = await fetch(cloudRunUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getCloudRunAuthToken()}`
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Cloud Run request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Cloud Run triggered successfully:', result)

    await financeService.addExecutionLog(executionId, {
      level: 'info',
      message: 'Cloud Run processing initiated',
      data: { cloudRunResponse: result }
    })

  } catch (error) {
    console.error('Cloud Run trigger failed:', error)
    
    // Update execution status to failed
    await financeService.updateExecutionStatus(executionId, 'failed', {
      success: false,
      message: 'Failed to start processing',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    })

    await financeService.addExecutionLog(executionId, {
      level: 'error',
      message: 'Cloud Run trigger failed',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    })

    throw error
  }
}

async function getCloudRunAuthToken(): Promise<string> {
  try {
    // In production, use Google Cloud service account
    if (process.env.NODE_ENV === 'production') {
      const { GoogleAuth } = await import('google-auth-library')
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      })
      const client = await auth.getClient()
      const token = await client.getAccessToken()
      return token.token || ''
    }
    
    // For development, return a placeholder (Cloud Run should handle local auth)
    return 'dev-token'
  } catch (error) {
    console.error('Failed to get Cloud Run auth token:', error)
    return ''
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Finance Operations Upload',
    description: 'Upload CSV files for processing by finance operations',
    usage: {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer <firebase-id-token>',
        'Content-Type': 'multipart/form-data'
      },
      body: {
        file: 'File (CSV)',
        operationId: 'string (required)',
        webhookUrl: 'string (optional)'
      }
    }
  })
} 