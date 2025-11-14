
import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';

let adminApp: App | null = null;

try {
  if (getApps().length === 0) {
    // This is the primary method for production (Firebase App Hosting)
    // It uses the GOOGLE_APPLICATION_CREDENTIALS environment variable.
    adminApp = initializeApp({
      credential: applicationDefault(),
    });
  } else {
    adminApp = getApps()[0];
  }
} catch (e) {
  console.warn(
      "Could not initialize Firebase Admin SDK using applicationDefault(). This is normal for local development. Admin features will be disabled. Error: ", (e as Error).message
  );
  // In a local development environment where GOOGLE_APPLICATION_CREDENTIALS is not set,
  // this will fail. We set adminApp to null to indicate that the admin app is not available.
  adminApp = null;
}

export { adminApp };
