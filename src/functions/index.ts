
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
 * A callable function to export a single company's data.
 */
export const backupCompanyData = functions
    .region('us-central1')
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
