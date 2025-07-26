
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { AppUser } from '@/types/user';

// Helper function to initialize the Firebase Admin App
function initializeAdminApp(): App {
  // Check if the app is already initialized
  if (getApps().length) {
    return getApps()[0];
  }

  // If not initialized, initialize it.
  // In a Firebase/Google Cloud environment (like App Hosting),
  // this will automatically use the runtime's service account credentials.
  // For local development, it will look for the GOOGLE_APPLICATION_CREDENTIALS
  // environment variable pointing to a service account JSON file.
  return initializeApp({
    credential: applicationDefault(),
  });
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
    console.error('Erro ao listar usuários:', error);
    // Provide a more specific error message if possible
    const errorMessage = error.code === 'app/invalid-credential'
        ? 'As credenciais do Firebase Admin não estão configuradas corretamente no servidor.'
        : 'Erro interno ao processar a solicitação de usuários.';
    return NextResponse.json({ message: errorMessage, error: error.message }, { status: 500 });
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
