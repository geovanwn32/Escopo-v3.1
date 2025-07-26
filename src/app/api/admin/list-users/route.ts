
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, credential } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccount } from '@/lib/firebase-admin-config';
import type { AppUser } from '@/types/user';

// Helper function to initialize Firebase Admin, ensuring it only runs once
function initializeAdminApp(): App {
  const adminApps = getApps().filter(app => app.name === 'firebase-admin-app');
  if (adminApps.length > 0) {
    return adminApps[0];
  }

  try {
    return initializeApp({
      credential: credential.cert(serviceAccount),
    }, 'firebase-admin-app');
  } catch (error: any) {
    console.error("Firebase Admin Initialization Error:", error.message);
    // This will help diagnose credential issues
    throw new Error("Failed to initialize Firebase Admin. Please check your service account credentials.");
  }
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

    // Sort by creation time descending
    combinedUsers.sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());

    return NextResponse.json(combinedUsers, { status: 200 });
  } catch (error: any) {
    console.error('Error listing users:', error);
    return NextResponse.json({ message: 'Erro ao listar usuários.', error: error.message }, { status: 500 });
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
