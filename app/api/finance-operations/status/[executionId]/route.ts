import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { adminApp } from '@/firebase/firebase-admin'
import { financeService } from '@/lib/services/finance-operations/finance-service'

const auth = getAuth(adminApp)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
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

    const { executionId } = await params

    // Get execution details
    const execution = await financeService.getExecution(executionId)
    if (!execution) {
      return NextResponse.json(
        { success: false, error: 'Execution not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this execution
    if (execution.executedBy !== userId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Return execution details with logs
    return NextResponse.json({
      success: true,
      execution: {
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
        outputFiles: execution.outputFiles?.map(file => ({
          id: file.id,
          originalName: file.originalName,
          size: file.size,
          downloadUrl: file.downloadUrl
        })) || [],
        results: execution.results,
        logs: execution.logs.map(log => ({
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          data: log.data
        })),
        metadata: execution.metadata
      }
    })

  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get execution status'
      },
      { status: 500 }
    )
  }
} 