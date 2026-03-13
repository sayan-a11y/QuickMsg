
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, onValue, push, update, remove, 
    query, orderByChild, equalTo, serverTimestamp, onDisconnect,
    startAt, endAt 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1z4GSCcOrT3RxwHKsypoD_NRt4rCN2Bk",
  authDomain: "quickmsg-6fd97.firebaseapp.com",
  databaseURL: "https://quickmsg-6fd97-default-rtdb.firebaseio.com",
  projectId: "quickmsg-6fd97",
  storageBucket: "quickmsg-6fd97.firebasestorage.app",
  messagingSenderId: "422131752495",
  appId: "1:422131752495:web:a5c6c7d6fa315b5452f0da"
};

// Initialize Firebase once
console.log("Starting Firebase initialization for:", window.location.hostname);
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app, firebaseConfig.databaseURL);
const storage = getStorage(app);
const auth = getAuth(app);

// Enable local persistence so users stay logged in across refreshes
setPersistence(auth, browserLocalPersistence)
    .then(() => console.log("Auth persistence enabled"))
    .catch(err => console.error("Auth persistence error:", err));

console.log("Firebase initialized successfully on:", window.location.hostname);

export { 
    app, db, storage, auth, 
    ref, set, get, onValue, push, update, remove, query, orderByChild, equalTo, serverTimestamp, onDisconnect, startAt, endAt,
    sRef, uploadBytes, getDownloadURL,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut
};
