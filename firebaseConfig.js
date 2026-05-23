import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAzDhiFXwj-vhWvzs3PlVcLSpijvhV2OKw",
  authDomain: "nus-lendit.firebaseapp.com",
  projectId: "nus-lendit",
  storageBucket: "nus-lendit.firebasestorage.app",
  messagingSenderId: "199776577441",
  appId: "1:199776577441:web:19ceca21d1a8d1f2df0de0",
  measurementId: "G-G5ZPTQH9Y1"
};

let app;
let auth;
let db;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  db = getFirestore(app);
} else {
  app = getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db };