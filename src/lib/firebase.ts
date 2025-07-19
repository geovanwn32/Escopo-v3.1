import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyB3sAKHJLcjy1uiEhzmD8Qydr1b2aAX1mk",
    authDomain: "codigo-2v-ed997.firebaseapp.com",
    projectId: "codigo-2v-ed997",
    storageBucket: "codigo-2v-ed997.firebasestorage.app",
    messagingSenderId: "148492349744",
    appId: "1:148492349744:web:5ac6b783a8f2ca9bbc98f5",
    measurementId: "G-NCKJJ1Z7H3"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
