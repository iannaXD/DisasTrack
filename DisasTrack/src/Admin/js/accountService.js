/* ------------------------------------------------------------------
   Everything that talks to Firebase about accounts lives here, so the
   screens stay simple.

   Profiles are saved in one folder per role:
     /users/Admins/{uid}
     /users/Residents/{uid}
     /users/DisasterManagementOfficers/{uid}
     /users/RescueTeamMembers/{uid}
   plus a small lookup  /userRoles/{uid} = "Resident" (etc.), so the app can
   find a person's folder from their uid alone (for example at sign-in).

   OLD accounts saved directly at /users/{uid} still work ("legacy").
   The Users screen has a button that moves them into the role folders.
------------------------------------------------------------------- */
import { deleteApp, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { get, onValue, ref, update } from "firebase/database";
import { app, auth, db, usernameToEmail } from "../../firebase.js";
import { logAction } from "../Audit/auditLog.js";

// Role (as stored in the profile) -> folder name under /users.
export const ROLE_FOLDERS = {
  Admin: "Admins",
  Resident: "Residents",
  "Disaster Management Officer": "DisasterManagementOfficers",
  "Rescue Team": "RescueTeamMembers",
};
const FOLDER_NAMES = Object.values(ROLE_FOLDERS);

// Where an account is saved. account = { id, role, legacy }.
export function accountPath(account) {
  if (account.legacy) return `users/${account.id}`; // old flat structure
  return `users/${ROLE_FOLDERS[account.role]}/${account.id}`;
}

// Removes the helper fields (id, legacy, password) that must never be saved in the profile.
function cleanProfile(values) {
  const { id, legacy, password, ...clean } = values; // eslint-disable-line no-unused-vars
  return clean;
}

// Turns Firebase's error codes into messages a person can read.
export function friendlyMessage(err) {
  const code = err?.code || "";
  if (code === "auth/email-already-in-use") return "This username is already used by another account.";
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password", "auth/invalid-email"].includes(code))
    return "Wrong username or password.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes and try again.";
  if (code === "auth/network-request-failed") return "No internet connection. Please try again.";
  if (code === "auth/weak-password") return "The password is too weak. Use at least 8 characters.";
  if (String(err?.message).includes("PERMISSION_DENIED")) return "You don't have permission to do that.";
  return err?.message || "Something went wrong. Please try again.";
}

// ---------- sign in / out ----------

// Only these two roles may use the web console.
//   Admin                       -> /admin
//   Disaster Management Officer -> /officer
export const CONSOLE_ROLES = ["Admin", "Disaster Management Officer"];

// Where each role lands after signing in.
export function homePathForRole(role) {
  return role === "Disaster Management Officer" ? "/officer" : "/admin";
}

// Loads the signed-in person's profile and checks that they may use the web console.
// (The name says "Admin" for historical reasons; it now accepts officers too.)
export async function loadAdminProfile(uid) {
  // 1. Ask the lookup which role this person has.
  const role = (await get(ref(db, `userRoles/${uid}`))).val();

  // 2. Load the profile from the folder of that role (no role = old admin account).
  let profile = null;
  if (!role || CONSOLE_ROLES.includes(role)) {
    const folder = ROLE_FOLDERS[role || "Admin"];
    profile = (await get(ref(db, `users/${folder}/${uid}`))).val();
    // Old admin accounts may still be saved in the flat place /users/{uid}.
    if (!profile && !role) profile = (await get(ref(db, `users/${uid}`))).val();
  }

  let problem = "";
  if (role && !CONSOLE_ROLES.includes(role)) problem = "This account does not have access to the web console.";
  else if (!profile) problem = "No profile was found for this account. Ask an administrator to set it up.";
  else if (!CONSOLE_ROLES.includes(profile.role)) problem = "This account does not have access to the web console.";
  else if (profile.status === "Suspended") problem = "This account has been suspended.";

  if (problem) {
    await signOut(auth);
    throw new Error(problem);
  }
  return { uid, ...profile };
}

export async function signInAdmin(username, password, remember) {
  try {
    // "Remember me" keeps the login after the browser closes.
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const result = await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
    const admin = await loadAdminProfile(result.user.uid);
    await updateOwnProfile(admin.uid, { lastLogin: new Date().toISOString() });
    // Record the sign-in (the actor is passed here because App.jsx has not stored it yet).
    const isOfficer = admin.role === "Disaster Management Officer";
    logAction({
      actor: admin.name,
      actorId: admin.uid,
      role: isOfficer ? admin.role : "Administrator",
      category: "Login",
      action: "Signed in",
      target: isOfficer ? "Officer console" : "Admin console",
      details: "Successful sign-in",
    });
    return admin;
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// ---------- accounts ----------

// Calls callback(list, error) every time /users changes. Returns a function that stops listening.
export function watchAccounts(callback) {
  return onValue(
    ref(db, "users"),
    (snapshot) => {
      const data = snapshot.val() || {};
      const list = [];
      Object.entries(data).forEach(([key, value]) => {
        if (FOLDER_NAMES.includes(key)) {
          // A role folder: every child is one account.
          Object.entries(value || {}).forEach(([uid, profile]) => list.push({ id: uid, ...profile }));
        } else {
          // An old account saved directly under /users/{uid}.
          list.push({ id: key, legacy: true, ...value });
        }
      });
      callback(list, null);
    },
    (err) => callback([], new Error(friendlyMessage(err)))
  );
}

// Creates the sign-in account AND the profile (in the folder of its role).
// A second, temporary Firebase app is used so the admin does not get signed out
// (creating a user normally signs you in as that user).
export async function createAccount(profile, password) {
  const folder = ROLE_FOLDERS[profile.role];
  if (!folder) throw new Error("Choose a valid role for this account.");

  const helperApp = initializeApp(app.options, `helper-${Date.now()}`);
  try {
    const helperAuth = getAuth(helperApp);
    const created = await createUserWithEmailAndPassword(helperAuth, usernameToEmail(profile.username), password);
    const uid = created.user.uid;
    // One update writes both places together: the profile and the role lookup.
    await update(ref(db), {
      [`users/${folder}/${uid}`]: { ...cleanProfile(profile), createdAt: new Date().toISOString() },
      [`userRoles/${uid}`]: profile.role,
    });
    await signOut(helperAuth);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  } finally {
    await deleteApp(helperApp);
  }
}

// Edits an account. account = the account being edited (as listed on the Users screen),
// values = the fields to change. If the role changes (or the account is still in the
// old flat place), the profile is MOVED into the right role folder.
export async function updateAccount(account, values) {
  try {
    const clean = cleanProfile(values);
    const newRole = clean.role || account.role;

    if (!account.legacy && newRole === account.role) {
      // Same place: a simple edit.
      await update(ref(db, accountPath(account)), clean);
      return;
    }

    // Move: copy the whole profile to the new folder and remove the old one.
    const folder = ROLE_FOLDERS[newRole];
    if (!folder) throw new Error("Choose a valid role for this account.");
    await update(ref(db), {
      [accountPath(account)]: null, // null deletes
      [`users/${folder}/${account.id}`]: { ...cleanProfile(account), ...clean },
      [`userRoles/${account.id}`]: newRole,
    });
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// The signed-in person edits their OWN profile (name, phone, photo, ...).
// Finds the right place: the folder of the person's role, or the old flat place if not moved yet.
export async function updateOwnProfile(uid, values) {
  try {
    const role = (await get(ref(db, `userRoles/${uid}`))).val();
    const folder = ROLE_FOLDERS[role || "Admin"];
    const inFolder = folder && (await get(ref(db, `users/${folder}/${uid}`))).exists();
    await update(ref(db, inFolder ? `users/${folder}/${uid}` : `users/${uid}`), values);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// NOTE: this removes the profile only. The sign-in account stays in Firebase
// Authentication, but it can no longer use the app because it has no profile.
// To free the username again, delete it in the Firebase console (Authentication > Users).
export async function deleteAccount(account) {
  try {
    await update(ref(db), {
      [accountPath(account)]: null,
      [`userRoles/${account.id}`]: null,
    });
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// How many old (flat) accounts can be moved into role folders.
// Old Dispatcher accounts are left alone (that role no longer exists).
export function oldAccountsToMove(accounts) {
  return accounts.filter((a) => a.legacy && ROLE_FOLDERS[a.role]);
}

// One-time clean-up: moves old accounts into their role folders. Returns how many were moved.
export async function moveOldAccounts(accounts) {
  const changes = {};
  const toMove = oldAccountsToMove(accounts);
  toMove.forEach((account) => {
    changes[`users/${account.id}`] = null;
    changes[`users/${ROLE_FOLDERS[account.role]}/${account.id}`] = cleanProfile(account);
    changes[`userRoles/${account.id}`] = account.role;
  });
  if (toMove.length === 0) return 0;
  try {
    await update(ref(db), changes);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
  return toMove.length;
}

// Changes the signed-in person's own password.
// Firebase wants the current password again first (re-authentication).
export async function changeOwnPassword(currentPassword, newPassword) {
  try {
    // Use the email Firebase Auth actually has for this account (not the profile username).
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  } catch (err) {
    if (["auth/invalid-credential", "auth/wrong-password"].includes(err?.code)) {
      throw new Error("Your current password is incorrect.");
    }
    throw new Error(friendlyMessage(err));
  }
}
