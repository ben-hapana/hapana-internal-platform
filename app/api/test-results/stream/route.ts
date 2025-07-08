import { NextRequest } from 'next/server'
import { serverTestResultsService } from '@/lib/firestore-admin'

export async function GET(request: NextRequest) {
  // Set up Server-Sent Events headers
  const responseHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  const encoder = new TextEncoder()
  let isConnected = true

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({ 
        type: 'connected', 
        message: 'Connected to test results stream' 
      })}\n\n`
      controller.enqueue(encoder.encode(initialMessage))

      // Set up periodic polling for test results
      const pollResults = async () => {
        if (!isConnected) return
        
        try {
          const results = await serverTestResultsService.getRecent(50)
          
          // Send the results as SSE
          const data = JSON.stringify({
            type: 'test-results',
            results: results,
            timestamp: new Date().toISOString()
          })
          
          const message = `data: ${data}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch (error) {
          console.error('Error polling test results:', error)
        }
      }

      // Poll every 5 seconds for new results
      const pollInterval = setInterval(pollResults, 5000)
      
      // Send initial results
      pollResults()

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        isConnected = false
        clearInterval(pollInterval)
        controller.close()
      })

      // Send periodic heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (isConnected) {
          const heartbeatMessage = `data: ${JSON.stringify({ 
            type: 'heartbeat', 
            timestamp: new Date().toISOString() 
          })}\n\n`
          controller.enqueue(encoder.encode(heartbeatMessage))
        } else {
          clearInterval(heartbeat)
        }
      }, 30000) // Every 30 seconds
    }
  })

  return new Response(stream, { headers: responseHeaders })
} 