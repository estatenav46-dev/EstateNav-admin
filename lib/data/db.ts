import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;

export function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;

  if (!getApps().length) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (privateKey) {
      privateKey = privateKey.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    }

    if (projectId && clientEmail && privateKey) {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      adminApp = initializeApp();
    }
  } else {
    adminApp = getApps()[0];
  }

  firestoreDb = getFirestore(adminApp);
  // REST instead of gRPC: much faster cold starts on serverless and in dev (no realtime
  // listeners are used, so nothing is lost).
  try {
    firestoreDb.settings({ preferRest: true });
  } catch {
    /* settings were already applied by another import of this module */
  }
  return firestoreDb;
}

