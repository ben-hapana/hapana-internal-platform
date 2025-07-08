import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin
const app = initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hapana-platform-dev'
})

const db = getFirestore(app)

async function setupSampleData() {
  console.log('Setting up sample data for Issue Intelligence system...')

  try {
    // Sample Brands
    const brands = [
      {
        id: 'hapana-main',
        name: 'Hapana',
        code: 'HAP',
        region: 'New Zealand',
        memberCount: 15000
      },
      {
        id: 'fitness-first',
        name: 'Fitness First',
        code: 'FF',
        region: 'Australia',
        memberCount: 25000
      },
      {
        id: 'wellness-co',
        name: 'Wellness Co',
        code: 'WEL',
        region: 'Singapore',
        memberCount: 8000
      }
    ]

    // Sample Locations
    const locations = [
      // Hapana locations
      {
        id: 'hapana-auckland-central',
        name: 'Hapana Auckland Central',
        brandId: 'hapana-main',
        address: '123 Queen Street, Auckland, New Zealand',
        memberCount: 3500,
        services: ['fitness', 'classes', 'personal_training'],
        timezone: 'Pacific/Auckland'
      },
      {
        id: 'hapana-wellington',
        name: 'Hapana Wellington',
        brandId: 'hapana-main',
        address: '456 Lambton Quay, Wellington, New Zealand',
        memberCount: 2800,
        services: ['fitness', 'classes', 'swimming'],
        timezone: 'Pacific/Auckland'
      },
      {
        id: 'hapana-christchurch',
        name: 'Hapana Christchurch',
        brandId: 'hapana-main',
        address: '789 Colombo Street, Christchurch, New Zealand',
        memberCount: 2200,
        services: ['fitness', 'classes'],
        timezone: 'Pacific/Auckland'
      },
      // Fitness First locations
      {
        id: 'ff-sydney-cbd',
        name: 'Fitness First Sydney CBD',
        brandId: 'fitness-first',
        address: '321 George Street, Sydney, Australia',
        memberCount: 4200,
        services: ['fitness', 'classes', 'personal_training', 'swimming'],
        timezone: 'Australia/Sydney'
      },
      {
        id: 'ff-melbourne',
        name: 'Fitness First Melbourne',
        brandId: 'fitness-first',
        address: '654 Collins Street, Melbourne, Australia',
        memberCount: 3800,
        services: ['fitness', 'classes', 'personal_training'],
        timezone: 'Australia/Melbourne'
      },
      // Wellness Co locations
      {
        id: 'wel-singapore-central',
        name: 'Wellness Co Singapore Central',
        brandId: 'wellness-co',
        address: '987 Orchard Road, Singapore',
        memberCount: 2500,
        services: ['fitness', 'wellness', 'spa'],
        timezone: 'Asia/Singapore'
      }
    ]

    // Sample Customers
    const customers = [
      {
        id: 'customer-001',
        name: 'John Smith',
        email: 'john.smith@example.com',
        brandId: 'hapana-main',
        locationId: 'hapana-auckland-central',
        tier: 'premium',
        membershipType: 'annual'
      },
      {
        id: 'customer-002',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        brandId: 'hapana-main',
        locationId: 'hapana-wellington',
        tier: 'standard',
        membershipType: 'monthly'
      },
      {
        id: 'customer-003',
        name: 'Mike Chen',
        email: 'mike.chen@example.com',
        brandId: 'fitness-first',
        locationId: 'ff-sydney-cbd',
        tier: 'enterprise',
        membershipType: 'corporate'
      },
      {
        id: 'customer-004',
        name: 'Emily Davis',
        email: 'emily.davis@example.com',
        brandId: 'wellness-co',
        locationId: 'wel-singapore-central',
        tier: 'premium',
        membershipType: 'annual'
      }
    ]

    // Sample Incident Report Templates
    const templates = [
      {
        id: 'default-template',
        name: 'Default Incident Report Template',
        brandId: null, // Default template
        sections: {
          title: 'Incident Report Title',
          summary: 'Executive Summary',
          impactAssessment: 'Impact Assessment',
          timeline: 'Timeline of Events',
          rootCause: 'Root Cause Analysis',
          resolution: 'Resolution Steps',
          preventiveMeasures: 'Preventive Measures',
          communicationPlan: 'Communication Plan'
        },
        prompts: {
          title: 'Generate a clear, concise incident title that describes: {{ISSUE_TITLE}}',
          summary: 'Write a brief executive summary of the incident. Include what happened, when it started, how many members were affected ({{AFFECTED_MEMBERS}}), and current status.',
          impactAssessment: 'Provide detailed impact assessment: Total affected members: {{AFFECTED_MEMBERS}}, Affected locations: {{AFFECTED_LOCATIONS}}, Impact level: {{IMPACT_LEVEL}}',
          timeline: 'Create chronological timeline based on: {{TIMELINE}}',
          rootCause: 'Analyze root cause of: {{ISSUE_DESCRIPTION}}',
          resolution: 'Describe resolution steps taken or planned',
          preventiveMeasures: 'Recommend specific preventive measures',
          communicationPlan: 'Outline communication plan for stakeholders'
        },
        created: new Date(),
        updated: new Date()
      },
      {
        id: 'hapana-template',
        name: 'Hapana Incident Report Template',
        brandId: 'hapana-main',
        sections: {
          title: 'Hapana Incident Report',
          summary: 'Executive Summary',
          impactAssessment: 'Member Impact Assessment',
          timeline: 'Timeline of Events',
          rootCause: 'Root Cause Analysis',
          resolution: 'Resolution Actions',
          preventiveMeasures: 'Prevention Strategy',
          communicationPlan: 'Member Communication Plan'
        },
        prompts: {
          title: 'Generate a professional incident title for Hapana members regarding: {{ISSUE_TITLE}}',
          summary: 'Write an executive summary for Hapana leadership. Focus on member experience impact.',
          impactAssessment: 'Detail the impact on Hapana members across {{AFFECTED_LOCATIONS}} locations with {{AFFECTED_MEMBERS}} affected members.',
          timeline: 'Create a detailed timeline suitable for Hapana operations team',
          rootCause: 'Provide technical root cause analysis for Hapana engineering team',
          resolution: 'Outline resolution steps following Hapana incident response procedures',
          preventiveMeasures: 'Recommend preventive measures aligned with Hapana quality standards',
          communicationPlan: 'Detail member communication strategy following Hapana communication guidelines'
        },
        created: new Date(),
        updated: new Date()
      }
    ]

    // Create brands
    console.log('Creating brands...')
    for (const brand of brands) {
      await db.collection('brands').doc(brand.id).set(brand)
      console.log(`✓ Created brand: ${brand.name}`)
    }

    // Create locations
    console.log('Creating locations...')
    for (const location of locations) {
      await db.collection('locations').doc(location.id).set(location)
      console.log(`✓ Created location: ${location.name}`)
    }

    // Create customers
    console.log('Creating customers...')
    for (const customer of customers) {
      await db.collection('customers').doc(customer.id).set(customer)
      console.log(`✓ Created customer: ${customer.name}`)
    }

    // Create incident report templates
    console.log('Creating incident report templates...')
    for (const template of templates) {
      await db.collection('incident-report-templates').doc(template.id).set(template)
      console.log(`✓ Created template: ${template.name}`)
    }

    // Create system config
    console.log('Creating system configuration...')
    const systemConfig = {
      ml: {
        embeddingModel: 'text-embedding-ada-002',
        classificationModel: 'gpt-4',
        similarityThreshold: 0.8,
        confidenceThreshold: 0.7,
        maxSimilarIssues: 10
      },
      escalation: {
        timeWindows: {
          urgent: 15,    // minutes
          high: 60,
          medium: 240,
          low: 1440
        },
        businessHours: {
          'Pacific/Auckland': {
            start: '09:00',
            end: '17:00',
            days: [1, 2, 3, 4, 5] // Monday to Friday
          },
          'Australia/Sydney': {
            start: '09:00',
            end: '17:00',
            days: [1, 2, 3, 4, 5]
          },
          'Asia/Singapore': {
            start: '09:00',
            end: '17:00',
            days: [1, 2, 3, 4, 5]
          }
        }
      },
      notifications: {
        batchSize: 50,
        retryAttempts: 3,
        rateLimits: {
          email: 100,     // per hour
          slack: 200,
          sms: 50
        }
      },
      sync: {
        happyFoxPollInterval: 30,  // minutes
        jiraPollInterval: 15,
        maxRetries: 3
      },
      incidentReporting: {
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4',
        autoGenerateThreshold: 10, // affected member count
        templates: {
          default: 'default-template',
          'hapana-main': 'hapana-template'
        }
      }
    }

    await db.collection('system-config').doc('main').set(systemConfig)
    console.log('✓ Created system configuration')

    console.log('\n🎉 Sample data setup completed successfully!')
    console.log('\nCreated:')
    console.log(`- ${brands.length} brands`)
    console.log(`- ${locations.length} locations`)
    console.log(`- ${customers.length} customers`)
    console.log(`- ${templates.length} incident report templates`)
    console.log('- 1 system configuration')

  } catch (error) {
    console.error('❌ Error setting up sample data:', error)
    process.exit(1)
  }
}

// Run the setup
setupSampleData()
  .then(() => {
    console.log('Setup completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Setup failed:', error)
    process.exit(1)
  }) 