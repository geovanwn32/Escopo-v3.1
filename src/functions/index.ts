
import * as functions from 'firebase-functions';
import { adminApp } from '../lib/firebase-admin-config'; // Ensure this path is correct
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
dotenv.config();

// Ensure the admin app is initialized before using it.
if (!adminApp) {
  console.error("Firebase Admin SDK not initialized. Admin features will be disabled.");
}

/**
 * Lists all users from Firebase Authentication.
 * This is a callable function that requires the caller to be an authenticated user.
 * Additional permission checks (e.g., custom claims for admin role) should be added.
 */
export const listUsers = functions
  .region('southamerica-east1') // Use a region that supports callable functions
  .https.onCall(async (data, context) => {
    // Check if the user is authenticated.
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }
    
    // Optional: Check for admin custom claim
    // const isAdmin = context.auth.token.admin === true;
    // if (!isAdmin) {
    //   throw new functions.https.HttpsError('permission-denied', 'Only admins can list users.');
    // }
    
    if (!adminApp) {
         throw new functions.https.HttpsError('failed-precondition', 'The Admin SDK is not initialized.');
    }

    try {
      const auth = getAuth(adminApp);
      const listUsersResult = await auth.listUsers(1000); // Adjust maxResults as needed
      const users = listUsersResult.users.map((userRecord) => ({
        uid: userRecord.uid,
        email: userRecord.email,
        disabled: userRecord.disabled,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
        },
      }));
      return users;
    } catch (error: any) {
      console.error('Error listing users:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Unable to list users.',
        error.message
      );
    }
  });


/**
 * Enables or disables a user account in Firebase Authentication.
 */
export const setUserStatus = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }
    
     if (!adminApp) {
         throw new functions.https.HttpsError('failed-precondition', 'The Admin SDK is not initialized.');
    }

    const { uid, disabled } = data;

    if (typeof uid !== 'string' || typeof disabled !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a `uid` (string) and `disabled` (boolean) argument.');
    }

    try {
        const auth = getAuth(adminApp);
        await auth.updateUser(uid, { disabled });
        return { success: true, message: `User ${uid} status updated successfully.` };
    } catch (error: any) {
        console.error('Error updating user status:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Unable to update user status.',
            error.message
        );
    }
  });

/**
 * A callable function to export a single company's data.
 */
export const backupCompanyData = functions
    .region('southamerica-east1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { companyId } = data;
        if (!companyId) {
            throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "companyId" argument.');
        }

        if (!adminApp) {
            throw new functions.https.HttpsError('failed-precondition', 'The Admin SDK is not initialized.');
        }

        const userId = context.auth.uid;
        const firestore = adminApp.firestore();
        const storage = adminApp.storage();
        
        try {
            const collectionsToBackup = [
                'aliquotas', 'companies', 'employees', 'esocialEvents', 'events', 
                'files', 'fiscalClosures', 'launches', 'orcamentos', 'partners',
                'payrolls', 'produtos', 'rcis', 'recibos', 'rubricas', 
                'servicos', 'socios', 'terminations', 'thirteenths', 'vacations',
                'lancamentosContabeis', 'contasContabeis',
            ];

            const backupData: { [key: string]: any[] } = {};

            for (const collectionName of collectionsToBackup) {
                const collectionRef = firestore.collection(`users/${userId}/companies/${companyId}/${collectionName}`);
                const snapshot = await collectionRef.get();
                backupData[collectionName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            
            // Special case: company document itself
            const companyDocRef = firestore.doc(`users/${userId}/companies/${companyId}`);
            const companySnap = await companyDocRef.get();
            if (companySnap.exists()) {
                 backupData['companies'] = [{ id: companySnap.id, ...companySnap.data() }];
            }

            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const fileName = `backup_${companyId}_${timestamp}.json`;
            const filePath = `backups/${userId}/${companyId}/${fileName}`;
            const file = storage.bucket().file(filePath);

            await file.save(JSON.stringify(backupData), {
                contentType: 'application/json',
            });

            return { success: true, filePath: filePath, message: 'Backup concluído com sucesso.' };
        } catch (error: any) {
            console.error('Erro ao criar backup:', error);
            throw new functions.https.HttpsError('internal', 'Falha ao criar backup.', error.message);
        }
    });

    