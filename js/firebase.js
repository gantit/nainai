// firebase.js - inicialización y referencias de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  setLogLevel,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  setLogLevel,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
};

const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const firebaseConfig = window.CONFIG.firebase;
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
setLogLevel("debug");

export { app, db, auth, appId };
