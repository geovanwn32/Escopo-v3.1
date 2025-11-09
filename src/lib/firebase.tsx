
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import React from 'react';

const firebaseConfig = {
    apiKey: "AIzaSyB3sAKHJLcjy1uiEhzmD8Qydr1b2aAX1mk",
    authDomain: "codigo-2v-ed997.firebaseapp.com",
    projectId: "codigo-2v-ed997",
    storageBucket: "codigo-2v-ed997.appspot.com",
    messagingSenderId: "148492349744",
    appId: "1:148492349744:web:5ac6b783a8f2ca9bbc98f5",
    measurementId: "G-NCKJJ1Z7H3"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1'); // Use 'us-central1' if that's your region


export const FirebaseProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
      <FirebaseErrorListener />
    </>
  );
};


export { app, auth, db, storage, functions };
