import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action = 'test-connection', page = 1, size = 10 } = body

    const apiKey = process.env.HAPPYFOX_API_KEY
    const apiSecret = process.env.HAPPYFOX_API_SECRET
    const subdomain = process.env.HAPPYFOX_SUBDOMAIN

    if (!apiKey || !apiSecret || !subdomain) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'HappyFox API credentials not configured',
          missing: {
            apiKey: !apiKey,
            apiSecret: !apiSecret,
            subdomain: !subdomain
          }
        }
      })
    }

    if (action === 'test-connection') {
      // Test basic connectivity
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
      
              // Try both the standard HappyFox domain and the custom domain
        // Based on HappyFox API docs, the correct format includes /json/ in the path
        const baseDomains = [
          // Custom domain format (like support.hapana.com)
          `https://support.hapana.com/api/1.1/json`,
          // Standard HappyFox domain format
          subdomain.includes('.happyfox.com') 
            ? `https://${subdomain}/api/1.1/json`
            : `https://${subdomain}.happyfox.com/api/1.1/json`
        ]
      
      try {
        let lastError = null
        
        for (const baseUrl of baseDomains) {
          // Try different endpoints for each base domain
          const endpoints = [
            `${baseUrl}/tickets/`,
            `${baseUrl}/ticket/`,
            `${baseUrl}/tickets`,
            `${baseUrl}/staff/`,  // Sometimes staff endpoint works for testing
            `${baseUrl}/categories/`  // Categories might be accessible
          ]

          for (const endpoint of endpoints) {
            try {
              const url = new URL(endpoint)
              url.searchParams.set('page', '1')
              url.searchParams.set('size', '1')

              console.log(`Testing HappyFox endpoint: ${url.toString()}`)

              const response = await fetch(url.toString(), {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                }
              })

              if (response.ok) {
                const data = await response.json()
                return NextResponse.json({
                  success: true,
                  message: 'HappyFox API connection successful',
                  data: {
                    subdomain,
                    workingEndpoint: endpoint,
                    responseStructure: Object.keys(data),
                    sampleData: data
                  }
                })
              } else {
                const errorText = await response.text()
                lastError = {
                  endpoint,
                  status: response.status,
                  statusText: response.statusText,
                  error: errorText
                }
                console.log(`Endpoint ${endpoint} failed: ${response.status} ${response.statusText}`)
              }
            } catch (error) {
              lastError = {
                endpoint,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
              console.log(`Endpoint ${endpoint} error:`, error)
            }
          }
        }

        // If we get here, none of the endpoints worked
        return NextResponse.json({
          success: false,
          error: {
            code: 'ALL_ENDPOINTS_FAILED',
            message: 'All HappyFox API endpoints failed',
            lastError,
            testedDomains: baseDomains,
            note: 'Tried both custom domain (support.hapana.com) and standard HappyFox domain'
          }
        })

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: error instanceof Error ? error.message : 'Connection failed',
            subdomain
          }
        })
      }
    }

    if (action === 'fetch-tickets') {
      // Fetch a specific page of tickets
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
      // Handle subdomain format - it might be just the subdomain or the full domain
      const baseUrl = subdomain.includes('.happyfox.com') 
        ? `https://${subdomain}/api/1.1`
        : `https://${subdomain}.happyfox.com/api/1.1`
      
      try {
        const url = new URL(`${baseUrl}/tickets/`)
        url.searchParams.set('page', page.toString())
        url.searchParams.set('size', Math.min(size, 50).toString())

        console.log(`Fetching tickets: ${url.toString()}`)

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          return NextResponse.json({
            success: false,
            error: {
              code: 'FETCH_ERROR',
              message: `Failed to fetch tickets: ${response.status} ${response.statusText}`,
              details: errorText
            }
          })
        }

        const data = await response.json()
        
        return NextResponse.json({
          success: true,
          message: `Fetched tickets from page ${page}`,
          data: {
            page,
            size,
            responseStructure: Object.keys(data),
            ticketCount: data.data ? data.data.length : (Array.isArray(data) ? data.length : 0),
            tickets: data.data || data,
            metadata: {
              hasData: !!data.data,
              isArray: Array.isArray(data),
              totalKeys: Object.keys(data).length
            }
          }
        })

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: error instanceof Error ? error.message : 'Fetch failed'
          }
        })
      }
    }

    if (action === 'test-basic') {
      // Test just basic API connectivity without specific endpoints
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
      
      const testUrls = [
        'https://support.hapana.com/api/1.1/',
        'https://support.hapana.com/api/',
        'https://hapana.happyfox.com/api/1.1/',
        'https://hapana.happyfox.com/api/',
        'https://support.hapana.com/',
        'https://hapana.happyfox.com/'
      ]
      
      const results = []
      
      for (const testUrl of testUrls) {
        try {
          console.log(`Testing basic connectivity to: ${testUrl}`)
          
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Hapana-Platform/1.0'
            }
          })
          
          const responseText = await response.text()
          
          results.push({
            url: testUrl,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            bodyPreview: responseText.substring(0, 200)
          })
          
        } catch (error) {
          results.push({
            url: testUrl,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Basic connectivity test completed',
        results
      })
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INVALID_ACTION',
        message: 'Valid actions: test-connection, fetch-tickets, test-basic'
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'REQUEST_ERROR',
        message: error instanceof Error ? error.message : 'Request failed'
      }
    })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'HappyFox API test endpoint',
    availableActions: [
      'test-connection - Test basic API connectivity',
      'fetch-tickets - Fetch a page of tickets (params: page, size)',
      'test-basic - Test basic API connectivity without specific endpoints'
    ],
    usage: {
      testConnection: 'POST with {"action": "test-connection"}',
      fetchTickets: 'POST with {"action": "fetch-tickets", "page": 1, "size": 10}',
      testBasic: 'POST with {"action": "test-basic"}'
    }
  })
} 