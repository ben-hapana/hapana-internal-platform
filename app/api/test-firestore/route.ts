import { NextResponse } from 'next/server'
import { serverTestResultsService } from '@/lib/firestore-admin'

export async function POST() {
  try {
    console.log('Testing Firestore connection...')
    
    // Test creating a simple test result
    const testId = await serverTestResultsService.create({
      testName: 'Test Connection',
      environment: 'development',
      status: 'passed',
      userId: 'test-user',
      userEmail: 'test@example.com'
    })
    
    console.log('Test result created with ID:', testId)
    
    return NextResponse.json({
      success: true,
      message: 'Firestore connection working',
      testId: testId
    })
  } catch (error) {
    console.error('Firestore test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Firestore connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    console.log('Testing Firestore read...')
    
    const results = await serverTestResultsService.getRecent(5)
    
    console.log('Retrieved test results:', results.length)
    
    return NextResponse.json({
      success: true,
      message: 'Firestore read working',
      count: results.length,
      results: results
    })
  } catch (error) {
    console.error('Firestore read error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Firestore read failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 