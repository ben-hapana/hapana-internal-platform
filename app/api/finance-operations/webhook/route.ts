import { NextRequest, NextResponse } from 'next/server'
import { financeService } from '@/lib/services/finance-operations/finance-service'
import { WebhookPayload } from '@/lib/types/finance-operations'

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity (simple approach)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CLOUD_RUN_WEBHOOK_SECRET
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      console.warn('Unauthorized webhook attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload: WebhookPayload = await request.json()
    const { executionId, status, results } = payload

    console.log(`📨 Webhook received for execution ${executionId}: ${status}`)

    // Verify execution exists
    const execution = await financeService.getExecution(executionId)
    if (!execution) {
      console.error(`Execution ${executionId} not found`)
      return NextResponse.json(
        { success: false, error: 'Execution not found' },
        { status: 404 }
      )
    }

    // Update execution status
    await financeService.updateExecutionStatus(executionId, status, results)

    // Add completion log
    await financeService.addExecutionLog(executionId, {
      level: status === 'completed' ? 'info' : 'error',
      message: `Processing ${status}: ${results?.message || 'No message provided'}`,
      data: {
        results,
        webhookTimestamp: new Date().toISOString()
      }
    })

    // If there's a custom webhook URL, forward the notification
    if (execution.webhookUrl) {
      try {
        await fetch(execution.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            executionId,
            status,
            results,
            operation: {
              id: execution.operationId,
              name: execution.operationName
            },
            timestamp: new Date().toISOString()
          })
        })
        
        await financeService.addExecutionLog(executionId, {
          level: 'info',
          message: `Notification sent to custom webhook: ${execution.webhookUrl}`
        })
      } catch (error) {
        console.error('Failed to forward webhook:', error)
        await financeService.addExecutionLog(executionId, {
          level: 'warn',
          message: `Failed to send notification to custom webhook: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }

    // Send real-time notification to client (if WebSocket is implemented)
    // For now, we'll rely on polling from the frontend
    console.log(`✅ Execution ${executionId} updated to ${status}`)

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully'
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Finance Operations Webhook',
    description: 'Receives completion notifications from Cloud Run processing',
    usage: {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer <cloud-run-webhook-secret>',
        'Content-Type': 'application/json'
      },
      body: {
        executionId: 'string',
        status: 'completed | failed',
        results: 'OperationResult (optional)',
        timestamp: 'string'
      }
    }
  })
} 