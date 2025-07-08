import { NextRequest, NextResponse } from 'next/server'
import { webhookHandler } from '@/lib/services/webhooks/webhook-handler'

export async function POST(request: NextRequest) {
  try {
    console.log('Received Jira webhook')

    // Validate the webhook
    const validation = await webhookHandler.validateJiraWebhook(request)
    
    if (!validation.isValid) {
      console.error('Jira webhook validation failed:', validation.error)
      return NextResponse.json(
        { error: 'Webhook validation failed' },
        { status: 401 }
      )
    }

    // Process the webhook
    if (validation.payload) {
      await webhookHandler.processJiraWebhook(validation.payload as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully' 
    })

  } catch (error) {
    console.error('Error processing Jira webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy',
    service: 'jira-webhook',
    timestamp: new Date().toISOString()
  })
} 