import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBFAzFcV3JCKIx7fP-po1GSwtZWG6lhIas",
  authDomain: "bachelor-khata.firebaseapp.com",
  projectId: "bachelor-khata",
  storageBucket: "bachelor-khata.firebasestorage.app",
  messagingSenderId: "879581001464",
  appId: "1:879581001464:web:7ce38304af20cd0bed2d0d",
  measurementId: "G-6QF549K3N3",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
