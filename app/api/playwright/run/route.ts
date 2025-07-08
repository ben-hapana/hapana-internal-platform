import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { serverTestResultsService } from '@/lib/firestore-admin'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { testName, environment, userId, userEmail } = await request.json()
    
    if (!testName || !environment) {
      return NextResponse.json(
        { error: 'Test name and environment are required' },
        { status: 400 }
      )
    }

    // Map test names to actual test files
    const testFiles: Record<string, string> = {
      'Login Functionality': 'tests/qacore-login.spec.ts',
      'Navigation Tests': 'tests/qacore-navigation.spec.ts',
      'Schedule Page': 'tests/qacore-navigation.spec.ts --grep "should navigate to Schedule page"',
      'Clients Page': 'tests/qacore-navigation.spec.ts --grep "should navigate to Clients page"',
      'Reports Page': 'tests/qacore-navigation.spec.ts --grep "should navigate to Reports page"',
      'Payments Dropdown': 'tests/qacore-navigation.spec.ts --grep "should show Payments dropdown menu"'
    }

    const testFile = testFiles[testName]
    if (!testFile) {
      return NextResponse.json(
        { error: 'Unknown test name' },
        { status: 400 }
      )
    }

    // For QA Core tests, we always use the production URL since it's the real system
    // Different environments can be simulated through different test data/users

    // Create initial test record in Firestore
    const testId = await serverTestResultsService.create({
      testName,
      environment: environment || 'development',
      status: 'running',
      userId: userId || 'anonymous',
      userEmail: userEmail || 'unknown@example.com'
    })

    // Execute Playwright test
    const playwrightDir = process.env.PLAYWRIGHT_TESTS_DIR || '/Users/bencochrane/Code/playwright'
    const command = `cd ${playwrightDir} && npx playwright test ${testFile} --reporter=line`
    
    const startTime = Date.now()
    
    // Run test in background and update Firestore with results
    execAsync(command)
      .then(async (result) => {
        console.log(`Test ${testName} completed:`, result.stdout)
        await serverTestResultsService.update(testId, {
          status: 'passed',
          duration: Date.now() - startTime
        })
        return result
      })
      .catch(async (error) => {
        console.error(`Test ${testName} failed:`, error.message)
        await serverTestResultsService.update(testId, {
          status: 'failed',
          duration: Date.now() - startTime,
          errorMessage: error.message
        })
        return { error: error.message }
      })

    // Don't wait for completion, return immediate response
    return NextResponse.json({
      message: `Test ${testName} started on ${environment}`,
      testName,
      environment,
      testId,
      status: 'started'
    })

  } catch (error) {
    console.error('Error running Playwright test:', error)
    return NextResponse.json(
      { error: 'Failed to start test' },
      { status: 500 }
    )
  }
} 