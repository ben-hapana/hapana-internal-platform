'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/firebase-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Upload, FileText, Clock, CheckCircle, XCircle, AlertCircle, Eye, Play } from 'lucide-react'
import { toast } from 'sonner'

interface FinanceOperation {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive'
}

interface OperationExecution {
  id: string
  operationName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startTime: { seconds: number }
  endTime?: { seconds: number }
  duration?: number
  inputFile: {
    originalName: string
    size: number
  }
  results?: {
    success: boolean
    message: string
    recordsProcessed?: number
    recordsSuccessful?: number
    recordsFailed?: number
    mocked?: boolean // Added for demo mode
    note?: string // Added for demo mode
  }
  logs: Array<{
    timestamp: { seconds: number }
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
  }>
}

interface CSVPreviewData {
  headers: string[]
  rows: string[][]
  totalRows: number
  fileName: string
}

export default function FinanceOperationsPage() {
  const { user, loading: authLoading } = useAuth()
  const [operations, setOperations] = useState<FinanceOperation[]>([])
  const [executions, setExecutions] = useState<OperationExecution[]>([])
  const [selectedOperation, setSelectedOperation] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<CSVPreviewData | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const loadExecutions = useCallback(async () => {
    try {
      if (!user) return

      const token = await user.getIdToken()
      const response = await fetch('/api/finance-operations/executions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setExecutions(data.executions || [])
      }
    } catch (error) {
      console.error('Failed to load executions:', error)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadOperations()
      loadExecutions()
    }
  }, [user, loadExecutions])

  const loadOperations = async () => {
    try {
      // For now, we'll create a default Stripe operation
      const defaultOperations: FinanceOperation[] = [
        {
          id: 'stripe-balance-payout',
          name: 'Stripe Balance Payout',
          description: 'Process Stripe balance payouts for multiple currencies',
          status: 'active'
        }
      ]
      setOperations(defaultOperations)
    } catch (error) {
      console.error('Failed to load operations:', error)
      toast.error('Failed to load operations')
    } finally {
      setLoading(false)
    }
  }

  const parseCSV = (csvText: string): { headers: string[], rows: string[][] } => {
    // Split by lines but we'll need to handle multi-line fields
    const allLines = csvText.split('\n')
    if (allLines.length === 0) return { headers: [], rows: [] }

    // Function to parse the entire CSV properly handling multi-line quoted fields
    const parseMultiLineCsv = (text: string): string[][] => {
      const result: string[][] = []
      let currentRow: string[] = []
      let currentField = ''
      let inQuotes = false
      let i = 0

      while (i < text.length) {
        const char = text[i]
        const nextChar = text[i + 1]

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote - convert "" to "
            currentField += '"'
            i += 2
          } else {
            // Toggle quote state
            inQuotes = !inQuotes
            i++
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator - end current field
          currentRow.push(currentField.trim())
          currentField = ''
          i++
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
          // End of row (only if not inside quotes)
          if (currentField.trim() || currentRow.length > 0) {
            currentRow.push(currentField.trim())
            if (currentRow.some(field => field.length > 0)) {
              result.push(currentRow)
            }
            currentRow = []
            currentField = ''
          }
          // Skip \r\n combinations
          if (char === '\r' && nextChar === '\n') {
            i += 2
          } else {
            i++
          }
        } else {
          // Regular character
          currentField += char
          i++
        }
      }

      // Handle the last field and row
      if (currentField.trim() || currentRow.length > 0) {
        currentRow.push(currentField.trim())
        if (currentRow.some(field => field.length > 0)) {
          result.push(currentRow)
        }
      }

      return result
    }

    const allRows = parseMultiLineCsv(csvText)
    if (allRows.length === 0) return { headers: [], rows: [] }

    // First row is headers
    const headers = allRows[0].map(header => 
      header.replace(/^["']|["']$/g, '') // Remove surrounding quotes if any
    )
    
    // Rest are data rows
    const rows = allRows.slice(1).map(row => 
      row.map(cell => 
        cell.replace(/^["']|["']$/g, '') // Remove surrounding quotes if any
      )
    )

    return { headers, rows }
  }

  const isJsonString = (str: string): boolean => {
    try {
      JSON.parse(str)
      return true
    } catch {
      return false
    }
  }

  const formatCellContent = (content: string): { display: string; isJson: boolean; jsonData?: unknown } => {
    if (!content || content === '-') {
      return { display: '-', isJson: false }
    }

    if (isJsonString(content)) {
      try {
        const jsonData = JSON.parse(content)
        
        // For objects, show key-value pairs
        if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
          const keyValuePairs = Object.entries(jsonData as Record<string, unknown>)
            .slice(0, 3) // Show first 3 key-value pairs
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
          
          const display = keyValuePairs + (Object.keys(jsonData as Record<string, unknown>).length > 3 ? '...' : '')
          return { display, isJson: true, jsonData }
        }
        
        // For arrays, show first few items
        if (Array.isArray(jsonData)) {
          const display = jsonData.slice(0, 2).join(', ') + (jsonData.length > 2 ? '...' : '')
          return { display, isJson: true, jsonData }
        }
        
        // For primitives, just show the value
        return { display: String(jsonData), isJson: true, jsonData }
      } catch {
        return { display: content, isJson: false }
      }
    }

    return { display: content, isJson: false }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }

      setSelectedFile(file)
      
      // Read and preview the CSV file
      try {
        const text = await file.text()
        const { headers, rows } = parseCSV(text)
        
        setCsvPreview({
          headers,
          rows: rows.slice(0, 10), // Show first 10 rows
          totalRows: rows.length,
          fileName: file.name
        })
        
        setShowConfirmation(true)
      } catch (error) {
        console.error('Error reading CSV file:', error)
        toast.error('Error reading CSV file')
        setCsvPreview(null)
        setShowConfirmation(false)
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedOperation || !user) {
      toast.error('Please select a file and operation')
      return
    }

    setUploading(true)
    try {
      const token = await user.getIdToken()
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('operationId', selectedOperation)

      const response = await fetch('/api/finance-operations/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        toast.success('File uploaded successfully! Processing started.')
        setSelectedFile(null)
        setSelectedOperation('')
        setCsvPreview(null)
        setShowConfirmation(false)
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        
        // Reload executions to show the new one
        loadExecutions()
        
        // Start polling for status updates
        pollExecutionStatus(result.executionId)
      } else {
        toast.error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleCancelUpload = () => {
    setSelectedFile(null)
    setCsvPreview(null)
    setShowConfirmation(false)
    setSelectedOperation('')
    // Reset file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  const pollExecutionStatus = async (executionId: string) => {
    if (!user) return

    const token = await user.getIdToken()
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/finance-operations/status/${executionId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          const execution = data.execution

          // Update the execution in our list
          setExecutions(prev => 
            prev.map(exec => 
              exec.id === executionId ? execution : exec
            )
          )

          // Stop polling if completed or failed
          if (execution.status === 'completed' || execution.status === 'failed') {
            clearInterval(pollInterval)
            toast.success(
              execution.status === 'completed' 
                ? 'Processing completed successfully!' 
                : 'Processing failed. Check logs for details.'
            )
            loadExecutions() // Refresh the full list
          }
        }
      } catch (error) {
        console.error('Status polling error:', error)
      }
    }, 3000) // Poll every 3 seconds

    // Stop polling after 10 minutes
    setTimeout(() => clearInterval(pollInterval), 10 * 60 * 1000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'processing': return <AlertCircle className="h-4 w-4 text-blue-500" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
        <p className="text-gray-600">Please log in to access Finance Operations.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Finance Operations</h1>
        <p className="text-gray-600 mt-2">
          Upload CSV files for automated financial processing and track execution status
        </p>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Demo Mode:</strong> This is a demonstration version using mocked Stripe API responses. 
            No real financial transactions will be processed.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload & Process
            </CardTitle>
            <CardDescription>
              Select a CSV file and operation to process (Demo Mode)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="operation-select">Operation</Label>
              <select
                id="operation-select"
                value={selectedOperation}
                onChange={(e) => setSelectedOperation(e.target.value)}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={showConfirmation}
              >
                <option value="">Select an operation...</option>
                {operations.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} (Demo)
                  </option>
                ))}
              </select>
            </div>

            {/* Hidden file input */}
            <Input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              disabled={showConfirmation}
            />

            {!selectedFile ? (
              <Button
                onClick={() => {
                  if (!selectedOperation) {
                    toast.error('Please select an operation first')
                    return
                  }
                  document.getElementById('file-input')?.click()
                }}
                disabled={!selectedOperation}
                className="w-full h-12"
              >
                <Upload className="h-5 w-5 mr-2" />
                Choose CSV File to Upload
              </Button>
            ) : !showConfirmation ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>File Selected:</strong> {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                </div>
                <Button
                  onClick={() => document.getElementById('file-input')?.click()}
                  variant="outline"
                  className="w-full"
                >
                  Choose Different File
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Ready to Process:</strong> {selectedFile.name} • {csvPreview?.totalRows} rows
                  </p>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !selectedOperation || uploading}
                  className="w-full h-12"
                >
                  {uploading ? 'Processing...' : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Confirm & Process ({csvPreview?.totalRows} rows)
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancelUpload}
                  variant="outline"
                  className="w-full"
                  disabled={uploading}
                >
                  Cancel & Upload Different File
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Executions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Executions
            </CardTitle>
            <CardDescription>
              Track your recent processing jobs (Demo Mode)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {executions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No executions yet. Upload a file to get started.
                </p>
              ) : (
                executions.slice(0, 5).map((execution) => (
                  <div key={execution.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        <span className="font-medium">{execution.operationName}</span>
                        {execution.results?.mocked && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            DEMO
                          </Badge>
                        )}
                      </div>
                      <Badge className={getStatusColor(execution.status)}>
                        {execution.status}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>File: {execution.inputFile.originalName}</p>
                      <p>Started: {new Date(execution.startTime.seconds * 1000).toLocaleString()}</p>
                      {execution.duration && (
                        <p>Duration: {formatDuration(execution.duration)}</p>
                      )}
                      {execution.results && (
                        <div className="mt-2 p-2 bg-gray-50 rounded">
                          <p className="font-medium">{execution.results.message}</p>
                          {execution.results.recordsProcessed && (
                            <p>Records: {execution.results.recordsSuccessful}/{execution.results.recordsProcessed}</p>
                          )}
                          {execution.results.note && (
                            <p className="text-xs text-blue-600 mt-1">{execution.results.note}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CSV Preview Table */}
      {csvPreview && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              CSV Data Preview
            </CardTitle>
            <CardDescription>
              Review your data before processing • {csvPreview.fileName} • {csvPreview.totalRows} total rows
              {csvPreview.totalRows > 10 && " • Showing first 10 rows"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    {csvPreview.headers.map((header, index) => (
                      <th
                        key={index}
                        className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-900"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {row.map((cell, cellIndex) => {
                        const { display, isJson, jsonData } = formatCellContent(cell)
                        return (
                          <td
                            key={cellIndex}
                            className="border border-gray-300 px-4 py-2 text-sm text-gray-700"
                          >
                            {isJson ? (
                              <pre className="text-xs text-gray-600 bg-gray-100 p-1 rounded-md overflow-auto">
                                {JSON.stringify(jsonData, null, 2)}
                              </pre>
                            ) : (
                              display
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvPreview.totalRows > 10 && (
              <p className="text-sm text-gray-600 mt-3">
                ... and {csvPreview.totalRows - 10} more rows
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Operations */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Available Operations</CardTitle>
          <CardDescription>
            Finance operations you can run with CSV uploads (Demo Mode)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {operations.map((operation) => (
              <div key={operation.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  {operation.name}
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    DEMO
                  </Badge>
                </h3>
                <p className="text-sm text-gray-600 mb-3">{operation.description}</p>
                <p className="text-xs text-blue-600 mb-3">
                  Uses mocked Stripe API responses for demonstration purposes
                </p>
                <Badge variant={operation.status === 'active' ? 'default' : 'secondary'}>
                  {operation.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 