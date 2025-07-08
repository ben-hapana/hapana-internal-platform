import { NextRequest, NextResponse } from 'next/server';
import { PubSubService } from '@/lib/services/pubsub/pubsub-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting HappyFox Pub/Sub sync...');
    
    const body = await request.json().catch(() => ({}));
    const { 
      limit = 50, 
      startDate, 
      endDate,
      fullSync = false // New parameter for full 12-month sync
    } = body;

    // Calculate date range for last 12 months if fullSync is requested
    let dateFilter = '';
    if (fullSync || startDate || endDate) {
      const now = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(now.getFullYear() - 1);
      
      const start = startDate ? new Date(startDate) : twelveMonthsAgo;
      const end = endDate ? new Date(endDate) : now;
      
      // Format dates for HappyFox API (YYYY-MM-DD)
      const startDateStr = start.toISOString().split('T')[0];
      const endDateStr = end.toISOString().split('T')[0];
      
      dateFilter = `&created__gte=${startDateStr}&created__lte=${endDateStr}`;
      console.log(`📅 Date filter: ${startDateStr} to ${endDateStr}`);
    }

    const apiKey = process.env.HAPPYFOX_API_KEY;
    const apiSecret = process.env.HAPPYFOX_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('HappyFox API credentials not configured');
    }

    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const baseUrl = 'https://hapana.happyfox.com/api/1.1/json/tickets/';
    
    const allTickets = [];
    let page = 1;
    let hasMore = true;
    const maxPages = fullSync ? 200 : 20; // Increased for full sync
    const pageSize = 50; // HappyFox max per page
    let totalFetched = 0;

    console.log(`📡 Fetching HappyFox tickets (fullSync: ${fullSync}, maxPages: ${maxPages})`);
    
    // Step 1: Fetch tickets from HappyFox API
    while (hasMore && page <= maxPages && totalFetched < (fullSync ? 10000 : limit * 10)) {
      console.log(`📞 Fetching page ${page}...`);
      
      const url = `${baseUrl}?page=${page}&size=${pageSize}${dateFilter}&ordering=-created`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`📄 Page ${page}: No more tickets found (404)`);
          hasMore = false;
          break;
        }
        throw new Error(`HappyFox API error on page ${page}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const tickets = data.data || data.tickets || data;
      
      if (!Array.isArray(tickets) || tickets.length === 0) {
        console.log(`📄 Page ${page}: No more tickets found`);
        hasMore = false;
        break;
      }

      console.log(`📄 Page ${page}: Found ${tickets.length} tickets`);
      allTickets.push(...tickets);
      totalFetched += tickets.length;
      
      // Check if we've reached the end
      if (tickets.length < pageSize) {
        console.log(`📄 Page ${page}: Last page (fewer tickets than page size)`);
        hasMore = false;
      } else {
        page++;
        // Rate limiting - be respectful to HappyFox API
        console.log('⏱️ Waiting 200ms before next API call...');
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`✅ Fetched ${allTickets.length} total tickets from ${page - 1} pages`);

    if (allTickets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tickets found to sync',
        stats: { totalTicketsPublished: 0, pagesProcessed: page - 1 }
      });
    }

    // Step 2: Publish tickets to Pub/Sub
    console.log('📤 Publishing tickets to Pub/Sub...');
    
    const pubSubService = new PubSubService();
    const syncBatchId = `sync_${Date.now()}`;
    const publishedEventIds = [];
    let publishErrors = 0;

    const startTime = Date.now();
    
    // Publish tickets in smaller batches to avoid overwhelming Pub/Sub
    const PUBLISH_BATCH_SIZE = 10;
    for (let i = 0; i < allTickets.length; i += PUBLISH_BATCH_SIZE) {
      const batchTickets = allTickets.slice(i, i + PUBLISH_BATCH_SIZE);
      const currentBatch = Math.floor(i / PUBLISH_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allTickets.length / PUBLISH_BATCH_SIZE);
      
      console.log(`📤 Publishing batch ${currentBatch}/${totalBatches} (${batchTickets.length} tickets)`);
      
      try {
                 const batchEvents = batchTickets.map(ticket => ({
           ticketId: ticket.id.toString(),
           action: 'sync' as const,
           timestamp: new Date().toISOString(),
           source: 'sync' as const,
           ticketData: ticket,
           metadata: {
             syncBatchId,
             retryCount: 0,
             priority: ticket.priority?.name || 'normal',
             dateRange: dateFilter ? 'last_12_months' : 'recent'
           }
         }));

                 const eventIds = await pubSubService.publishHappyFoxTicketEvents(batchEvents);
        publishedEventIds.push(...eventIds);
        
        console.log(`✅ Batch ${currentBatch}: Published ${eventIds.length} events`);
        
        // Small delay between batches
        if (i + PUBLISH_BATCH_SIZE < allTickets.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Failed to publish batch ${currentBatch}:`, error);
        publishErrors += batchTickets.length;
      }
    }

    const processingTimeMs = Date.now() - startTime;
    
    console.log(`✅ HappyFox Pub/Sub sync completed:`);
    console.log(`   📊 Total tickets: ${allTickets.length}`);
    console.log(`   📤 Events published: ${publishedEventIds.length}`);
    console.log(`   ❌ Publish errors: ${publishErrors}`);
    console.log(`   ⏱️ Processing time: ${processingTimeMs}ms`);

    return NextResponse.json({
      success: true,
      message: 'HappyFox tickets published to Pub/Sub for processing',
      syncBatchId,
      stats: {
        totalTicketsPublished: publishedEventIds.length,
        totalTicketsFetched: allTickets.length,
        pagesProcessed: page - 1,
        publishedEventIds: publishedEventIds.length,
        publishErrors,
        processingTimeMs,
        dateRange: dateFilter || 'recent',
        fullSync
      },
      note: 'Tickets are being processed asynchronously via Pub/Sub. Check logs for individual processing status.'
    });

  } catch (error) {
    console.error('❌ HappyFox Pub/Sub sync failed:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'HAPPYFOX_PUBSUB_SYNC_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'HappyFox Pub/Sub Sync',
    description: 'Fetch HappyFox tickets and publish them to Pub/Sub for processing',
    usage: {
      method: 'POST',
      body: {
        limit: 'number (optional, default 50) - max tickets per sync',
        startDate: 'string (optional) - start date for filtering (YYYY-MM-DD)',
        endDate: 'string (optional) - end date for filtering (YYYY-MM-DD)', 
        fullSync: 'boolean (optional) - fetch last 12 months of tickets'
      }
    },
    examples: [
      '{ "limit": 100 }',
      '{ "fullSync": true }',
      '{ "startDate": "2024-01-01", "endDate": "2024-12-31" }'
    ]
  });
} 