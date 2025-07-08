"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, RefreshCw, Clock, TestTube } from 'lucide-react'

interface ActivityFeedProps {
  className?: string
  maxItems?: number
}

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

export function ActivityFeed({ className, maxItems = 8 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch(`/api/test-results?limit=${maxItems}`)
      const data = await response.json()
      
      if (data.success) {
        setActivities(data.results)
      } else {
        console.error('Failed to fetch activities:', data.error)
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }, [maxItems])

  useEffect(() => {
    // Initial fetch
    fetchActivities()

    // Poll for updates every 15 seconds
    const interval = setInterval(fetchActivities, 15000)

    return () => clearInterval(interval)
  }, [fetchActivities])

  const getActivityIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getActivityBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800 text-xs">Passed</Badge>
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 text-xs">Running</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Pending</Badge>
    }
  }

  const formatRelativeTime = (timestamp: { seconds: number; nanoseconds: number }) => {
    const date = new Date(timestamp.seconds * 1000)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    
    return date.toLocaleDateString()
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment) {
      case 'production':
        return 'text-green-600'
      case 'staging':
        return 'text-yellow-600'
      case 'development':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <TestTube className="mr-2 h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-1/2 h-3 bg-gray-200 rounded animate-pulse mt-1"></div>
                </div>
                <div className="w-16 h-5 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <TestTube className="mr-2 h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TestTube className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No test activity yet</p>
            <p className="text-sm">Run some tests to see activity here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <TestTube className="mr-2 h-5 w-5" />
          Recent Activity
          <Badge className="ml-auto bg-blue-50 text-blue-600">{activities.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-3 pb-3 border-b last:border-b-0 last:pb-0">
              <div className="flex-shrink-0">
                {getActivityIcon(activity.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate">{activity.testName}</p>
                  {getActivityBadge(activity.status)}
                </div>
                
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`text-xs font-medium ${getEnvironmentColor(activity.environment)}`}>
                    {activity.environment}
                  </span>
                                     <span className="text-xs text-muted-foreground">
                     {formatRelativeTime(activity.timestamp)}
                   </span>
                  {activity.duration && (
                    <span className="text-xs text-muted-foreground">
                      • {(activity.duration / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                
                {activity.errorMessage && (
                  <p className="text-xs text-red-600 mt-1 truncate">
                    {activity.errorMessage}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 