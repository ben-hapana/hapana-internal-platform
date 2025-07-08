import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { adminApp } from '@/firebase/firebase-admin'
import { financeService } from '@/lib/services/finance-operations/finance-service'
import { OperationExecution, FileReference } from '@/lib/types/finance-operations'

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Get executions for the user
    const executions = await financeService.getExecutionsByUser(userId, limit)

    return NextResponse.json({
      success: true,
      executions: executions.map((execution: OperationExecution) => ({
        id: execution.id,
        operationId: execution.operationId,
        operationName: execution.operationName,
        status: execution.status,
        startTime: execution.startTime,
        endTime: execution.endTime,
        duration: execution.duration,
        inputFile: {
          id: execution.inputFile.id,
          originalName: execution.inputFile.originalName,
          size: execution.inputFile.size,
          uploadedAt: execution.inputFile.uploadedAt
        },
        outputFiles: execution.outputFiles?.map((file: FileReference) => ({
          id: file.id,
          originalName: file.originalName,
          size: file.size,
          downloadUrl: file.downloadUrl
        })) || [],
        results: execution.results,
        logs: execution.logs.slice(-5), // Only return last 5 logs for list view
        metadata: execution.metadata
      }))
    })

  } catch (error) {
    console.error('Executions API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get executions'
      },
      { status: 500 }
    )
  }
} 