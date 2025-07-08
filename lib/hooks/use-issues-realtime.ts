import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '@/firebase/firebase'

interface Issue {
  id: string
  title: string
  description: string
  status: 'active' | 'monitoring' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  created: any // eslint-disable-line @typescript-eslint/no-explicit-any
  updated: any // eslint-disable-line @typescript-eslint/no-explicit-any
  totalAffectedBrands: number
  totalAffectedMembers: number
  totalAffectedLocations: number
  happyFoxTicketCount: number
  jiraTicketCount: number
  requiresIncidentReport: boolean
  hasIncidentReports: boolean
  tags: string[]
}

interface UseIssuesRealtimeOptions {
  limit?: number
  status?: string
  priority?: string
  brandId?: string
}

export function useIssuesRealtime(options: UseIssuesRealtimeOptions = {}) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      // Build query
      let q = query(
        collection(db, 'issues'),
        orderBy('updated', 'desc'),
        limit(options.limit || 50)
      )

      // Add filters
      if (options.status) {
        q = query(q, where('status', '==', options.status))
      }
      if (options.priority) {
        q = query(q, where('priority', '==', options.priority))
      }

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const issuesData: Issue[] = []
          
          snapshot.forEach((doc) => {
            const data = doc.data()
            issuesData.push({
              id: doc.id,
              title: data.title || '',
              description: data.description || '',
              status: data.status || 'active',
              priority: data.priority || 'medium',
              category: data.category || 'general',
              created: data.created,
              updated: data.updated,
              totalAffectedBrands: data.totalAffectedBrands || 0,
              totalAffectedMembers: data.totalAffectedMembers || 0,
              totalAffectedLocations: data.totalAffectedLocations || 0,
              happyFoxTicketCount: data.happyFoxTicketIds?.length || 0,
              jiraTicketCount: data.jiraTicketKeys?.length || 0,
              requiresIncidentReport: data.requiresIncidentReport || false,
              hasIncidentReports: Object.keys(data.incidentReports || {}).length > 0,
              tags: data.tags || []
            })
          })

          setIssues(issuesData)
          setLoading(false)
          setError(null)
        },
        (err) => {
          console.error('Error in issues listener:', err)
          setError(err.message)
          setLoading(false)
        }
      )

      // Cleanup listener on unmount
      return () => {
        unsubscribe()
      }
    } catch (err) {
      console.error('Error setting up issues listener:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }, [options.limit, options.status, options.priority, options.brandId])

  return { issues, loading, error }
} 