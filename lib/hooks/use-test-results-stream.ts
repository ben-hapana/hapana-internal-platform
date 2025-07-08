"use client"

import { useState, useEffect, useRef } from 'react'

interface TestResult {
  id: string
  testName: string
  environment: 'production' | 'staging' | 'development'
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  errorMessage?: string
  timestamp: {
    seconds: number
    nanoseconds: number
  }
  userId: string
  userEmail: string
}

interface StreamMessage {
  type: 'connected' | 'test-results' | 'heartbeat'
  results?: TestResult[]
  message?: string
  timestamp: string
}

export function useTestResultsStream() {
  const [results, setResults] = useState<TestResult[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Only connect if we're in the browser
    if (typeof window === 'undefined') return

    try {
      const eventSource = new EventSource('/api/test-results/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
      }

      eventSource.onmessage = (event) => {
        try {
          const data: StreamMessage = JSON.parse(event.data)
          
          switch (data.type) {
            case 'connected':
              console.log('Connected to test results stream')
              break
            case 'test-results':
              if (data.results) {
                setResults(data.results)
              }
              break
            case 'heartbeat':
              // Just keep the connection alive
              break
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err)
        }
      }

      eventSource.onerror = (err) => {
        console.error('EventSource error:', err)
        setIsConnected(false)
        setError('Connection lost. Retrying...')
        
        // Retry connection after 5 seconds
        setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            eventSourceRef.current = null
            // Re-run the effect to reconnect
            setError(null)
          }
        }, 5000)
      }

    } catch (err) {
      console.error('Error setting up EventSource:', err)
      setError('Failed to connect to real-time updates')
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setIsConnected(false)
    }
  }, [])

  return {
    results,
    isConnected,
    error
  }
} 