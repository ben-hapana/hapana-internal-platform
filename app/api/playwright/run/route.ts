import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { firestoreAdmin } from '@/lib/firestore-admin'

interface RunTestRequest {
  testName: string
  environment: string
  userId: string
  userEmail: string
}

export async function POST(request: NextRequest) {
  try {
    const { testName, environment, userId, userEmail }: RunTestRequest = await request.json()

    // Validate required fields
    if (!testName || !environment || !userId || !userEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: testName, environment, userId, userEmail' },
        { status: 400 }
      )
    }

    console.log(`🎭 Starting Playwright test: ${testName} on ${environment}`)

    // Create initial test result record
    const testId = await firestoreAdmin.createTestResult({
      testName,
      environment: environment as 'production' | 'staging' | 'development',
      status: 'running',
      userId,
      userEmail
    })

    console.log(`📊 Test result created with ID: ${testId}`)

    // Run Playwright test asynchronously
    runPlaywrightTest(testId, testName, environment)
      .then(async (result) => {
        console.log(`✅ Test ${testName} completed successfully`)
        
        await firestoreAdmin.updateTestResult(testId, {
          status: 'passed',
          duration: result.duration
        })
      })
      .catch(async (error) => {
        console.error(`❌ Test ${testName} failed:`, error)
        
        await firestoreAdmin.updateTestResult(testId, {
          status: 'failed',
          errorMessage: error.message,
          duration: error.duration
        })
      })

    return NextResponse.json({
      success: true,
      testId,
      message: `Test ${testName} started on ${environment}`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to start test:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start test',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function runPlaywrightTest(testId: string, testName: string, environment: string): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    
    // Simulate running a Playwright test
    // In a real implementation, this would spawn the actual Playwright process
    const testProcess = spawn('echo', [`Running ${testName} on ${environment}`], {
      stdio: 'pipe'
    })

    testProcess.stdout.on('data', (data) => {
      console.log(`📝 Test output: ${data}`)
    })

    testProcess.stderr.on('data', (data) => {
      console.error(`⚠️ Test stderr: ${data}`)
    })

    testProcess.on('close', (code) => {
      const duration = Date.now() - startTime
      
      if (code === 0) {
        console.log(`✅ Test process completed successfully`)
        resolve({ duration })
      } else {
        console.error(`❌ Test process failed with code ${code}`)
        reject({ message: `Test failed with exit code ${code}`, duration })
      }
    })

    testProcess.on('error', (error) => {
      const duration = Date.now() - startTime
      console.error(`❌ Test process error:`, error)
      reject({ message: error.message, duration })
    })
  })
} 