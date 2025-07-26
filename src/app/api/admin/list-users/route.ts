
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, credential } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { AppUser } from '@/types/user';

function initializeAdminApp(): App {
  const existingApp = getApps().find((app) => app.name === 'firebase-admin-app');
  if (existingApp) {
    return existingApp;
  }

  // A abordagem mais robusta para produção (Firebase App Hosting, Cloud Run, etc.)
  // é usar uma variável de ambiente com a chave de serviço codificada em base64.
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (!serviceAccountBase64) {
    throw new Error('As credenciais do Firebase Admin não estão configuradas. Defina a variável de ambiente FIREBASE_SERVICE_ACCOUNT_BASE64.');
  }
  
  try {
    const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    return initializeApp({
        credential: credential.cert(serviceAccount),
    }, 'firebase-admin-app');

  } catch (e: any) {
    console.error("Falha ao analisar as credenciais do Firebase Admin. Verifique se o base64 está correto.", e.message);
    throw new Error("Credenciais do Firebase Admin mal formatadas.");
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

    combinedUsers.sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());

    return NextResponse.json(combinedUsers, { status: 200 });
  } catch (error: any) {
    console.error('Erro ao listar usuários:', error);
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
