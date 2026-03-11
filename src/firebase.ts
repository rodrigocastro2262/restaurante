import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
let db: any;
let auth: any;
let googleProvider: any;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  // We don't throw here so the app can at least render the error boundary or login screen with an error message
}

export { db, auth };

export const loginWithGoogle = async () => {
  if (!auth) throw new Error("Firebase Auth no está inicializado. Verifica si tu navegador bloquea cookies o almacenamiento local.");
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error logging in with Google:", error);
    throw error;
  }
};

export const logout = async () => {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out:", error);
  }
};
