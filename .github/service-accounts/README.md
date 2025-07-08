# Service Accounts

This folder contains service account keys and credentials for the Hapana Internal Platform.

## 🔒 Security Notice

**IMPORTANT:** All files in this directory are automatically ignored by Git for security reasons.

## 📁 File Structure

```
.github/service-accounts/
├── README.md (this file)
├── hapana-internal-platform-firebase-adminsdk-fbsvc-*.json  # Firebase Admin SDK
└── gcp-service-account-*.json                               # Google Cloud Platform (if different)
```

## 🔧 Setup Instructions

### Firebase Service Account
1. Download from [Firebase Console](https://console.firebase.google.com)
2. Go to Project Settings → Service Accounts
3. Generate new private key
4. Save as `hapana-internal-platform-firebase-adminsdk-*.json`

### Google Cloud Service Account (if needed separately)
1. Download from [Google Cloud Console](https://console.cloud.google.com)
2. Go to IAM & Admin → Service Accounts
3. Create key for Vertex AI service account
4. Save as `gcp-service-account-*.json`

## 🌍 Environment Variables

Update your `.env.local` file:

```bash
# Firebase Admin
GOOGLE_APPLICATION_CREDENTIALS=./.github/service-accounts/hapana-internal-platform-firebase-adminsdk-fbsvc-*.json

# Or if using separate GCP account:
GOOGLE_APPLICATION_CREDENTIALS=./.github/service-accounts/gcp-service-account-*.json
```

## 🚨 Security Best Practices

1. **Never commit these files to Git** - They're automatically ignored
2. **Rotate keys regularly** - At least every 90 days
3. **Use least-privilege access** - Only grant necessary permissions
4. **Monitor usage** - Check Google Cloud Console for unusual activity
5. **Secure local storage** - Encrypt your development machine

## 🔄 Key Rotation

When rotating service account keys:

1. Generate new key in console
2. Update the file in this directory
3. Update environment variables
4. Test the application
5. Delete old key from console
6. Remove old file from local machine

---

⚠️ **Remember:** These credentials provide admin access to your Firebase/GCP resources. Handle with extreme care! 