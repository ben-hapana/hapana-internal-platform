import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin SDK
function createFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!
  }

  // Check if we have all required environment variables
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  // If we have service account credentials, use them
  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      projectId,
    })
  }

  // Fallback for development/build time with minimal config
  if (projectId) {
    return initializeApp({
      projectId,
    })
  }

  // Last resort fallback to prevent build errors
  return initializeApp({
    projectId: 'dummy-project-id',
  })
}

export const adminApp = createFirebaseAdminApp()
export const adminDb = getFirestore(adminApp) 