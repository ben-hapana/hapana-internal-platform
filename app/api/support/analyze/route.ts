import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { ticketId } = await request.json()
    
    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    // In a real implementation, you would fetch the ticket details from your database
    // For demo purposes, we'll simulate the analysis
    const mockTicketData = {
      title: 'Unable to login to application',
      description: 'User reports getting "Invalid credentials" error when trying to log in with correct credentials.',
      customerMessage: 'I\'ve been trying to log in for the past hour and keep getting an error. This is very frustrating as I need to access my account urgently.'
    }

    const analysisPrompt = `
    Analyze the following support ticket and provide insights:
    
    Title: ${mockTicketData.title}
    Description: ${mockTicketData.description}
    Customer Message: ${mockTicketData.customerMessage}
    
    Please provide:
    1. Sentiment analysis (positive, neutral, negative)
    2. Category classification
    3. 3-5 suggested actions for the support team
    4. Priority level recommendation
    
    Return the response in the following JSON format:
    {
      "sentiment": "positive|neutral|negative",
      "category": "category name",
      "suggestedActions": ["action1", "action2", "action3"],
      "priorityRecommendation": "low|medium|high|urgent",
      "summary": "Brief summary of the issue"
    }
    `

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant that analyzes customer support tickets. Always respond with valid JSON."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
    })

    const analysisText = completion.choices[0]?.message?.content
    
    if (!analysisText) {
      throw new Error('No analysis received from OpenAI')
    }

    // Parse the JSON response
    const analysis = JSON.parse(analysisText)

    // Add some mock similar tickets for demo
    analysis.similarTickets = ['HF-1180', 'HF-1156', 'HF-1089']

    return NextResponse.json(analysis)

  } catch (error) {
    console.error('Error analyzing ticket:', error)
    
    // Fallback analysis for demo purposes
    const fallbackAnalysis = {
      sentiment: 'negative',
      category: 'Authentication Issue',
      suggestedActions: [
        'Check user account status',
        'Verify password reset functionality', 
        'Review recent login attempts',
        'Check for system-wide authentication issues'
      ],
      priorityRecommendation: 'high',
      summary: 'User experiencing login difficulties',
      similarTickets: ['HF-1180', 'HF-1156']
    }
    
    return NextResponse.json(fallbackAnalysis)
  }
} 