import { PubSub } from '@google-cloud/pubsub';

export interface HappyFoxTicketEvent {
  ticketId: string;
  action: 'create' | 'update' | 'sync';
  timestamp: string;
  source: 'webhook' | 'sync' | 'manual';
  ticketData?: Record<string, unknown>; // Full ticket data for create/update events
  metadata?: {
    syncBatch?: string;
    retryCount?: number;
    priority?: 'high' | 'normal' | 'low';
  };
}

export class PubSubService {
  private pubsub: PubSub;
  private projectId: string;

  // Topic names
  static readonly TOPICS = {
    HAPPYFOX_TICKETS: 'happyfox-ticket-events',
    JIRA_TICKETS: 'jira-ticket-events',
    ISSUE_INTELLIGENCE: 'issue-intelligence-events'
  } as const;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'hapana-internal-platform';
    this.pubsub = new PubSub({
      projectId: this.projectId,
    });
  }

  /**
   * Publish a HappyFox ticket event to Pub/Sub
   */
  async publishHappyFoxTicketEvent(event: HappyFoxTicketEvent): Promise<string> {
    try {
      const topicName = PubSubService.TOPICS.HAPPYFOX_TICKETS;
      const topic = this.pubsub.topic(topicName);

      // Ensure topic exists
      const [exists] = await topic.exists();
      if (!exists) {
        await topic.create();
        console.log(`Created topic: ${topicName}`);
      }

      // Prepare message
      const messageData = {
        ...event,
        publishedAt: new Date().toISOString(),
        projectId: this.projectId
      };

      // Publish message
      const messageId = await topic.publishMessage({
        data: Buffer.from(JSON.stringify(messageData)),
        attributes: {
          ticketId: event.ticketId,
          action: event.action,
          source: event.source,
          priority: event.metadata?.priority || 'normal'
        }
      });

      console.log(`Published HappyFox ticket event: ${messageId}`, {
        ticketId: event.ticketId,
        action: event.action,
        source: event.source
      });

      return messageId;
    } catch (error) {
      console.error('Failed to publish HappyFox ticket event:', error);
      throw error;
    }
  }

  /**
   * Publish multiple HappyFox ticket events in batch
   */
  async publishHappyFoxTicketEvents(events: HappyFoxTicketEvent[]): Promise<string[]> {
    const messageIds: string[] = [];
    
    for (const event of events) {
      try {
        const messageId = await this.publishHappyFoxTicketEvent(event);
        messageIds.push(messageId);
      } catch (error) {
        console.error(`Failed to publish event for ticket ${event.ticketId}:`, error);
        // Continue with other events even if one fails
      }
    }

    return messageIds;
  }

  /**
   * Create subscription for processing HappyFox ticket events
   */
  async createHappyFoxTicketSubscription(subscriptionName: string): Promise<void> {
    try {
      const topicName = PubSubService.TOPICS.HAPPYFOX_TICKETS;
      const topic = this.pubsub.topic(topicName);
      const subscription = topic.subscription(subscriptionName);

      const [exists] = await subscription.exists();
      if (!exists) {
        await subscription.create({
          ackDeadlineSeconds: 600, // 10 minutes to process each message
          retryPolicy: {
            minimumBackoff: { seconds: 10 },
            maximumBackoff: { seconds: 600 }
          },
          deadLetterPolicy: {
            deadLetterTopic: this.pubsub.topic(`${topicName}-dead-letter`).name,
            maxDeliveryAttempts: 5
          }
        });
        console.log(`Created subscription: ${subscriptionName}`);
      }
    } catch (error) {
      console.error(`Failed to create subscription ${subscriptionName}:`, error);
      throw error;
    }
  }

  /**
   * Process HappyFox ticket events from subscription
   */
  async processHappyFoxTicketEvents(
    subscriptionName: string,
    processor: (event: HappyFoxTicketEvent) => Promise<void>
  ): Promise<void> {
    try {
      const topicName = PubSubService.TOPICS.HAPPYFOX_TICKETS;
      const subscription = this.pubsub.topic(topicName).subscription(subscriptionName);

      console.log(`Starting to process HappyFox ticket events from subscription: ${subscriptionName}`);

      subscription.on('message', async (message) => {
        const startTime = Date.now();
        let event: HappyFoxTicketEvent | undefined;

        try {
          // Parse message
          const messageData = JSON.parse(message.data.toString());
          event = messageData as HappyFoxTicketEvent;

          console.log(`Processing HappyFox ticket event: ${event.ticketId}`, {
            action: event.action,
            source: event.source,
            messageId: message.id
          });

          // Process the event
          await processor(event);

          // Acknowledge successful processing
          message.ack();

          const processingTime = Date.now() - startTime;
          console.log(`Successfully processed HappyFox ticket event: ${event.ticketId} in ${processingTime}ms`);

        } catch (error) {
          console.error(`Failed to process HappyFox ticket event:`, error, {
            messageId: message.id,
            ticketId: event?.ticketId
          });

          // Don't acknowledge - let it retry
          message.nack();
        }
      });

      subscription.on('error', (error) => {
        console.error('Subscription error:', error);
      });

    } catch (error) {
      console.error(`Failed to process HappyFox ticket events:`, error);
      throw error;
    }
  }

  /**
   * Get subscription metrics
   */
  async getSubscriptionMetrics(subscriptionName: string): Promise<Record<string, unknown>> {
    try {
      const topicName = PubSubService.TOPICS.HAPPYFOX_TICKETS;
      const subscription = this.pubsub.topic(topicName).subscription(subscriptionName);
      
      const [metadata] = await subscription.getMetadata();
      return {
        name: metadata.name,
        topic: metadata.topic,
        ackDeadlineSeconds: metadata.ackDeadlineSeconds,
        messageRetentionDuration: metadata.messageRetentionDuration,
        retryPolicy: metadata.retryPolicy,
        deadLetterPolicy: metadata.deadLetterPolicy
      };
    } catch (error) {
      console.error(`Failed to get subscription metrics:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const pubsubService = new PubSubService(); 