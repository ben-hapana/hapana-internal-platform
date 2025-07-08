# 🏗️ Finance Operations Setup Guide

This guide will help you set up the complete Finance Operations system with CSV upload, Cloud Run processing, and webhook notifications.

## 📋 Prerequisites

- Google Cloud Project with billing enabled
- Firebase project configured
- Docker installed locally
- Google Cloud SDK (gcloud) installed and authenticated
- Node.js and npm installed

## 🔧 Step 1: Environment Configuration

1. **Copy environment variables:**
   ```bash
   cp env.example .env.local
   ```

2. **Configure Firebase variables:**
   ```bash
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   # ... other Firebase vars
   ```

3. **Configure Google Cloud variables:**
   ```bash
   GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
   GOOGLE_CLOUD_REGION=us-central1
   ```

4. **Configure Finance Operations:**
   ```bash
   STRIPE_API_KEY=your_stripe_api_key
   CLOUD_RUN_WEBHOOK_SECRET=your_secure_webhook_secret
   ```

## 🚀 Step 2: Deploy Cloud Run Service

1. **Navigate to Cloud Run directory:**
   ```bash
   cd cloud-run/finance-operations
   ```

2. **Set up Google Cloud authentication:**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud auth configure-docker
   ```

3. **Deploy the service:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **Note the service URL** from the deployment output and update your `.env.local`:
   ```bash
   CLOUD_RUN_FINANCE_OPERATIONS_URL=https://your-service-url/process
   ```

## 💾 Step 3: Initialize Database

1. **Install dependencies:**
   ```bash
   cd ../../  # Back to project root
   npm install
   ```

2. **Set up Firebase operations:**
   ```bash
   node scripts/setup-finance-operations.js
   ```

## 🔐 Step 4: Configure Firebase Security

1. **Update Firestore rules** to allow finance operations:
   ```javascript
   // Add to firestore.rules
   match /finance_operations/{document} {
     allow read: if request.auth != null;
   }
   match /operation_executions/{document} {
     allow read, write: if request.auth != null 
       && resource.data.executedBy == request.auth.uid;
   }
   match /file_references/{document} {
     allow read, write: if request.auth != null 
       && resource.data.uploadedBy == request.auth.uid;
   }
   ```

2. **Update Storage rules** for file uploads:
   ```javascript
   // Add to storage.rules
   match /finance-operations/{userId}/{allPaths=**} {
     allow read, write: if request.auth != null 
       && request.auth.uid == userId;
   }
   ```

## 🧪 Step 5: Test the System

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Finance Operations:**
   - Open http://localhost:3000/finance-operations
   - Log in with your Firebase account

3. **Test CSV upload:**
   - Create a test CSV file:
     ```csv
     currency
     aed
     thb
     nok
     ```
   - Upload the file and select "Stripe Balance Payout"
   - Monitor the execution status

## 📊 Step 6: Monitor and Debug

### Cloud Run Logs
```bash
gcloud logs read --service=finance-operations-processor --limit=50
```

### Firebase Console
- Check Firestore collections: `finance_operations`, `operation_executions`, `file_references`
- Monitor Storage uploads in the `finance-operations/` folder

### Application Logs
- Check browser console for frontend errors
- Check Next.js server logs for API issues

## 🔧 Troubleshooting

### Common Issues

**1. Cloud Run deployment fails:**
- Verify Docker is running
- Check Google Cloud authentication: `gcloud auth list`
- Ensure billing is enabled on your project

**2. File upload fails:**
- Check Firebase Storage configuration
- Verify Storage rules allow uploads
- Check file size limits (10MB max)

**3. Webhook notifications not received:**
- Verify `CLOUD_RUN_WEBHOOK_SECRET` matches in both environments
- Check Cloud Run service has internet access
- Monitor webhook endpoint logs

**4. Script execution fails:**
- Verify Stripe API key is valid
- Check Cloud Run environment variables
- Review script logs in Cloud Run console

### Debug Commands

```bash
# Test Cloud Run health
curl https://your-service-url/health

# Check Firestore data
firebase firestore:get finance_operations

# Test file upload API
curl -X POST http://localhost:3000/api/finance-operations/upload \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -F "file=@test.csv" \
  -F "operationId=stripe-balance-payout"
```

## 🎯 Next Steps

1. **Add more operations:**
   - Create new Python scripts in `cloud-run/finance-operations/scripts/`
   - Add operation records to Firestore
   - Update the UI to show new operations

2. **Enhance security:**
   - Implement operation approval workflows
   - Add role-based access control
   - Enable audit logging

3. **Scale for production:**
   - Set up monitoring and alerting
   - Configure backup and disaster recovery
   - Implement CI/CD pipelines

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs in Cloud Run console
3. Verify all environment variables are set correctly
4. Test each component individually

The system is designed to be modular, so you can test and debug each part separately:
- Frontend UI (Next.js)
- API endpoints (Next.js API routes)
- File storage (Firebase Storage)
- Database (Firestore)
- Processing service (Cloud Run)

---

**🎉 Congratulations!** You now have a fully functional Finance Operations platform with CSV upload, Cloud Run processing, and real-time status tracking. 