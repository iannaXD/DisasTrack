/* ------------------------------------------------------------------
   Notifications for the admin console (the bell in the top bar).

   There is NO separate list of notifications in the database. The bell is
   built live from data that already exists, so it also catches reports
   that residents send from their own app while no admin is signed in:

     /incidents/{id}      -> "New incident report"   (uses createdAt)
     /users/...           -> "New user created"       (uses createdAt)
     /rescueTeams/{id}    -> "New rescue team created" (uses createdAt)

   The only thing saved is where each admin last read the bell:
     /notificationReads/{uid} = { lastReadAt: ISO timestamp }
   Anything created after that time shows as unread. Each admin has their
   own marker, so one admin reading does not clear it for the others.
------------------------------------------------------------------- */
import { onValue, ref, set } from "firebase/database";
import { db } from "../../firebase.js";

export const MAX_NOTIFICATIONS = 30; // how many the bell lists

export const KIND_ICON = { incident: "reports", user: "users", team: "rescue" };
export const KIND_LINK = {
  incident: "/admin/incident-reports",
  user: "/admin/users",
  team: "/admin/rescue-teams",
};

// ISO text -> milliseconds (0 when missing or invalid, so it never counts as new).
export const toMs = (iso) => Date.parse(iso) || 0;

// Turns the three live lists into one list of notifications, newest first.
// Each item: { id, kind, title, text, meta, at, to }
export function buildNotifications({ incidents, accounts, teams }) {
  const list = [];

  incidents.forEach((i) => {
    if (!i.createdAt) return;
    list.push({
      id: `incident:${i.id}`,
      kind: "incident",
      title: "New incident report",
      text: `${i.id} · ${i.type || "Incident"}${i.location ? ` at ${i.location}` : ""}`,
      meta: [i.priority && `${i.priority} priority`, i.reporter && `by ${i.reporter}`].filter(Boolean).join(" · "),
      at: i.createdAt,
      to: `/admin/incident-reports/${i.id}`,
    });
  });

  accounts.forEach((a) => {
    if (!a.createdAt) return;
    list.push({
      id: `user:${a.id}`,
      kind: "user",
      title: "New user created",
      text: `${a.name || a.username || "New account"}${a.role ? ` (${a.role})` : ""}`,
      meta: a.username ? `@${a.username}` : "",
      at: a.createdAt,
      to: KIND_LINK.user,
    });
  });

  teams.forEach((t) => {
    if (!t.createdAt) return;
    list.push({
      id: `team:${t.id}`,
      kind: "team",
      title: "New rescue team created",
      text: `${t.id}${t.name ? ` · ${t.name}` : ""}`,
      meta: [t.type, t.base].filter(Boolean).join(" · "),
      at: t.createdAt,
      to: KIND_LINK.team,
    });
  });

  return list.sort((a, b) => toMs(b.at) - toMs(a.at));
}

// Listens to this admin's "last read" time. callback(ms).
// First time ever (no marker yet): everything that already exists counts as read,
// so a new admin is not buried in old items. If the rules have not been published yet,
// it falls back to "now", so only items that arrive while the page is open show as new.
export function watchLastRead(uid, callback) {
  return onValue(
    ref(db, `notificationReads/${uid}`),
    (snapshot) => {
      if (snapshot.exists()) {
        callback(toMs(snapshot.val().lastReadAt));
      } else {
        const now = new Date().toISOString();
        callback(toMs(now));
        set(ref(db, `notificationReads/${uid}`), { lastReadAt: now }).catch((err) =>
          console.error("Could not save the notification marker:", err)
        );
      }
    },
    () => callback(Date.now())
  );
}

// Saves "I have read everything up to now". Never stops the screen if it fails.
export async function saveLastRead(uid, iso) {
  try {
    await set(ref(db, `notificationReads/${uid}`), { lastReadAt: iso });
  } catch (err) {
    console.error("Could not save the notification marker:", err);
  }
}
