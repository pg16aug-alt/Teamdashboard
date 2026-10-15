import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

// Lazy so that static prerendering never initialises Firebase without a browser.
// NEXT_PUBLIC_USE_EMULATOR=1 points the app at the local Firebase emulators (used for end-to-end tests).
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function app() {
  return getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
}

export function auth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(app());
    if (process.env.NEXT_PUBLIC_USE_EMULATOR === "1") connectAuthEmulator(authInstance, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return authInstance;
}

export function db(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(app());
    if (process.env.NEXT_PUBLIC_USE_EMULATOR === "1") connectFirestoreEmulator(dbInstance, "127.0.0.1", 8080);
  }
  return dbInstance;
}
