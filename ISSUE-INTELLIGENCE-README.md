# Issue Intelligence System - Implementation

This document provides setup and testing instructions for the Issue Intelligence system that automatically detects when HappyFox tickets from multiple brands/locations represent the same issue.

## 🚀 Quick Start

### 1. Setup Sample Data

First, set up the sample brands, locations, customers, and templates:

```bash
npm run setup-sample-data
```

This creates:
- 3 sample brands (Hapana, Fitness First, Wellness Co)
- 6 sample locations across different regions
- 4 sample customers
- 2 incident report templates
- System configuration

### 2. Check System Status

Verify the system is working:

```bash
curl http://localhost:3001/api/issue-intelligence/status
```

This endpoint shows:
- Service health status
- Data collection counts
- Available features
- Configuration details

### 3. Test Webhook Processing

Simulate HappyFox webhook events:

```bash
# Single app login issue
curl -X POST http://localhost:3001/api/test/webhook-simulation \
  -H "Content-Type: application/json" \
  -d '{"scenario": "app_login_issue", "count": 1}'

# Multiple similar issues to test deduplication
curl -X POST http://localhost:3001/api/test/webhook-simulation \
  -H "Content-Type: application/json" \
  -d '{"scenario": "similar_app_issue", "count": 3}'
```

Available scenarios:
- `app_login_issue` - Mobile app login problems
- `class_booking_problem` - Class booking system issues
- `payment_issue` - Payment and billing problems
- `facility_access` - Key card and facility access
- `similar_app_issue` - Similar app issues for testing deduplication

## 📁 Architecture Overview

### Core Services

```
lib/services/
├── issue-intelligence/
│   ├── firestore-service.ts      # Database operations
│   └── issue-orchestration.ts    # Main issue processing logic
├── webhooks/
│   └── webhook-handler.ts        # Webhook validation & processing
├── sync/                         # Future: API sync services
├── ai-ml/                        # Future: AI/ML services
└── notifications/                # Future: Notification services
```

### API Endpoints

```
app/api/
├── webhooks/
│   ├── happyfox/route.ts         # HappyFox webhook receiver
│   └── jira/route.ts             # Jira webhook receiver
├── issue-intelligence/
│   └── status/route.ts           # System status endpoint
└── test/
    └── webhook-simulation/route.ts # Testing endpoint
```

### Data Collections

```
Firestore Collections:
├── issues                        # Core issues with impact tracking
├── brands                        # Brand information
├── locations                     # Location details with member counts
├── customers                     # Customer profiles
├── happyfox-tickets             # Synced HappyFox tickets
├── jira-tickets                 # Synced Jira tickets
├── incident-reports             # Generated incident reports
├── incident-report-templates    # Brand-specific templates
└── processing-logs              # System processing logs
```

## 🔧 Current Features

### ✅ Implemented

- **Webhook Handling**: Secure HappyFox and Jira webhook processing
- **Issue Detection**: Basic similarity detection using text analysis
- **Issue Linking**: Automatic linking of similar tickets to existing issues
- **Brand Impact Tracking**: Granular tracking of affected members per brand/location
- **Data Models**: Complete TypeScript interfaces for all entities
- **Firestore Integration**: Full CRUD operations for all collections
- **Testing Framework**: Webhook simulation for testing scenarios

### 🚧 In Progress

- **AI/ML Similarity**: Advanced similarity detection using embeddings
- **Incident Reporting**: OpenAI-powered incident report generation
- **Stakeholder Notifications**: Automated stakeholder alerts
- **Escalation Rules**: Dynamic priority escalation

### 📋 Planned

- **Real-time Sync**: Background sync with HappyFox/Jira APIs
- **Advanced Analytics**: Issue trend analysis and reporting
- **UI Components**: React components for issue management
- **Performance Optimization**: Caching and batch processing

## 🧪 Testing Scenarios

### Scenario 1: Single Issue Creation

```bash
curl -X POST http://localhost:3001/api/test/webhook-simulation \
  -H "Content-Type: application/json" \
  -d '{"scenario": "app_login_issue", "count": 1}'
```

Expected: Creates new issue with brand impact tracking

### Scenario 2: Issue Deduplication

```bash
# Create first ticket
curl -X POST http://localhost:3001/api/test/webhook-simulation \
  -H "Content-Type: application/json" \
  -d '{"scenario": "app_login_issue", "count": 1}'

# Create similar ticket (should link to existing issue)
curl -X POST http://localhost:3001/api/test/webhook-simulation \
  -H "Content-Type: application/json" \
  -d '{"scenario": "similar_app_issue", "count": 1}'
```

Expected: Second ticket links to first issue, updates impact counts

### Scenario 3: Cross-Brand Impact

```bash
# Simulate multiple tickets from different customers
curl -X POST http://localhost:3001/api/test/webhook-simulation \
  -H "Content-Type: application/json" \
  -d '{"scenario": "class_booking_problem", "count": 5}'
```

Expected: Creates issue with multiple affected members

## 🔍 Monitoring & Debugging

### Check Processing Logs

```javascript
// Query processing logs in Firestore
const logs = await db.collection('processing-logs')
  .orderBy('timestamp', 'desc')
  .limit(10)
  .get()
```

### View Created Issues

```javascript
// Query recent issues
const issues = await db.collection('issues')
  .orderBy('updated', 'desc')
  .limit(10)
  .get()
```

### Monitor Webhook Health

```bash
# Check HappyFox webhook status
curl http://localhost:3001/api/webhooks/happyfox

# Check Jira webhook status  
curl http://localhost:3001/api/webhooks/jira
```

## 🔐 Environment Variables

Required for production:

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Webhook Security
HAPPYFOX_WEBHOOK_SECRET=your-happyfox-secret
JIRA_WEBHOOK_TOKEN=your-jira-token

# AI/ML (for incident reporting)
OPENAI_API_KEY=your-openai-key
```

## 📈 Performance Metrics

The system tracks:
- Webhook processing time
- Issue similarity detection accuracy
- Deduplication success rate
- Brand impact calculation speed
- Database query performance

Check metrics via the status endpoint:
```bash
curl http://localhost:3001/api/issue-intelligence/status | jq '.dataHealth'
```

## 🐛 Troubleshooting

### Common Issues

1. **Firestore Connection Failed**
   - Check Firebase project ID and credentials
   - Verify Firestore rules allow admin access

2. **Webhook Validation Failed**
   - Verify webhook secrets are set correctly
   - Check request headers and payload format

3. **Issue Creation Failed**
   - Ensure sample data is set up
   - Check brand and location references exist

4. **Similarity Detection Not Working**
   - Currently uses basic text similarity
   - AI/ML similarity detection is planned for Phase 2

### Debug Mode

Enable detailed logging:
```bash
DEBUG=issue-intelligence npm run dev
```

## 🚀 Next Steps

1. **Run the setup script**: `npm run setup-sample-data`
2. **Test basic functionality**: Use the webhook simulation endpoint
3. **Check system status**: Monitor the status endpoint
4. **Implement Phase 2 features**: AI/ML similarity and incident reporting
5. **Add UI components**: Build React components for issue management

For detailed implementation plan, see [ISSUE-INTELLIGENCE-PLAN.md](./ISSUE-INTELLIGENCE-PLAN.md). 