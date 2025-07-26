
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/lib/firebase-admin-config';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { AppUser } from '@/types/user';

export async function GET() {
  const adminApp = initializeAdminApp();
  if (!adminApp) {
      // If initialization fails (e.g., in local dev without credentials), return an empty list.
      return NextResponse.json([], { status: 200 });
  }
  
  try {
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
    const adminApp = initializeAdminApp();
    if (!adminApp) {
        return NextResponse.json({ message: 'A API de Admin não está configurada neste ambiente.' }, { status: 503 });
    }

    try {
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
