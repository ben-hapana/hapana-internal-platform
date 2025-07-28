import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

let _adminApp: App | null = null
let _adminDb: Firestore | null = null

// Initialize Firebase Admin SDK lazily
function createFirebaseAdminApp(): App {
  if (_adminApp) {
    return _adminApp
  }

  if (getApps().length > 0) {
    _adminApp = getApps()[0]!
    return _adminApp
  }

  // Check if we have all required environment variables
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  // If we have service account credentials, use them
  if (projectId && clientEmail && privateKey) {
    _adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      projectId,
    })
    return _adminApp
  }

  // Fallback for development/build time with minimal config
  if (projectId) {
    _adminApp = initializeApp({
      projectId,
    })
    return _adminApp
  }

  // Last resort fallback to prevent build errors
  _adminApp = initializeApp({
    projectId: 'dummy-project-id',
  })
  return _adminApp
}

// Lazy initialization functions that only initialize when called
export function getAdminApp(): App {
  return createFirebaseAdminApp()
}

export function getAdminDb(): Firestore {
  if (!_adminDb) {
    _adminDb = getFirestore(getAdminApp())
  }
  return _adminDb
} 