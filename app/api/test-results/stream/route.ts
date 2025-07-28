import { firestoreAdmin } from '@/lib/firestore-admin'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial data
        const results = await firestoreAdmin.getTestResults(undefined, 50)
        
        const data = JSON.stringify({
          type: 'initial',
          data: results,
          timestamp: new Date().toISOString()
        })
        
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))

        // Set up polling interval for updates
        const interval = setInterval(async () => {
          try {
            const updatedResults = await firestoreAdmin.getTestResults(undefined, 50)
            
            const updateData = JSON.stringify({
              type: 'update',
              data: updatedResults,
              timestamp: new Date().toISOString()
            })
            
            controller.enqueue(encoder.encode(`data: ${updateData}\n\n`))
          } catch (error) {
            console.error('❌ Stream update error:', error)
            
            const errorData = JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            })
            
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          }
        }, 5000) // Update every 5 seconds

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(interval)
          controller.close()
        })

      } catch (error) {
        console.error('❌ Stream initialization error:', error)
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
} 