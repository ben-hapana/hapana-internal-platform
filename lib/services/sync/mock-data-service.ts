import { BrandReference, LocationReference, CustomerReference } from '@/lib/types/issue-intelligence'

export class MockDataService {
  
  // Mock brands
  private mockBrands: BrandReference[] = [
    { id: 'hapana', name: 'Hapana Fitness', code: 'HAP', region: 'North America', memberCount: 2500 },
    { id: 'fitplus', name: 'FitPlus Wellness', code: 'FIT', region: 'Europe', memberCount: 1800 },
    { id: 'wellness', name: 'Wellness Centers', code: 'WEL', region: 'Asia Pacific', memberCount: 3200 }
  ]

  // Mock locations
  private mockLocations: LocationReference[] = [
    { id: 'gym-001', name: 'Downtown Hapana', brandId: 'hapana', address: '123 Main St', memberCount: 450, services: ['gym', 'pool', 'classes'], timezone: 'America/New_York' },
    { id: 'gym-002', name: 'Uptown Hapana', brandId: 'hapana', address: '456 Oak Ave', memberCount: 380, services: ['gym', 'spa'], timezone: 'America/New_York' },
    { id: 'fit-001', name: 'Central FitPlus', brandId: 'fitplus', address: '789 High St', memberCount: 320, services: ['gym', 'nutrition'], timezone: 'Europe/London' },
    { id: 'wel-001', name: 'Tokyo Wellness', brandId: 'wellness', address: '321 Cherry Blvd', memberCount: 600, services: ['spa', 'meditation'], timezone: 'Asia/Tokyo' }
  ]

  // Mock customers
  private mockCustomers: CustomerReference[] = [
    { id: 'cust-001', name: 'John Smith', email: 'john.smith@email.com', brandId: 'hapana', locationId: 'gym-001', tier: 'premium', membershipType: 'annual' },
    { id: 'cust-002', name: 'Sarah Johnson', email: 'sarah.j@email.com', brandId: 'hapana', locationId: 'gym-002', tier: 'standard', membershipType: 'monthly' },
    { id: 'cust-003', name: 'Mike Chen', email: 'mike.chen@email.com', brandId: 'fitplus', locationId: 'fit-001', tier: 'enterprise', membershipType: 'corporate' },
    { id: 'cust-004', name: 'Emma Wilson', email: 'emma.w@email.com', brandId: 'wellness', locationId: 'wel-001', tier: 'premium', membershipType: 'quarterly' }
  ]

  generateMockHappyFoxTickets(count: number = 50): unknown[] {
    const tickets = []
    const statuses = ['Open', 'Pending', 'Resolved', 'Closed']
    const priorities = ['Low', 'Medium', 'High', 'Urgent']
    const categories = ['Technical Support', 'Billing', 'Equipment', 'Membership', 'Facilities']
    
    const issueTemplates = [
      { subject: 'Login Issues with Mobile App', text: 'Unable to login to mobile application after recent update. Getting error message.' },
      { subject: 'Payment Processing Failed', text: 'Monthly membership payment failed to process. Card was charged but membership not renewed.' },
      { subject: 'Equipment Out of Order', text: 'Treadmill #5 is making loud noises and belt is slipping. Needs immediate attention.' },
      { subject: 'Pool Temperature Too Cold', text: 'Pool water temperature seems much colder than usual. Multiple members complaining.' },
      { subject: 'Class Schedule Confusion', text: 'Yoga class times changed but not updated on website. Caused confusion for members.' },
      { subject: 'Locker Room Maintenance', text: 'Several lockers not working properly. Some won\'t lock, others won\'t open.' },
      { subject: 'WiFi Connection Problems', text: 'Internet connection very slow in main workout area. Affecting streaming services.' },
      { subject: 'Membership Cancellation Request', text: 'Need to cancel membership due to relocation. Please process refund for unused portion.' },
      { subject: 'Personal Trainer Scheduling', text: 'Cannot book sessions with preferred trainer through online system.' },
      { subject: 'Parking Lot Issues', text: 'Parking lot lighting is out. Safety concern for evening members.' }
    ]

    for (let i = 1; i <= count; i++) {
      const template = issueTemplates[Math.floor(Math.random() * issueTemplates.length)]
      const customer = this.mockCustomers[Math.floor(Math.random() * this.mockCustomers.length)]
      const brand = this.mockBrands.find(b => b.id === customer.brandId)!
      const location = this.mockLocations.find(l => l.id === customer.locationId)!
      
      const createdDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Last 30 days
      const updatedDate = new Date(createdDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) // Up to 7 days later

      tickets.push({
        id: 1000 + i,
        subject: template.subject,
        text: template.text,
        status: {
          id: Math.floor(Math.random() * 4) + 1,
          name: statuses[Math.floor(Math.random() * statuses.length)]
        },
        priority: {
          id: Math.floor(Math.random() * 4) + 1,
          name: priorities[Math.floor(Math.random() * priorities.length)]
        },
        category: {
          id: Math.floor(Math.random() * 5) + 1,
          name: categories[Math.floor(Math.random() * categories.length)]
        },
        user: {
          id: parseInt(customer.id.split('-')[1]),
          name: customer.name,
          email: customer.email
        },
        assignee: Math.random() > 0.3 ? {
          id: Math.floor(Math.random() * 10) + 100,
          name: `Agent ${Math.floor(Math.random() * 10) + 1}`,
          email: `agent${Math.floor(Math.random() * 10) + 1}@company.com`
        } : undefined,
        custom_fields: {
          brand: brand.code,
          location: location.name,
          member_tier: customer.tier
        },
        created_at: createdDate.toISOString(),
        updated_at: updatedDate.toISOString(),
        tags: this.generateRandomTags()
      })
    }

    return tickets
  }

