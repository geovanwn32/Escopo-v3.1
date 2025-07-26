
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, credential } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccount } from '@/lib/firebase-admin-config';
import type { AppUser } from '@/types/user';

function initializeAdminApp(): App {
  const existingApp = getApps().find((app) => app.name === 'firebase-admin-app');
  if (existingApp) {
    return existingApp;
  }

  // Ensure all required fields are present
  const requiredFields: (keyof typeof serviceAccount)[] = ['project_id', 'private_key', 'client_email'];
  const missingFields = requiredFields.filter(field => !serviceAccount[field]);

  if (missingFields.length > 0) {
    // This will happen in dev environments without the env vars.
    // It's not a fatal error for the app to run, but this API endpoint will not work.
    console.warn(`Firebase Admin SDK not initialized. Missing fields: ${missingFields.join(', ')}`);
    // Throw an error that we can catch and return a user-friendly message.
    throw new Error('Firebase Admin credentials are not configured on the server.');
  }

  return initializeApp({
    credential: credential.cert(serviceAccount),
  }, 'firebase-admin-app');
}


export async function GET() {
  try {
    const adminApp = initializeAdminApp();
    const authAdmin = getAuth(adminApp);
    const dbAdmin = getFirestore(adminApp);

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

    return NextResponse.json(combinedUsers, { status: 200 });
  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json({ message: 'Erro ao listar usuários no servidor.', error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const adminApp = initializeAdminApp();
        const authAdmin = getAuth(adminApp);
        
        const { uid, disabled } = await request.json();

        if (!uid) {
            return NextResponse.json({ message: 'UID do usuário é obrigatório.' }, { status: 400 });
        }

        await authAdmin.updateUser(uid, { disabled });

        return NextResponse.json({ message: `Usuário ${disabled ? 'desativado' : 'ativado'} com sucesso.` }, { status: 200 });
    } catch (error: any) {
        console.error('Error updating user status:', error);
        return NextResponse.json({ message: 'Erro ao atualizar status do usuário.', error: error.message }, { status: 500 });
    }
}
