#!/bin/bash

# Finance Operations Cloud Run Deployment Script

set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-"your-project-id"}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}
SERVICE_NAME="finance-operations-processor"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying Finance Operations to Cloud Run..."
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"

# Build and push the container image
echo "📦 Building container image..."
docker build -t ${IMAGE_NAME} .

echo "📤 Pushing image to Container Registry..."
docker push ${IMAGE_NAME}

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "STORAGE_BUCKET=${PROJECT_ID}.appspot.com" \
  --set-env-vars "WEBHOOK_SECRET=${CLOUD_RUN_WEBHOOK_SECRET}" \
  --set-env-vars "STRIPE_API_KEY=${STRIPE_API_KEY}" \
  --project ${PROJECT_ID}

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format "value(status.url)")

echo "✅ Deployment completed!"
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Next steps:"
echo "1. Update your .env file with: CLOUD_RUN_FINANCE_OPERATIONS_URL=${SERVICE_URL}/process"
echo "2. Test the service: curl ${SERVICE_URL}/health"
echo "3. Set up your finance operations in Firestore" 