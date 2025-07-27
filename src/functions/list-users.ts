/**
 * @fileoverview Firebase Cloud Function to list all users for an admin panel.
 *
 * This file contains two Cloud Functions:
 * 1.  `listUsers`: A callable function that returns a list of all Firebase
 *     Authentication users, combined with their data from Firestore. It checks
 *     if the calling user has an 'admin' custom claim before executing.
 * 2.  `setUserStatus`: A callable function that allows an admin to disable or
 *     enable a user account in Firebase Authentication.
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin SDK
// This will use the service account credentials available in the Cloud Functions environment.
if (!getApps().length) {
    initializeApp();
}

interface AppUser {
  uid: string;
  email: string | null;
  licenseType?: 'trial' | 'basica' | 'profissional' | 'premium';
  trialEndsAt?: any;
}

/**
 * A callable Cloud Function that lists all users.
 *
 * @remarks
 * This function can only be called by an authenticated user with the `admin` custom claim set to `true`.
 *
 * @throws `unauthenticated` - If the user is not authenticated.
 * @throws `permission-denied` - If the user is not an admin.
 * @throws `internal` - For any other server-side errors.
 *
 * @returns A promise that resolves with an array of user objects.
 */
export const listUsers = onCall(async (request) => {
    logger.info("listUsers function called by:", request.auth?.uid);

    // 1. Authentication and Authorization Check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'A função deve ser chamada por um usuário autenticado.');
    }

    const isAdmin = request.auth.token.admin === true;
    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'Permissão negada. Apenas administradores podem listar usuários.');
    }

    // 2. Fetch Data
    try {
        const authAdmin = getAuth();
        const dbAdmin = getFirestore();

        const listUsersResult = await authAdmin.listUsers(1000);
        const authUsers = listUsersResult.users;

        const firestoreUsersSnap = await dbAdmin.collection('users').get();
        const firestoreUsersMap = new Map<string, AppUser>();
        firestoreUsersSnap.forEach(doc => {
            firestoreUsersMap.set(doc.id, doc.data() as AppUser);
        });

        const combinedUsers = authUsers.map(authUser => {
            const firestoreUser = firestoreUsersMap.get(authUser.uid);
            return {
                uid: authUser.uid,
                email: authUser.email,
                disabled: authUser.disabled,
                creationTime: authUser.metadata.creationTime,
                lastSignInTime: authUser.metadata.lastSignInTime,
                licenseType: firestoreUser?.licenseType || 'trial',
                trialEndsAt: firestoreUser?.trialEndsAt,
            };
        });
        
        combinedUsers.sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());

        logger.info(`Successfully fetched ${combinedUsers.length} users.`);
        return combinedUsers;
    } catch (error) {
        logger.error("Error listing users:", error);
        // Log a more detailed error to help diagnose permission issues.
        if (error instanceof Error) {
            throw new HttpsError('internal', `Erro interno ao processar a solicitação de usuários: ${error.message}`);
        }
        throw new HttpsError('internal', 'Ocorreu um erro desconhecido ao processar a solicitação de usuários.');
    }
});


/**
 * A callable Cloud Function to enable or disable a user account.
 *
 * @remarks
 * This function can only be called by an authenticated user with the `admin` custom claim set to `true`.
 * It expects `uid` (string) and `disabled` (boolean) in the data payload.
 *
 * @throws `unauthenticated` - If the user is not authenticated.
 * @throws `permission-denied` - If the user is not an admin.
 * @throws `invalid-argument` - If `uid` or `disabled` are missing or invalid.
 * @throws `internal` - For any other server-side errors.
 *
 * @returns A promise that resolves with a success message.
 */
export const setUserStatus = onCall(async (request) => {
    logger.info("setUserStatus function called by:", request.auth?.uid);
    logger.info("Payload:", request.data);

    // 1. Authentication and Authorization Check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'A função deve ser chamada por um usuário autenticado.');
    }
    const isAdmin = request.auth.token.admin === true;
    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'Permissão negada. Apenas administradores podem alterar o status de usuários.');
    }
    
    // 2. Validate Input
    const { uid, disabled } = request.data;
    if (typeof uid !== 'string' || uid.length === 0) {
        throw new HttpsError('invalid-argument', 'O UID do usuário é obrigatório e deve ser uma string.');
    }
     if (typeof disabled !== 'boolean') {
        throw new HttpsError('invalid-argument', 'O status "disabled" é obrigatório e deve ser um booleano.');
    }

    // 3. Perform Action
    try {
        const authAdmin = getAuth();
        await authAdmin.updateUser(uid, { disabled });
        logger.info(`Successfully ${disabled ? 'disabled' : 'enabled'} user: ${uid}`);
        return { message: `Usuário ${disabled ? 'desativado' : 'ativado'} com sucesso.` };
    } catch (error) {
        logger.error("Error updating user status:", error);
        throw new HttpsError('internal', 'Erro ao atualizar o status do usuário.');
    }
});
