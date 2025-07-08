# Cloud Run Deployment Setup

This document explains how to set up automated deployment to Google Cloud Run using GitHub Actions.

## Prerequisites

1. **Google Cloud Project**
   - Active GCP project with billing enabled
   - Cloud Run API enabled
   - Container Registry API enabled

2. **Service Account**
   - Create a service account with the following roles:
     - Cloud Run Admin
     - Storage Admin
     - Container Registry Service Agent
     - Service Account User

3. **GitHub Repository**
   - Repository with admin access
   - Ability to set repository secrets

## Setup Instructions

### 1. Create Google Cloud Service Account

```bash
# Set your project ID
export PROJECT_ID="hapana-internal-platform"

# Create service account
gcloud iam service-accounts create github-actions \
    --description="Service account for GitHub Actions" \
    --display-name="GitHub Actions"

# Get the service account email
export SA_EMAIL="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/containerregistry.ServiceAgent"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser"

# Create and download service account key
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=$SA_EMAIL
```

### 2. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

#### Google Cloud Platform
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_SA_KEY`: Contents of the `github-actions-key.json` file

#### Firebase Configuration
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `FIREBASE_CLIENT_EMAIL`: Service account email
- `FIREBASE_PRIVATE_KEY`: Private key from Firebase service account
- `NEXT_PUBLIC_FIREBASE_API_KEY`: Firebase web API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Firebase project ID (public)
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID`: Firebase app ID

### 3. Enable Required APIs

```bash
# Enable required Google Cloud APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 4. Local Development Environment

Create a `.env.local` file for local development:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Public Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc123
```

## Deployment Process

### Automated Deployment

1. **Push to main branch** triggers the deployment workflow
2. **Build Docker image** with optimized Next.js standalone output
3. **Push to Container Registry** with SHA and latest tags
4. **Deploy to Cloud Run** with production configuration
5. **Health check** verifies deployment success

### Manual Deployment

```bash
# Build and deploy manually
docker build -t gcr.io/YOUR_PROJECT_ID/hapana-internal-platform .
docker push gcr.io/YOUR_PROJECT_ID/hapana-internal-platform

gcloud run deploy hapana-internal-platform \
  --image gcr.io/YOUR_PROJECT_ID/hapana-internal-platform \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Configuration Details

### Docker Configuration
- **Base Image**: Node.js 18 Alpine
- **Build Strategy**: Multi-stage build for optimization
- **Output**: Next.js standalone for minimal runtime
- **Security**: Non-root user execution
- **Port**: 3000 (configurable via PORT env var)

### Cloud Run Configuration
- **Memory**: 1 GiB
- **CPU**: 1 vCPU
- **Timeout**: 300 seconds
- **Concurrency**: 80 requests per instance
- **Scaling**: 0-10 instances (auto-scaling)
- **Authentication**: Allow unauthenticated requests

### Environment Variables
- Production environment variables are set via GitHub secrets
- Development variables should be in `.env.local`
- Never commit sensitive data to the repository

## Monitoring and Troubleshooting

### Viewing Logs
```bash
# View Cloud Run logs
gcloud logs read --service=hapana-internal-platform --limit=50

# Follow real-time logs
gcloud logs tail --service=hapana-internal-platform
```

### Health Check
The application includes a health check endpoint at `/api/health`

### Common Issues
1. **Build failures**: Check Dockerfile and dependencies
2. **Deployment failures**: Verify service account permissions
3. **Runtime errors**: Check environment variables and logs

## Security Considerations

1. **Service Account**: Minimal required permissions only
2. **Secrets**: All sensitive data in GitHub secrets
3. **Network**: Cloud Run service allows unauthenticated requests
4. **Headers**: Security headers configured in Next.js
5. **Dependencies**: Regular updates for security patches

## Cost Optimization

- **Cold starts**: Minimized with optimized Docker image
- **Auto-scaling**: Scales to zero when not in use
- **Resource limits**: Configured for optimal cost/performance
- **Build caching**: Docker layer caching for faster builds

## Next Steps

1. Set up monitoring and alerting
2. Configure custom domain
3. Add SSL certificate
4. Set up staging environment
5. Implement blue-green deployments 