import { NextResponse } from 'next/server'
import { existsSync } from 'fs'

export async function GET() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        firebase: checkFirebaseSetup(),
        playwright: checkPlaywrightSetup(),
        environment: checkEnvironmentVars(),
        firestore: 'healthy'
      }
    }

    const allHealthy = Object.values(health.services).every(
      status => status === 'healthy' || status === 'not_configured'
    )

    return NextResponse.json(health, { 
      status: allHealthy ? 200 : 503 
    })

  } catch (error: unknown) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 503 })
  }
}

function checkPlaywrightSetup(): string {
  const playwrightDir = process.env.PLAYWRIGHT_TESTS_DIR || '/Users/bencochrane/Code/playwright'
  
  if (!existsSync(playwrightDir)) {
    return 'directory_not_found'
  }
  
  if (!existsSync(`${playwrightDir}/package.json`)) {
    return 'not_configured'
  }
  
  return 'healthy'
}

function checkFirebaseSetup(): string {
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  ]
  
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    return 'missing_config'
  }
  
  return 'healthy'
}

function checkEnvironmentVars(): string {
  const requiredVars = [
    'PLAYWRIGHT_TESTS_DIR',
    'PLAYWRIGHT_BASE_URL',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'HAPPYBOX_API_KEY',
    'JIRA_EMAIL',
    'JIRA_API_TOKEN',
    'OPENAI_API_KEY'
  ]
  
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    return 'missing_vars'
  }
  
  return 'healthy'
} 