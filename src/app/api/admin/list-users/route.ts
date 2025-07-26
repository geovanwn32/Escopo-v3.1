
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { AppUser } from '@/types/user';

// Helper function to initialize the Admin App, ensuring it's a singleton.
function initializeAdminApp(): App | null {
  // If apps are already initialized, return the existing one.
  if (getApps().length > 0) {
    return getApps()[0];
  }

  try {
    // This is the primary method for production (Firebase App Hosting)
    // It uses the GOOGLE_APPLICATION_CREDENTIALS environment variable.
    return initializeApp({
      credential: applicationDefault(),
    });
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


export async function GET() {
  try {
    const adminApp = initializeAdminApp();

    // If the admin app failed to initialize (e.g., missing credentials in local dev),
    // return a specific error response immediately.
    if (!adminApp) {
        return NextResponse.json(
            { message: 'As credenciais do Firebase Admin não estão configuradas corretamente no servidor ou não têm permissão.' },
            { status: 503 } // Service Unavailable
        );
    }
  
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
    // Provide a more specific error message if possible
    const errorMessage = error.code === 'app/invalid-credential' || error.code === 'auth/insufficient-permission'
        ? 'As credenciais do Firebase Admin não estão configuradas corretamente no servidor ou não têm permissão.'
        : 'Erro interno ao processar a solicitação de usuários.';
    return NextResponse.json({ message: errorMessage, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const adminApp = initializeAdminApp();
        if (!adminApp) {
             return NextResponse.json({ message: 'A API de Admin não está configurada neste ambiente.' }, { status: 503 });
        }
    
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
