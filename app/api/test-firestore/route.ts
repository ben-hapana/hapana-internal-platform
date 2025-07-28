import { firestoreAdmin } from '@/lib/firestore-admin'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    console.log('🧪 Testing Firestore connection...')
    
    // Create a test document
    const testId = await firestoreAdmin.createTestResult({
      testName: 'Firestore Connection Test',
      environment: 'development',
      status: 'passed',
      userId: 'system',
      userEmail: 'system@hapana.com'
    })

    console.log('✅ Test document created with ID:', testId)

    return NextResponse.json({
      success: true,
      message: 'Firestore connection successful',
      testDocumentId: testId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Firestore test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    console.log('🔍 Fetching recent test results...')
    
    const results = await firestoreAdmin.getTestResults(undefined, 5)

    return NextResponse.json({
      success: true,
      count: results.length,
      results: results.map(result => ({
        id: result.id,
        testName: result.testName,
        status: result.status,
        timestamp: result.timestamp
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to fetch test results:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 