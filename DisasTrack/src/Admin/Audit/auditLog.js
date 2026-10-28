/* ------------------------------------------------------------------
   Audit log, saved in Firebase at /auditLogs/{id}.

   HOW TEAMMATES LOG AN ACTION (example, inside Incident Reports):

     import { logAction } from "../Audit/auditLog.js";
     logAction({
       category: "Incident",          // Incident | Assignment | Account | Login | System
       action: "Priority changed",
       target: "DT-1042",
       details: "Medium -> Critical",
     });

   You do NOT need to pass the user. The signed-in admin is added
   automatically (App.jsx calls setAuditActor when someone signs in).
   Logging never stops the screen: if saving fails, it only prints a
   message in the browser console.
------------------------------------------------------------------- */
import { limitToLast, onValue, push, query, ref } from "firebase/database";
import { db } from "../../firebase.js";

export const CATEGORIES = ["Incident", "Assignment", "Account", "Login", "System"];

// Who is signed in right now. Used as the default "actor" of new entries.
let currentActor = { uid: "", name: "Unknown", role: "Unknown" };

// Called from App.jsx whenever the signed-in user changes (user = null when signed out).
export function setAuditActor(user) {
  currentActor = user
    ? { uid: user.uid, name: user.name || "Admin", role: user.role === "Admin" ? "Administrator" : user.role }
    : { uid: "", name: "Unknown", role: "Unknown" };
}

// Saves one entry. Only category and action are required.
export async function logAction({ actor, actorId, role, category, action, target, details }) {
  const entry = {
    timestamp: new Date().toISOString(),
    actor: actor ?? currentActor.name,
    actorId: actorId ?? currentActor.uid,
    role: role ?? currentActor.role,
    category: category ?? "System",
    action: action ?? "",
    target: target ?? "",
    details: details ?? "",
  };
  try {
    // push() makes a new entry with its own unique id.
    await push(ref(db, "auditLogs"), entry);
  } catch (err) {
    console.error("Could not save the audit log entry:", err);
  }
}

// Calls callback(list, error) every time the log changes (newest entry first).
// Returns a function that stops listening. Only the latest 500 entries are loaded.
export function watchAuditLogs(callback) {
  return onValue(
    query(ref(db, "auditLogs"), limitToLast(500)),
    (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      callback(list, null);
    },
    () => callback([], new Error("You don't have permission to read the audit log."))
  );
}
