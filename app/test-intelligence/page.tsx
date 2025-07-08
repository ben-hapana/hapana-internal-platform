"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Brain, FileText, TestTube, CheckCircle, XCircle, Clock } from "lucide-react"

interface TestResult {
  success: boolean
  data?: Record<string, unknown>
  error?: Record<string, unknown>
  timestamp: Date
}

export default function TestIntelligencePage() {
  const [results, setResults] = useState<Record<string, TestResult>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [issueId, setIssueId] = useState('')
  const [brandId, setBrandId] = useState('hapana')

  const runTest = async (testName: string, action: string, extraData?: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setLoading(prev => ({ ...prev, [testName]: true }))
    
    try {
      const response = await fetch('/api/test/issue-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraData })
      })
      
      const data = await response.json()
      
      setResults(prev => ({
        ...prev,
        [testName]: {
          success: data.success,
          data: data.data,
          error: data.error,
          timestamp: new Date()
        }
      }))
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          error: { message: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date()
        }
      }))
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }))
    }
  }

  const runSimilarityTest = () => runTest('similarity', 'test-similarity')
  const runIncidentReportTest = () => runTest('incident-report', 'test-incident-report', { issueId, brandId })
  const createSampleIssue = () => runTest('sample-issue', 'create-sample-issue')

  const getResultIcon = (result?: TestResult) => {
    if (!result) return <Clock className="h-4 w-4 text-muted-foreground" />
    return result.success 
      ? <CheckCircle className="h-4 w-4 text-green-600" />
      : <XCircle className="h-4 w-4 text-red-600" />
  }

  const getResultBadge = (result?: TestResult) => {
    if (!result) return <Badge variant="secondary">Not Run</Badge>
    return result.success 
      ? <Badge variant="default" className="bg-green-600">Success</Badge>
      : <Badge variant="destructive">Failed</Badge>
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Issue Intelligence Test Suite</h1>
        <p className="text-muted-foreground">
          Test and validate the AI-powered issue intelligence system components
        </p>
      </div>

      <Separator />

      {/* Test Controls */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Similarity Detection Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Similarity Detection
            </CardTitle>
            <CardDescription>
              Test the AI-powered similarity detection using Vertex AI embeddings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getResultIcon(results.similarity)}
                {getResultBadge(results.similarity)}
              </div>
              <Button 
                onClick={runSimilarityTest}
                disabled={loading.similarity}
                size="sm"
              >
                {loading.similarity ? 'Testing...' : 'Run Test'}
              </Button>
            </div>
            
                         {results.similarity && (
               <div className="text-sm space-y-2">
                 {results.similarity.success ? (
                   <div className="space-y-1">
                     <p className="text-green-600">✓ Similarity detection test completed successfully</p>
                     <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                       {JSON.stringify(results.similarity.data, null, 2)}
                     </pre>
                   </div>
                 ) : (
                   <p className="text-red-600">✗ {String(results.similarity.error?.message || 'Test failed')}</p>
                 )}
                 <p className="text-muted-foreground text-xs">
                   {results.similarity.timestamp.toLocaleTimeString()}
                 </p>
               </div>
             )}
          </CardContent>
        </Card>

        {/* Sample Issue Creation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Sample Data Creation
            </CardTitle>
            <CardDescription>
              Create sample issue data for testing the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getResultIcon(results['sample-issue'])}
                {getResultBadge(results['sample-issue'])}
              </div>
              <Button 
                onClick={createSampleIssue}
                disabled={loading['sample-issue']}
                size="sm"
              >
                {loading['sample-issue'] ? 'Creating...' : 'Create Sample'}
              </Button>
            </div>
            
            {results['sample-issue'] && (
              <div className="text-sm space-y-2">
                {results['sample-issue'].success ? (
                  <div className="space-y-1">
                    <p><strong>Issue ID:</strong> {String(results['sample-issue'].data?.issueId || '')}</p>
                    <p className="text-green-600">{String(results['sample-issue'].data?.message || '')}</p>
                  </div>
                ) : (
                  <p className="text-red-600">{String(results['sample-issue'].error?.message || 'Test failed')}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  {results['sample-issue'].timestamp.toLocaleTimeString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Incident Report Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Incident Report Generation
          </CardTitle>
          <CardDescription>
            Test OpenAI-powered incident report generation for specific issues and brands
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issueId">Issue ID</Label>
              <Input
                id="issueId"
                placeholder="Enter issue ID to test"
                value={issueId}
                onChange={(e) => setIssueId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandId">Brand ID</Label>
              <Input
                id="brandId"
                placeholder="Enter brand ID"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getResultIcon(results['incident-report'])}
              {getResultBadge(results['incident-report'])}
            </div>
            <Button 
              onClick={runIncidentReportTest}
              disabled={loading['incident-report'] || !issueId || !brandId}
              size="sm"
            >
              {loading['incident-report'] ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
          
          {results['incident-report'] && (
            <div className="text-sm space-y-2">
              {results['incident-report'].success ? (
                <div className="space-y-2">
                  <p><strong>Report ID:</strong> {String(results['incident-report'].data?.reportId || '')}</p>
                  <p><strong>Title:</strong> {String(results['incident-report'].data?.title || '')}</p>
                  <div>
                    <strong>Summary:</strong>
                    <Textarea 
                      value={String(results['incident-report'].data?.summary || '')} 
                      readOnly 
                      className="mt-1 text-xs"
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-red-600">{String(results['incident-report'].error?.message || 'Test failed')}</p>
              )}
              <p className="text-muted-foreground text-xs">
                {results['incident-report'].timestamp.toLocaleTimeString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Components Status</CardTitle>
          <CardDescription>
            Overview of the issue intelligence system components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">AI/ML Services</h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Vertex AI</Badge>
                  <span>Semantic similarity detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">OpenAI GPT-4</Badge>
                  <span>Incident report generation</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Data Services</h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Firestore</Badge>
                  <span>Issue & ticket storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Webhooks</Badge>
                  <span>Real-time ticket processing</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Create Sample Data</h4>
            <p className="text-sm text-muted-foreground">
              Start by creating sample issue data using the &quot;Create Sample&quot; button. This will create a test issue in Firestore.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">2. Test AI Similarity</h4>
            <p className="text-sm text-muted-foreground">
              Run the similarity detection test to see how the AI identifies and links related issues using semantic analysis.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">3. Generate Incident Report</h4>
            <p className="text-sm text-muted-foreground">
              Use the issue ID from step 1 to test AI-powered incident report generation. The system will create a professional report using OpenAI.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 