"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { 
  TestTube, 
  Play, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Eye,
  Download
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from '@/lib/firebase-auth'
import { RealTimeStats } from '@/components/qa/real-time-stats'

interface TestResult {
  id: string
  name: string
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  error?: string
  timestamp: Date
  environment: string
}

interface APITestResult {
  id: string
  testName: string
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  errorMessage?: string
  timestamp: {
    seconds: number
    nanoseconds: number
  }
  environment: string
}

export default function QAPage() {
  const [tests, setTests] = useState<TestResult[]>([])
  const [isRunningAllTests, setIsRunningAllTests] = useState(false)
  const [selectedEnvironment, setSelectedEnvironment] = useState("all")
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // Fetch test results from API
  const fetchTestResults = useCallback(async () => {
    if (!user) return
    
    try {
      const response = await fetch(`/api/test-results?environment=${selectedEnvironment}&limit=50`)
      const data = await response.json()
      
      if (data.success) {
                 // Convert API results to local format for compatibility
         const convertedTests = data.results.map((result: APITestResult) => ({
          id: result.id || '',
          name: result.testName,
          status: result.status,
          duration: result.duration,
          error: result.errorMessage,
          timestamp: new Date(result.timestamp.seconds * 1000),
          environment: result.environment
        }))
        
        setTests(convertedTests)
      } else {
        console.error('Failed to fetch test results:', data.error)
      }
    } catch (error) {
      console.error('Error fetching test results:', error)
    } finally {
      setLoading(false)
    }
  }, [user, selectedEnvironment])

  useEffect(() => {
    // Initial fetch
    fetchTestResults()

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchTestResults, 10000)

    return () => clearInterval(interval)
  }, [fetchTestResults])

  // Load sample data if no real data and not loading
  useEffect(() => {
    if (tests.length === 0 && !loading && user) {
      // Add some sample data for demonstration
      setTests([
        {
          id: 'sample-1',
          name: 'Login Functionality',
          status: 'pending',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          environment: 'production'
        },
        {
          id: 'sample-2', 
          name: 'Navigation Tests',
          status: 'pending',
          timestamp: new Date(Date.now() - 2 * 60 * 1000),
          environment: 'production'
        },
        {
          id: 'sample-3',
          name: 'Schedule Page',
          status: 'pending',
          timestamp: new Date(Date.now() - 10 * 60 * 1000),
          environment: 'production'
        },
        {
          id: 'sample-4',
          name: 'Clients Page',
          status: 'pending',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          environment: 'production'
        },
        {
          id: 'sample-5',
          name: 'Reports Page',
          status: 'pending',
          timestamp: new Date(Date.now() - 20 * 60 * 1000),
          environment: 'production'
        },
        {
          id: 'sample-6',
          name: 'Payments Dropdown',
          status: 'pending',
          timestamp: new Date(Date.now() - 25 * 60 * 1000),
          environment: 'production'
        }
      ])
    }
  }, [tests.length, loading, user])

  const runTest = async (testName: string, environment: string) => {
    if (!user) {
      toast.error('Please sign in to run tests')
      return
    }

    toast.loading(`Starting ${testName} on ${environment}...`)
    
    try {
      const response = await fetch('/api/playwright/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          testName, 
          environment,
          userId: user.uid,
          userEmail: user.email 
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`🚀 ${testName} started on ${environment}`)
        
        // Optimistically update UI - real-time listener will sync actual status
        setTests(prev => prev.map(test => 
          test.name === testName 
            ? { ...test, status: 'running' as const, timestamp: new Date() }
            : test
        ))
      } else {
        toast.error(`Failed to start test: ${data.error}`)
      }
    } catch (error: unknown) {
      toast.error(`Error running test: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const runAllTests = async () => {
    if (!user) {
      toast.error('Please sign in to run tests')
      return
    }

    setIsRunningAllTests(true)
    toast.loading('🚀 Starting all tests...')
    
    try {
      // Run each test individually to track them properly
      const testPromises = tests.map(test => 
        runTest(test.name, test.environment)
      )
      
      await Promise.allSettled(testPromises)
      
      toast.success('✅ All tests started successfully')
    } catch (error: unknown) {
      toast.error(`Error running all tests: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunningAllTests(false)
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-green-100 text-green-800">Passed</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    
    return date.toLocaleDateString()
  }

  const getEnvironmentBadge = (environment: string) => {
    switch (environment) {
      case 'production':
        return <Badge className="bg-green-100 text-green-800">Production</Badge>
      case 'staging':
        return <Badge className="bg-yellow-100 text-yellow-800">Staging</Badge>
      case 'development':
        return <Badge className="bg-blue-100 text-blue-800">Development</Badge>
      default:
        return <Badge variant="outline">{environment}</Badge>
    }
  }

  const filteredTests = selectedEnvironment === "all" 
    ? tests 
    : tests.filter(test => test.environment === selectedEnvironment)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">QA Testing Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor and execute Playwright tests across environments
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={runAllTests}
              disabled={isRunningAllTests}
              className="flex items-center space-x-2"
            >
              {isRunningAllTests ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>Run All Tests</span>
            </Button>
          </div>
        </div>

        {/* Real-time Statistics */}
        <RealTimeStats className="mb-6" />

        {/* Environment Status */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Production</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">All tests passing</span>
                </div>
                <Badge className="bg-green-100 text-green-800">Healthy</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Staging</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Tests running</span>
                </div>
                <Badge className="bg-blue-100 text-blue-800">Testing</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Development</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm">1 test failing</span>
                </div>
                <Badge variant="destructive">Issues</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TestTube className="mr-2 h-5 w-5" />
              Test Results
            </CardTitle>
            <CardDescription>
              Recent test executions and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedEnvironment} onValueChange={setSelectedEnvironment} className="w-full">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="production">Production</TabsTrigger>
                <TabsTrigger value="staging">Staging</TabsTrigger>
                <TabsTrigger value="development">Development</TabsTrigger>
              </TabsList>
              <TabsContent value={selectedEnvironment} className="mt-4">
                <div className="space-y-4">
                  {filteredTests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(test.status)}
                    <div>
                      <p className="font-medium">{test.name}</p>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>Duration: {formatDuration(test.duration)}</span>
                        <span>{formatTimestamp(test.timestamp)}</span>
                      </div>
                      <div className="mt-2">
                        {getEnvironmentBadge(test.environment)}
                      </div>
                      {test.error && (
                        <p className="text-sm text-red-600 mt-1 flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {test.error}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(test.status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runTest(test.name, test.environment)}
                      disabled={test.status === 'running'}
                    >
                      {test.status === 'running' ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
} 