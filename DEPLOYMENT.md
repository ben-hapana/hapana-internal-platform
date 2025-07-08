# Issue Intelligence System - Deployment Guide

## 🚀 Overview

This guide covers deploying the AI-powered Issue Intelligence system for the Hapana Central. The system automatically detects when multiple support tickets represent the same issue and generates intelligent incident reports.

## 📋 Prerequisites

### Required Services
- **Firebase/Firestore** - Data storage and real-time updates
- **Google Cloud Platform** - Vertex AI for similarity detection
- **OpenAI API** - GPT-4 for incident report generation
- **HappyFox** - Customer support ticket system
- **Jira** - Development issue tracking

### Required Accounts
1. Firebase project with Firestore enabled
2. Google Cloud project with Vertex AI API enabled
3. OpenAI API account with GPT-4 access
4. HappyFox admin access for webhook configuration
5. Jira admin access for webhook configuration

## 🔧 Environment Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd hapana-internal-platform
npm install
```

### 2. Environment Variables
Copy `env.example` to `.env.local` and configure:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# AI/ML Services
OPENAI_API_KEY=sk-...
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Webhook Security
HAPPYFOX_WEBHOOK_SECRET=your_secure_secret
JIRA_WEBHOOK_TOKEN=your_secure_token

# External APIs
HAPPYFOX_API_KEY=your_happyfox_api_key
HAPPYFOX_API_BASE_URL=https://yourdomain.happyfox.com/api/1.1
JIRA_API_TOKEN=your_jira_api_token
JIRA_API_BASE_URL=https://yourdomain.atlassian.net
JIRA_API_EMAIL=your_jira_email
```

### 3. Firebase Setup
1. Create Firebase project
2. Enable Firestore database
3. Create service account and download JSON key
4. Set up authentication (Google provider)
5. Configure security rules

### 4. Google Cloud Setup
1. Enable Vertex AI API
2. Create service account with Vertex AI permissions
3. Download service account JSON key
4. Set `GOOGLE_APPLICATION_CREDENTIALS` path

### 5. Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Issues collection
    match /issues/{issueId} {
      allow read, write: if request.auth != null;
    }
    
    // HappyFox tickets
    match /happyfox-tickets/{ticketId} {
      allow read, write: if request.auth != null;
    }
    
    // Jira tickets
    match /jira-tickets/{ticketKey} {
      allow read, write: if request.auth != null;
    }
    
    // Incident reports
    match /incident-reports/{reportId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🔗 Webhook Configuration

### HappyFox Webhooks
1. Go to HappyFox Admin → Automations → Webhooks
2. Create new webhook:
   - **URL**: `https://yourdomain.com/api/webhooks/happyfox`
   - **Events**: `ticket_created`, `ticket_updated`, `ticket_closed`
   - **Secret**: Use the value from `HAPPYFOX_WEBHOOK_SECRET`
   - **Content Type**: `application/json`

### Jira Webhooks
1. Go to Jira Settings → System → Webhooks
2. Create new webhook:
   - **URL**: `https://yourdomain.com/api/webhooks/jira`
   - **Events**: `Issue created`, `Issue updated`, `Issue deleted`
   - **JQL Filter**: `project = YOUR_PROJECT`
   - **Authentication**: Bearer token (use `JIRA_WEBHOOK_TOKEN`)

## 🚀 Deployment Options

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

### Option 2: Docker
```dockerfile
# Dockerfile already exists in project
docker build -t hapana-platform .
docker run -p 3000:3000 --env-file .env.local hapana-platform
```

### Option 3: Traditional Hosting
```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🧪 Testing the System

### 1. Access Test Interface
Navigate to `/test-intelligence` in your deployed app

### 2. Run Tests
1. **Create Sample Data** - Generate test issues
2. **Test AI Similarity** - Validate semantic detection
3. **Generate Reports** - Test OpenAI integration

### 3. Verify Webhooks
Use tools like ngrok for local testing:
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use ngrok URL for webhook endpoints
```

## 📊 Monitoring & Maintenance

### Key Metrics to Monitor
- **Webhook Processing Time** - Should be < 5 seconds
- **AI Similarity Accuracy** - Target > 90%
- **Issue Detection Rate** - Track duplicate reduction
- **API Rate Limits** - Monitor OpenAI and Vertex AI usage

### Logs to Check
- Webhook processing logs
- AI/ML service errors
- Firestore connection issues
- Authentication failures

### Regular Maintenance
- Monitor API usage and costs
- Update AI model parameters based on accuracy
- Review and update webhook configurations
- Backup Firestore data regularly

## 🔒 Security Considerations

### Webhook Security
- Always validate webhook signatures
- Use HTTPS for all webhook endpoints
- Rotate webhook secrets regularly
- Implement rate limiting

### API Security
- Store API keys securely (environment variables)
- Use least-privilege service accounts
- Monitor API usage for anomalies
- Implement proper error handling

### Data Privacy
- Encrypt sensitive data in Firestore
- Implement proper access controls
- Regular security audits
- GDPR/privacy compliance

## 🆘 Troubleshooting

### Common Issues

**Webhook not receiving data:**
- Check webhook URL and SSL certificate
- Verify webhook secret configuration
- Check firewall and network settings

**AI similarity not working:**
- Verify Google Cloud credentials
- Check Vertex AI API quotas
- Ensure proper service account permissions

**Incident reports failing:**
- Check OpenAI API key and credits
- Verify model availability (GPT-4)
- Check rate limits and usage

**Firestore connection issues:**
- Verify Firebase configuration
- Check service account permissions
- Review Firestore security rules

## 📞 Support

For deployment issues:
1. Check logs in Vercel/hosting platform
2. Verify all environment variables
3. Test webhook endpoints manually
4. Review Firebase and GCP console for errors

## 🎯 Success Criteria

The system is successfully deployed when:
- ✅ Webhooks are receiving and processing tickets
- ✅ AI similarity detection is identifying related issues
- ✅ Incident reports are being generated automatically
- ✅ Real-time UI updates are working
- ✅ All tests in `/test-intelligence` pass

---

🎉 **Congratulations!** Your Issue Intelligence system is now deployed and ready to automatically detect and manage issues across your support ecosystem. 