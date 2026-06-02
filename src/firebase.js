// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // 1. Ensure you import getAuth

const firebaseConfig = {
  apiKey: "AIzaSyAMfneT5IuB_nHvOA-VhSHm5ogHM4G9WR4",
  authDomain: "pulunga-fc-production.firebaseapp.com",
  projectId: "pulunga-fc-production",
  storageBucket: "pulunga-fc-production.firebasestorage.app",
  messagingSenderId: "1034145606312",
  appId: "1:1034145606312:web:dab3ab7e2600c4dea3f09d",
  measurementId: "G-6B0E6H2EPY",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Initialize and export instances named EXACTLY as expected
export const db = getFirestore(app);
export const auth = getAuth(app);
