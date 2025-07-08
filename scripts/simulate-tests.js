/**
 * Test simulation script to populate Firestore with sample test results
 * This demonstrates the real-time updates functionality
 */

const testScenarios = [
  {
    testName: 'Login Functionality',
    environment: 'production',
    duration: Math.floor(Math.random() * 10000) + 2000,
    status: Math.random() > 0.1 ? 'passed' : 'failed'
  },
  {
    testName: 'Navigation Tests',
    environment: 'production',
    duration: Math.floor(Math.random() * 15000) + 3000,
    status: Math.random() > 0.15 ? 'passed' : 'failed'
  },
  {
    testName: 'Schedule Page',
    environment: 'production',
    duration: Math.floor(Math.random() * 8000) + 1500,
    status: Math.random() > 0.2 ? 'passed' : 'failed'
  },
  {
    testName: 'Clients Page',
    environment: 'production',
    duration: Math.floor(Math.random() * 12000) + 4000,
    status: Math.random() > 0.1 ? 'passed' : 'failed'
  },
  {
    testName: 'Reports Page',
    environment: 'production',
    duration: Math.floor(Math.random() * 6000) + 2000,
    status: Math.random() > 0.25 ? 'passed' : 'failed'
  },
  {
    testName: 'Payments Dropdown',
    environment: 'production',
    duration: Math.floor(Math.random() * 9000) + 3000,
    status: Math.random() > 0.15 ? 'passed' : 'failed'
  }
]

const errorMessages = [
  'Element not found: #submit-button',
  'Timeout waiting for page load',
  'Network error: Connection refused',
  'Assertion failed: Expected "Welcome" but found "Error"',
  'Element not clickable: button is hidden',
  'Database connection timeout'
]

async function simulateTest() {
  const scenario = testScenarios[Math.floor(Math.random() * testScenarios.length)]
  const testData = {
    ...scenario,
    errorMessage: scenario.status === 'failed' 
      ? errorMessages[Math.floor(Math.random() * errorMessages.length)]
      : null,
    userId: 'test-user-' + Math.random().toString(36).substr(2, 9),
    userEmail: 'test@hapana.com'
  }

  console.log(`🚀 Simulating test: ${testData.testName} on ${testData.environment}`)
  
  try {
    const response = await fetch('http://localhost:3001/api/playwright/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`✅ Test simulated successfully: ${result.id}`)
    } else {
      console.error(`❌ Failed to simulate test: ${response.statusText}`)
    }
  } catch (error) {
    console.error(`❌ Error simulating test: ${error.message}`)
  }
}

async function runSimulation() {
  console.log('🎭 Starting test simulation...')
  console.log('This will create sample test results in Firestore to demonstrate real-time updates')
  console.log('Make sure your Next.js app is running on http://localhost:3001\n')

  // Run 3 tests initially
  for (let i = 0; i < 3; i++) {
    await simulateTest()
    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds between tests
  }

  console.log('\n🎯 Initial tests completed!')
  console.log('Check your dashboard for real-time updates.')
  
  // Continue running tests every 30 seconds
  console.log('Continuing to run tests every 30 seconds...')
  console.log('Press Ctrl+C to stop\n')
  
  setInterval(async () => {
    await simulateTest()
  }, 30000)
}

// Start simulation
runSimulation().catch(console.error) 