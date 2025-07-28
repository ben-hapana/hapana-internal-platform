import { getAdminDb } from '@/firebase/firebase-admin';
import { algoliaSearchService } from '../search/algolia-search-service';
import { HappyFoxTicketEvent } from './pubsub-service';

export interface ProcessedTicket {
  ticketId: string;
  status: string;
  priority: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  brandName: string;
  locationName: string;
  created: string;
  updated: string;
}

export class TicketProcessor {
  
  /**
   * Process a single HappyFox ticket event
   */
  async processTicketEvent(event: HappyFoxTicketEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`Processing ticket event: ${event.ticketId}`, {
        action: event.action,
        source: event.source
      });

      switch (event.action) {
        case 'create':
        case 'update':
        case 'sync':
          if (event.ticketData) {
            await this.processTicketData(event.ticketId, event.ticketData);
          } else {
            console.warn(`No ticket data provided for ${event.action} event: ${event.ticketId}`);
          }
          break;
        default:
          console.warn(`Unknown action: ${event.action} for ticket: ${event.ticketId}`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`Successfully processed ticket event: ${event.ticketId} in ${processingTime}ms`);

    } catch (error) {
      console.error(`Failed to process ticket event: ${event.ticketId}`, error);
      throw error; // Re-throw to trigger retry in Pub/Sub
    }
  }

  /**
   * Process and store ticket data
   */
  private async processTicketData(ticketId: string, ticketData: Record<string, unknown>): Promise<void> {
    try {
      console.log(`Processing ticket data for: ${ticketId}`, { hasData: !!ticketData });
      
      // Transform ticket data to our standard format
      const processedTicket = this.transformTicketData(ticketData);
      
      console.log(`Transformed ticket data for: ${ticketId}`, { 
        subject: processedTicket.subject,
        status: processedTicket.status 
      });
      
      // Store in Firestore
      await this.storeInFirestore(ticketId, processedTicket);
      
      // Index in Algolia
      await this.indexInAlgolia(ticketId, processedTicket);
      
      console.log(`Successfully processed and stored ticket: ${ticketId}`);
      
    } catch (error) {
      console.error(`Failed to process ticket data for: ${ticketId}`, error);
      throw error;
    }
  }

  /**
   * Transform raw HappyFox ticket data to our standard format
   */
  private transformTicketData(ticketData: Record<string, unknown>): ProcessedTicket {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ticket = ticketData as Record<string, any>; // We know this is HappyFox ticket structure
    
    return {
      ticketId: ticket.id?.toString() || 'unknown',
      status: ticket.status?.name || 'unknown',
      priority: ticket.priority?.name || 'unknown',
      subject: ticket.subject || '',
      customerName: ticket.user?.name || 'unknown',
      customerEmail: ticket.user?.email || '',
      brandName: 'Hapana', // Default for now
      locationName: 'Unknown Location', // Default for now
      created: ticket.created_at || new Date().toISOString(),
      updated: ticket.updated_at || new Date().toISOString()
    };
  }

  /**
   * Store ticket in Firestore
   */
  private async storeInFirestore(ticketId: string, ticket: ProcessedTicket): Promise<void> {
    try {
      console.log(`Storing ticket in Firestore: ${ticketId}`);
      
      const adminDb = getAdminDb();
      const docRef = adminDb.collection('happyfox-tickets').doc(`happyfox_${ticketId}`);
      
      // Create a clean object with only the necessary fields
      const firestoreData = {
        ticketId: String(ticket.ticketId || ''),
        status: String(ticket.status || ''),
        priority: String(ticket.priority || ''),
        subject: String(ticket.subject || ''),
        customerName: String(ticket.customerName || ''),
        customerEmail: String(ticket.customerEmail || ''),
        brandName: String(ticket.brandName || ''),
        locationName: String(ticket.locationName || ''),
        created: String(ticket.created || new Date().toISOString()),
        updated: String(ticket.updated || new Date().toISOString()),
        lastSynced: new Date().toISOString(),
        syncSource: 'pubsub'
      };
      
      await docRef.set(firestoreData, { merge: true });
      
      console.log(`Successfully stored ticket in Firestore: happyfox_${ticketId}`);
      
    } catch (error) {
      console.error(`Failed to store ticket in Firestore: ${ticketId}`, error);
      throw error;
    }
  }

  /**
   * Index ticket in Algolia
   */
  private async indexInAlgolia(ticketId: string, ticket: ProcessedTicket): Promise<void> {
    try {
      console.log(`Indexing ticket in Algolia: ${ticketId}`);
      
      const algoliaRecord = {
        objectID: `happyfox_${ticketId}`,
        ticketId: String(ticket.ticketId || ''),
        source: 'happyfox',
        title: String(ticket.subject || ''),
        description: String(ticket.subject || ''), // Use subject as description for now
        status: String(ticket.status || ''),
        priority: String(ticket.priority || ''),
        customerName: String(ticket.customerName || ''),
        customerEmail: String(ticket.customerEmail || ''),
        brandName: String(ticket.brandName || ''),
        locationName: String(ticket.locationName || ''),
        created: String(ticket.created || new Date().toISOString()),
        updated: String(ticket.updated || new Date().toISOString()),
        lastIndexed: new Date().toISOString()
      };

      await algoliaSearchService.indexTicket(algoliaRecord);
      console.log(`Successfully indexed ticket in Algolia: happyfox_${ticketId}`);
      
    } catch (error) {
      console.error(`Failed to index ticket in Algolia: ${ticketId}`, error);
      throw error;
    }
  }

  /**
   * Batch process multiple tickets (for backward compatibility)
   */
  async batchProcessTickets(tickets: Record<string, unknown>[]): Promise<void> {
    console.log(`Batch processing ${tickets.length} tickets`);
    
    for (const ticket of tickets) {
      try {
        const ticketId = (ticket as Record<string, unknown>)?.id?.toString();
        if (ticketId) {
          await this.processTicketData(ticketId, ticket);
        }
      } catch (error) {
        console.error(`Failed to process ticket in batch:`, error);
        // Continue with other tickets
      }
    }
  }
}

// Export singleton instance
export const ticketProcessor = new TicketProcessor(); 