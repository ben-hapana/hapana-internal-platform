import { NextRequest, NextResponse } from 'next/server';
import { pubsubService, HappyFoxTicketEvent } from '@/lib/services/pubsub/pubsub-service';
import { ticketProcessor } from '@/lib/services/pubsub/ticket-processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'start-processor';
    const subscriptionName = body.subscriptionName || 'happyfox-ticket-processor';

    switch (action) {
      case 'start-processor':
        return await startProcessor(subscriptionName);
      
      case 'create-subscription':
        return await createSubscription(subscriptionName);
      
      case 'get-metrics':
        return await getMetrics(subscriptionName);
      
      case 'process-single':
        return await processSingleEvent(body.event);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start-processor, create-subscription, get-metrics, or process-single' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Pub/Sub processor API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to handle Pub/Sub processor request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function startProcessor(subscriptionName: string) {
  try {
    console.log(`Starting Pub/Sub processor with subscription: ${subscriptionName}`);

    // Ensure subscription exists
    await pubsubService.createHappyFoxTicketSubscription(subscriptionName);

    // Start processing (this would typically run in a separate service/container)
    // For demo purposes, we'll process a few messages and return
    let processedCount = 0;
    const maxProcessTime = 30000; // 30 seconds max for demo
    const startTime = Date.now();

    // This is a simplified version - in production you'd run this as a separate service
    const processingPromise = new Promise<void>((resolve) => {
      pubsubService.processHappyFoxTicketEvents(subscriptionName, async (event) => {
        await ticketProcessor.processTicketEvent(event);
        processedCount++;
        
        // Stop after processing some events or timeout
        if (processedCount >= 10 || Date.now() - startTime > maxProcessTime) {
          resolve();
        }
      });

      // Timeout after maxProcessTime
      setTimeout(() => resolve(), maxProcessTime);
    });

    await processingPromise;

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} events in demo mode`,
      subscriptionName,
      processedCount,
      note: 'In production, this would run as a continuous background service'
    });

  } catch (error) {
    console.error('Failed to start processor:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start Pub/Sub processor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function createSubscription(subscriptionName: string) {
  try {
    await pubsubService.createHappyFoxTicketSubscription(subscriptionName);
    
    return NextResponse.json({
      success: true,
      message: `Subscription created: ${subscriptionName}`,
      subscriptionName
    });

  } catch (error) {
    console.error('Failed to create subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getMetrics(subscriptionName: string) {
  try {
    const metrics = await pubsubService.getSubscriptionMetrics(subscriptionName);
    
    return NextResponse.json({
      success: true,
      subscriptionName,
      metrics
    });

  } catch (error) {
    console.error('Failed to get metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get subscription metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function processSingleEvent(event: Record<string, unknown>) {
  try {
    if (!event) {
      return NextResponse.json(
        { error: 'Event data is required for process-single action' },
        { status: 400 }
      );
    }

    await ticketProcessor.processTicketEvent(event as unknown as HappyFoxTicketEvent);
    
    return NextResponse.json({
      success: true,
      message: `Successfully processed event for ticket: ${event.ticketId}`,
      ticketId: event.ticketId
    });

  } catch (error) {
    console.error('Failed to process single event:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process single event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Pub/Sub Processor',
    description: 'Manage Pub/Sub subscriptions and process HappyFox ticket events',
    actions: {
      'start-processor': 'Start processing events from subscription (demo mode)',
      'create-subscription': 'Create a new subscription',
      'get-metrics': 'Get subscription metrics',
      'process-single': 'Process a single event directly'
    },
    usage: {
      method: 'POST',
      body: {
        action: 'start-processor | create-subscription | get-metrics | process-single',
        subscriptionName: 'string (optional, default: happyfox-ticket-processor)',
        event: 'HappyFoxTicketEvent (required for process-single)'
      }
    },
    examples: [
      {
        action: 'start-processor',
        body: { action: 'start-processor', subscriptionName: 'my-processor' }
      },
      {
        action: 'create-subscription',
        body: { action: 'create-subscription', subscriptionName: 'my-processor' }
      },
      {
        action: 'get-metrics',
        body: { action: 'get-metrics', subscriptionName: 'my-processor' }
      }
    ]
  });
} 