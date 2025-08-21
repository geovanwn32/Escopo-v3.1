
/**
 * @fileoverview Firebase Cloud Function to backup company data.
 */

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { format } from 'date-fns';

if (!getApps().length) {
    initializeApp();
}

const db = getFirestore();
const storage = getStorage();

const COLLECTIONS_TO_BACKUP = [
    'aliquotas',
    'contasContabeis',
    'employees',
    'esocialEvents',
    'events',
    'files',
    'fiscalClosures',
    'launches',
    'orcamentos',
    'partners',
    'payrolls',
    'pgdas',
    'produtos',
    'rcis',
    'rubricas',
    'servicos',
    'socios',
    'terminations',
    'thirteenths',
    'vacations',
    'preliminaryAdmissions',
    'admissions'
];

/**
 * Creates a JSON backup of a company's data and saves it to Cloud Storage.
 */
export const backupCompanyData = onCall(async (request) => {
    logger.info("backupCompanyData function called by:", request.auth?.uid);
    const uid = request.auth?.uid;

    if (!uid) {
        throw new HttpsError('unauthenticated', 'A função deve ser chamada por um usuário autenticado.');
    }

    const { companyId } = request.data;
    if (!companyId || typeof companyId !== 'string') {
        throw new HttpsError('invalid-argument', 'O companyId é obrigatório.');
    }

    logger.info(`Starting backup for user: ${uid}, company: ${companyId}`);

    const backupData: { [key: string]: any[] } = {};

    try {
        for (const collectionName of COLLECTIONS_TO_BACKUP) {
            const collectionRef = db.collection(`users/${uid}/companies/${companyId}/${collectionName}`);
            const snapshot = await collectionRef.get();
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (docs.length > 0) {
                backupData[collectionName] = docs;
            }
            logger.info(`Backed up ${docs.length} documents from ${collectionName}`);
        }

        const dateStr = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        const fileName = `backup_${companyId}_${dateStr}.json`;
        const filePath = `backups/${uid}/${companyId}/${fileName}`;

        const bucket = storage.bucket();
        const file = bucket.file(filePath);

        await file.save(JSON.stringify(backupData, null, 2), {
            contentType: 'application/json',
        });

        logger.info(`Backup successful. File saved to: ${filePath}`);

        return { success: true, filePath: filePath };

    } catch (error) {
        logger.error("Error creating backup:", error);
        if (error instanceof Error) {
            throw new HttpsError('internal', `Erro interno ao criar backup: ${error.message}`);
        }
        throw new HttpsError('internal', 'Ocorreu um erro desconhecido ao criar o backup.');
    }
});
