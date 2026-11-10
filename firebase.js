import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";

const isConfigured = Object.values(firebaseConfig).every(value =>
  typeof value === "string" && value.trim() !== "" && !value.startsWith("YOUR_")
);

let auth = null;
let db = null;
let storage = null;
let functions = null;
let firebaseInitError = null;
if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app, "us-central1");
  } catch (error) {
    firebaseInitError = error;
    console.error("Firebase could not be initialized.", error);
  }
}

export {
  auth,
  collection,
  deleteDoc,
  db,
  doc,
  deleteObject,
  firebaseInitError,
  functions,
  getDownloadURL,
  getDoc,
  getDocs,
  getStorage,
  httpsCallable,
  GoogleAuthProvider,
  limit,
  onAuthStateChanged,
  orderBy,
  query,
  ref,
  sendPasswordResetEmail,
  serverTimestamp,
  setDoc,
  storage,
  signInWithPopup,
  signOut,
  uploadBytes,
  where,
};
export const firebaseConfigured = isConfigured && Boolean(auth && db);
