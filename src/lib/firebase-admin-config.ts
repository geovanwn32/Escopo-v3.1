
import { initializeApp, getApps, App, applicationDefault, cert } from 'firebase-admin/app';

let adminApp: App | null = null;

export function initializeAdminApp(): App | null {
  if (adminApp) {
    return adminApp;
  }

  // If apps are already initialized (e.g., in a hot-reload environment), use the existing one.
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  try {
    // This is the primary method for production (Firebase App Hosting)
    // It uses the GOOGLE_APPLICATION_CREDENTIALS environment variable.
    adminApp = initializeApp({
      credential: applicationDefault(),
    });
    return adminApp;
  } catch (e) {
    console.warn(
        "Could not initialize Firebase Admin SDK using applicationDefault(). This is normal for local development. " +
        "Admin features will be disabled. Error: ", (e as Error).message
    );
    // In a local development environment where GOOGLE_APPLICATION_CREDENTIALS is not set,
    // this will fail. We return null to indicate that the admin app is not available.
    return null;
  }
}
