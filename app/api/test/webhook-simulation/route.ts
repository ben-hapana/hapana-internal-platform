import { NextRequest, NextResponse } from 'next/server'
import { webhookHandler } from '@/lib/services/webhooks/webhook-handler'
import { HappyFoxWebhookPayload } from '@/lib/types/issue-intelligence'

// Simulate HappyFox webhook payload
const createSampleHappyFoxPayload = (ticketId: number, scenario: string) => {
  const basePayload = {
    event: 'ticket_created',
    ticket: {
      id: ticketId,
      subject: '',
      text: '',
      status: {
        id: 1,
        name: 'Open'
      },
      priority: {
        id: 2,
        name: 'Medium'
      },
      category: {
        id: 1,
        name: 'Technical Support'
      },
      user: {
        id: 1001 + ticketId,
        name: `User ${ticketId}`,
        email: `user${ticketId}@example.com`
      },
      custom_fields: {
        brand: 'HAP',
        location: 'Auckland Central'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [] as string[]
    },
    timestamp: new Date().toISOString()
  }

  // Different scenarios for testing
  switch (scenario) {
    case 'app_login_issue':
      basePayload.ticket.subject = 'Cannot login to mobile app'
      basePayload.ticket.text = 'I am unable to login to the Hapana mobile app. It keeps saying invalid credentials even though I know my password is correct. This started happening this morning.'
      basePayload.ticket.priority.name = 'High'
      basePayload.ticket.tags = ['mobile', 'login', 'authentication']
      break

    case 'class_booking_problem':
      basePayload.ticket.subject = 'Class booking system not working'
      basePayload.ticket.text = 'The class booking system is down. I cannot book any classes for this week. Getting error messages when I try to book through the app or website.'
      basePayload.ticket.priority.name = 'Urgent'
      basePayload.ticket.tags = ['booking', 'classes', 'system_down']
      break

    case 'payment_issue':
      basePayload.ticket.subject = 'Payment failed but money was charged'
      basePayload.ticket.text = 'My payment failed when trying to renew my membership, but the money was still charged from my credit card. Can you please help resolve this?'
      basePayload.ticket.priority.name = 'High'
      basePayload.ticket.tags = ['payment', 'billing', 'membership']
      break

    case 'facility_access':
      basePayload.ticket.subject = 'Key card not working at gym entrance'
      basePayload.ticket.text = 'My membership key card is not working at the gym entrance. The scanner beeps red and does not let me in. This happened yesterday and today.'
      basePayload.ticket.priority.name = 'Medium'
      basePayload.ticket.tags = ['access', 'keycard', 'facility']
      break

    case 'similar_app_issue':
      basePayload.ticket.subject = 'Mobile app login problems'
      basePayload.ticket.text = 'Having trouble logging into the mobile application. Keep getting authentication errors. Started yesterday evening.'
      basePayload.ticket.priority.name = 'High'
      basePayload.ticket.tags = ['mobile', 'login', 'authentication']
      basePayload.ticket.user.name = `Different User ${ticketId}`
      basePayload.ticket.user.email = `different.user${ticketId}@example.com`
      break

    default:
      basePayload.ticket.subject = 'General inquiry'
      basePayload.ticket.text = 'I have a general question about my membership.'
      break
  }

  return basePayload
}

export async function POST(request: NextRequest) {
  try {
    const { scenario = 'app_login_issue', count = 1 } = await request.json()

    console.log(`Simulating ${count} webhook(s) with scenario: ${scenario}`)

    const results = []

    for (let i = 0; i < count; i++) {
      const ticketId = Date.now() + i // Unique ticket ID
      const payload = createSampleHappyFoxPayload(ticketId, scenario)

      try {
        // Process the webhook directly (bypassing signature validation for testing)
        await webhookHandler.processHappyFoxWebhook(payload as HappyFoxWebhookPayload)
        
        results.push({
          ticketId,
          status: 'success',
          scenario,
          payload: {
            subject: payload.ticket.subject,
            priority: payload.ticket.priority.name,
            user: payload.ticket.user.email
          }
        })

        console.log(`✓ Processed test ticket ${ticketId}: ${payload.ticket.subject}`)

      } catch (error) {
        results.push({
          ticketId,
          status: 'error',
          scenario,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        console.error(`✗ Failed to process test ticket ${ticketId}:`, error)
      }

      // Small delay between tickets to avoid overwhelming the system
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return NextResponse.json({
      success: true,
      message: `Simulated ${count} webhook(s)`,
      scenario,
      results
    })

  } catch (error) {
    console.error('Webhook simulation failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Simulation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Webhook Simulation Endpoint',
    usage: 'POST with JSON body: { "scenario": "app_login_issue", "count": 1 }',
    scenarios: [
      'app_login_issue',
      'class_booking_problem', 
      'payment_issue',
      'facility_access',
      'similar_app_issue'
    ]
  })
} 