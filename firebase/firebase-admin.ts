import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const firebaseAdminConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

// Initialize Firebase Admin SDK
function createFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!
  }

  // In development, we can use a more permissive approach
  // In production, you would use a service account key
  if (process.env.NODE_ENV === 'development') {
    // For development, we'll use the emulator or configure less strict rules
    return initializeApp(firebaseAdminConfig)
  }

  // For production, you would use:
  // return initializeApp({
  //   credential: cert({
  //     projectId: process.env.FIREBASE_PROJECT_ID,
  //     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  //     privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  //   }),
  //   projectId: process.env.FIREBASE_PROJECT_ID,
  // })

  return initializeApp(firebaseAdminConfig)
}

export const adminApp = createFirebaseAdminApp()
export const adminDb = getFirestore(adminApp) 