  generateMockJiraTickets(count: number = 30): unknown[] {
    const tickets = []
    const statuses = ['To Do', 'In Progress', 'Done', 'Blocked']
    const priorities = ['Low', 'Medium', 'High', 'Highest']
    const issueTypes = ['Bug', 'Task', 'Story', 'Epic']
    const projects = [
      { key: 'HAP', name: 'Hapana Central' },
      { key: 'FIT', name: 'FitPlus Systems' },
      { key: 'WEL', name: 'Wellness Tech' },
      { key: 'CORE', name: 'Core Infrastructure' }
    ]

    const taskTemplates = [
      { summary: 'Fix mobile app login authentication', description: 'Users reporting login failures after latest app update. Need to investigate OAuth flow.' },
      { summary: 'Implement payment retry mechanism', description: 'Add automatic retry for failed payment processing to reduce billing issues.' },
      { summary: 'Update equipment maintenance tracking', description: 'Enhance system to better track equipment status and maintenance schedules.' },
      { summary: 'Pool temperature monitoring system', description: 'Implement automated monitoring and alerts for pool temperature variations.' },
      { summary: 'Class schedule synchronization', description: 'Sync class schedules across all platforms to prevent booking conflicts.' },
      { summary: 'Locker management system upgrade', description: 'Upgrade digital locker system to prevent malfunctions and improve reliability.' },
      { summary: 'WiFi infrastructure improvements', description: 'Upgrade network infrastructure to support increased bandwidth demands.' },
      { summary: 'Membership portal enhancements', description: 'Add self-service cancellation and modification features to member portal.' },
      { summary: 'Personal trainer booking system', description: 'Improve trainer scheduling system with better availability management.' },
      { summary: 'Facility security monitoring', description: 'Implement comprehensive security monitoring including parking areas.' }
    ]

    for (let i = 1; i <= count; i++) {
      const template = taskTemplates[Math.floor(Math.random() * taskTemplates.length)]
      const project = projects[Math.floor(Math.random() * projects.length)]
      
      const createdDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000) // Last 60 days
      const updatedDate = new Date(createdDate.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000) // Up to 14 days later

      tickets.push({
        id: `${10000 + i}`,
        key: `${project.key}-${100 + i}`,
        fields: {
          summary: template.summary,
          description: template.description,
          status: {
            name: statuses[Math.floor(Math.random() * statuses.length)]
          },
          priority: {
            name: priorities[Math.floor(Math.random() * priorities.length)]
          },
          assignee: Math.random() > 0.2 ? {
            displayName: `Developer ${Math.floor(Math.random() * 8) + 1}`,
            emailAddress: `dev${Math.floor(Math.random() * 8) + 1}@company.com`
          } : null,
          reporter: {
            displayName: `Product Manager ${Math.floor(Math.random() * 3) + 1}`,
            emailAddress: `pm${Math.floor(Math.random() * 3) + 1}@company.com`
          },
          project: project,
          labels: this.generateRandomLabels(),
          issuetype: {
            name: issueTypes[Math.floor(Math.random() * issueTypes.length)]
          },
          resolution: Math.random() > 0.6 ? {
            name: 'Fixed'
          } : null,
          created: createdDate.toISOString(),
          updated: updatedDate.toISOString()
        }
      })
    }

    return tickets
  }

  private generateRandomTags(): string[] {
    const allTags = ['urgent', 'billing', 'technical', 'equipment', 'mobile', 'web', 'payment', 'membership', 'facilities', 'wifi', 'pool', 'locker', 'class', 'trainer']
    const numTags = Math.floor(Math.random() * 4) + 1
    const selectedTags: string[] = []
    
    for (let i = 0; i < numTags; i++) {
      const tag = allTags[Math.floor(Math.random() * allTags.length)]
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag)
      }
    }
    
    return selectedTags
  }

  private generateRandomLabels(): string[] {
    const allLabels = ['frontend', 'backend', 'mobile', 'api', 'database', 'security', 'performance', 'ui', 'integration', 'monitoring']
    const numLabels = Math.floor(Math.random() * 3) + 1
    const selectedLabels: string[] = []
    
    for (let i = 0; i < numLabels; i++) {
      const label = allLabels[Math.floor(Math.random() * allLabels.length)]
      if (!selectedLabels.includes(label)) {
        selectedLabels.push(label)
      }
    }
    
    return selectedLabels
  }

  getBrands(): BrandReference[] {
    return this.mockBrands
  }

  getLocations(): LocationReference[] {
    return this.mockLocations
  }

  getCustomers(): CustomerReference[] {
    return this.mockCustomers
  }
}

export const mockDataService = new MockDataService() 