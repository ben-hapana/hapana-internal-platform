import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST() {
  try {
    const playwrightDir = process.env.PLAYWRIGHT_TESTS_DIR || '/Users/bencochrane/Code/playwright'
    
    // Run all tests with JSON reporter for results
    const command = `cd ${playwrightDir} && npx playwright test --reporter=json --output-dir=test-results`
    
    // Execute tests in background and handle the promise
    execAsync(command)
      .then((result) => {
        console.log('All tests completed:', result.stdout)
        // Parse results and store/emit updates
        return result
      })
      .catch((error) => {
        console.error('Some tests failed:', error.message)
        // Even if some tests fail, we want to process the results
        return { error: error.message, stdout: error.stdout }
      })

    return NextResponse.json({
      message: 'All tests started successfully',
      status: 'started',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error running all Playwright tests:', error)
    return NextResponse.json(
      { error: 'Failed to start all tests' },
      { status: 500 }
    )
  }
} 