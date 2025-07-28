import { firestoreAdmin } from '@/lib/firestore-admin'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const stats = await firestoreAdmin.getTestResultStats()

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to fetch test result stats:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 