
// This file is a placeholder for your Firebase Admin SDK service account credentials.
// In a real production environment, you should use environment variables
// to store these sensitive credentials, rather than committing them to your repository.
//
// To get your service account key:
// 1. Go to your Firebase project settings -> Service accounts.
// 2. Click "Generate new private key".
// 3. A JSON file will be downloaded. Copy its contents here.
// 4. IMPORTANT: Add this file to your .gitignore to avoid exposing your keys.
//
// For deploying to Firebase App Hosting, you can set these as environment variables.
// See: https://firebase.google.com/docs/app-hosting/configure#set-secrets
// The recommended way is to set GOOGLE_APPLICATION_CREDENTIALS as a secret.

export const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS 
  ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : {
      "type": "service_account",
      "project_id": process.env.FIREBASE_PROJECT_ID || "codigo-2v-ed997",
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID || "",
      "private_key": (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
      "client_email": process.env.FIREBASE_CLIENT_EMAIL || "",
      "client_id": process.env.FIREBASE_CLIENT_ID || "",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL || ""
    };
