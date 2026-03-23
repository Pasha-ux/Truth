import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB9B4wI37ChDzy3Hm3J00WveXcieM0_BeE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "truth-38839.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "truth-38839",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "truth-38839.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "109312627926",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:109312627926:web:485012e26265837ef84677",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-40VZXCCGTC",
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.trim().length > 0
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export const getFirebaseDb = (): Firestore | null => {
  if (!hasFirebaseConfig) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  if (!db) db = getFirestore(app);
  return db;
};
