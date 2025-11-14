
import * as functions from 'firebase-functions';
import { adminApp } from '../lib/firebase-admin-config'; // Ensure this path is correct
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as dotenv from 'dotenv';
dotenv.config();

// Ensure the admin app is initialized before using it.
if (!adminApp) {
  console.error("Firebase Admin SDK not initialized. Admin features will be disabled.");
}

/**
 * Lists all users in the system. Only callable by an admin.
 */
export const listAllUsers = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'A função deve ser chamada por um usuário autenticado.');
        }
        
        if (!adminApp) {
            throw new functions.https.HttpsError('failed-precondition', 'O Admin SDK não foi inicializado.');
        }
        
        // Optional: Check for admin custom claim
        const callerUser = await getAuth(adminApp).getUser(context.auth.uid);
        if (callerUser.email !== 'geovaniwn@gmail.com') {
             throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem listar usuários.');
        }

        try {
            const firestore = getFirestore(adminApp);
            const usersSnapshot = await firestore.collection('users').get();
            const users = usersSnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({ uid: doc.id, ...doc.data()}));
            return users;
        } catch (error) {
            console.error('Error listing users:', error);
            throw new functions.https.HttpsError('internal', 'Não foi possível listar os usuários.');
        }
});

/**
 * Updates the license for a specific user. Only callable by an admin.
 */
export const updateUserLicense = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'A função deve ser chamada por um usuário autenticado.');
        }
        if (!adminApp) {
            throw new functions.https.HttpsError('failed-precondition', 'O Admin SDK não foi inicializado.');
        }
        const callerUser = await getAuth(adminApp).getUser(context.auth.uid);
        if (callerUser.email !== 'geovaniwn@gmail.com') {
             throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem alterar licenças.');
        }
        
        const { userId, newLicense } = data;
        if (!userId || !newLicense) {
            throw new functions.https.HttpsError('invalid-argument', 'userId e newLicense são obrigatórios.');
        }

        try {
            const firestore = getFirestore(adminApp);
            const userRef = firestore.doc(`users/${userId}`);
            await userRef.update({ licenseType: newLicense });
            return { success: true };
        } catch (error) {
            console.error('Error updating license:', error);
            throw new functions.https.HttpsError('internal', 'Não foi possível atualizar a licença.');
        }
    });

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
        const firestore = getFirestore(adminApp);
        const storage = getStorage(adminApp);
        
        try {
            const collectionsToBackup = [
                'aliquotas', 'employees', 'esocialEvents', 'events', 
                'files', 'fiscalClosures', 'launches', 'orcamentos', 'partners',
                'payrolls', 'produtos', 'rcis', 'recibos', 'rubricas', 
                'servicos', 'socios', 'terminations', 'thirteenths', 'vacations',
                'lancamentosContabeis', 'contasContabeis', 'esocial', // Adicionando a subcoleção esocial
            ];

            const backupData: { [key: string]: any[] } = {};

            // Backup company document itself
            const companyDocRef = firestore.doc(`users/${userId}/companies/${companyId}`);
            const companySnap = await companyDocRef.get();
            if (companySnap.exists()) {
                 backupData['company'] = [{ id: companySnap.id, ...companySnap.data() }];
            }

            for (const collectionName of collectionsToBackup) {
                const collectionRef = firestore.collection(`users/${userId}/companies/${companyId}/${collectionName}`);
                const snapshot = await collectionRef.get();
                if (!snapshot.empty) {
                    backupData[collectionName] = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
                }
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

    
