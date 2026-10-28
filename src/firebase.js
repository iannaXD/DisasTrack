/* ------------------------------------------------------------------
   Firebase setup. The whole team imports from this one file:

     import { auth, db } from "../firebase.js";

   These values are identifiers, not secrets, so it is fine to commit them.
   Security comes from the database rules (see database.rules.json).
------------------------------------------------------------------- */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDzodK8IT9kEXUHvXfbhlCkAxYONJaq7zI",
  authDomain: "disastrackdb.firebaseapp.com",
  databaseURL: "https://disastrackdb-default-rtdb.firebaseio.com",
  projectId: "disastrackdb",
  storageBucket: "disastrackdb.firebasestorage.app",
  messagingSenderId: "564192944628",
  appId: "1:564192944628:web:9f365d8b6fa9b8060419a1",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Firebase Auth signs in with an email, but DisasTrack users sign in with a
// username. So each username becomes a hidden email: "msantos" -> "msantos@disastrack.app".
// The person's real email is saved in their profile (/users/{uid}/email).
const USERNAME_DOMAIN = "disastrack.app";
export const usernameToEmail = (username) => `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
