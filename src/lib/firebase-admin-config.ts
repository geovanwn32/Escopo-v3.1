// This file is a placeholder for your Firebase Admin SDK service account credentials.
// In a real production environment, you should use environment variables
// to store these sensitive credentials, rather than committing them to your repository.
//
// To get your service account key:
// 1. Go to your Firebase project settings -> Service accounts.
// 2. Click "Generate new private key".
// 3. A JSON file will be downloaded. Add its contents to your environment variables.
//
// For deploying to Firebase App Hosting, you can set these as environment variables.
// See: https://firebase.google.com/docs/app-hosting/configure#set-secrets

export const serviceAccount = {
  type: process.env.FIREBASE_TYPE || "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  // This replace is crucial for handling the private key when passed as an environment variable.
  private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
  token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};
