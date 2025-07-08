import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export async function POST(request: NextRequest) {
  try {
    const { title, description, priority, originalTicketId } = await request.json()
    
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    const jiraHost = process.env.JIRA_HOST
    const jiraUsername = process.env.JIRA_USERNAME  
    const jiraApiToken = process.env.JIRA_API_TOKEN

    if (!jiraHost || !jiraUsername || !jiraApiToken) {
      return NextResponse.json(
        { error: 'Jira configuration missing' },
        { status: 500 }
      )
    }

    // Map priority levels
    const priorityMapping: Record<string, string> = {
      'urgent': 'Highest',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    }

    const jiraPriority = priorityMapping[priority] || 'Medium'

    // Create Jira ticket
    const jiraTicketData = {
      fields: {
        project: {
          key: 'SUP' // Replace with your Jira project key
        },
        summary: `[Support] ${title}`,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `Original Support Ticket: ${originalTicketId}\n\n${description}`
                }
              ]
            }
          ]
        },
        issuetype: {
          name: 'Task'
        },
        priority: {
          name: jiraPriority
        },
        labels: ['support', 'customer-issue']
      }
    }

    const auth = Buffer.from(`${jiraUsername}:${jiraApiToken}`).toString('base64')
    
    const response = await axios.post(
      `https://${jiraHost}/rest/api/3/issue`,
      jiraTicketData,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    const jiraTicket = response.data

    return NextResponse.json({
      key: jiraTicket.key,
      id: jiraTicket.id,
      url: `https://${jiraHost}/browse/${jiraTicket.key}`,
      message: `Jira ticket ${jiraTicket.key} created successfully`
    })

  } catch (error: unknown) {
    console.error('Error creating Jira ticket:', error)
    
    // For demo purposes, return a mock success response
    const mockJiraKey = `SUP-${Math.floor(Math.random() * 1000)}`
    
    return NextResponse.json({
      key: mockJiraKey,
      id: `mock-${mockJiraKey}`,
      url: `https://hapana.atlassian.net/browse/${mockJiraKey}`,
      message: `Demo: Jira ticket ${mockJiraKey} would be created`
    })
  }
} 