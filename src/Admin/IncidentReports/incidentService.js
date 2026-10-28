/* ------------------------------------------------------------------
   Everything that talks to Firebase about INCIDENTS lives here.

   Incidents are saved at  /incidents/{id}   (id looks like "DT-1042"):
     id, type, location, reporter, phone, priority, status, description,
     photos, duplicateOf, lat, lng, team, createdAt, activity[]

   - team       = a team id from /rescueTeams ("T-01"), not a team name
   - createdAt  = ISO timestamp  (new Date().toISOString())
   - activity   = [{ text, at }]  where "at" is also an ISO timestamp
   - priority   = Critical | High | Medium | Low
   - status     = Pending | Verified | Awaiting Assignment | Team Assigned | In Progress |
                  Resolved | Duplicate | Rejected | Closed
   (Optional extra: match = the duplicate-match percentage, set by duplicate detection.)

   Firebase does not store empty fields (null, undefined, empty lists), so a
   missing field simply means "none". normalize() fills the gaps when reading.
------------------------------------------------------------------- */
import { onValue, ref, runTransaction, update } from "firebase/database";
import { db } from "../../firebase.js";
import { friendlyMessage } from "../js/accountService.js";

// Fills the fields Firebase leaves out, so screens never see undefined.
function normalize(id, value) {
  const activity = Array.isArray(value.activity)
    ? value.activity
    : Object.values(value.activity || {}); // Firebase may return a list as an object
  return {
    photos: 0,
    team: null,
    duplicateOf: null,
    match: null,
    ...value,
    id,
    activity: activity.filter(Boolean),
  };
}

// Calls callback(list, error) every time /incidents changes. Returns a function that stops listening.
export function watchIncidents(callback) {
  return onValue(
    ref(db, "incidents"),
    (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data).map(([id, value]) => normalize(id, value));
      callback(list, null);
    },
    (err) => callback([], new Error(friendlyMessage(err)))
  );
}

// Changes some fields of one incident and (optionally) adds a line to its activity log.
//   patch = fields to change (use null to remove one, e.g. { team: null })
//   log   = text for the activity log
// A transaction is used so two admins editing at the same moment don't overwrite
// each other's log lines.
export async function updateIncident(id, patch, log) {
  try {
    await runTransaction(ref(db, `incidents/${id}`), (current) => {
      if (current === null) return current; // not loaded yet: Firebase retries with the real data
      const next = { ...current, ...patch };
      Object.keys(next).forEach((key) => next[key] == null && delete next[key]);
      if (log) {
        const before = Array.isArray(current.activity) ? current.activity : Object.values(current.activity || {});
        next.activity = [...before, { text: log, at: new Date().toISOString() }];
      }
      return next;
    });
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// Saves a new incident (the resident app does the same thing). Returns its id.
// values needs at least: type, location, reporter, phone, priority, description, lat, lng.
export async function createIncident(values, incidents) {
  const next = Math.max(1000, ...incidents.map((i) => Number(String(i.id).replace(/\D/g, "")) || 0)) + 1;
  const id = `DT-${next}`;
  const createdAt = new Date().toISOString();
  const record = {
    photos: 0,
    ...values,
    id,
    status: "Pending",
    createdAt,
    activity: [{ text: `Report submitted by ${values.reporter}`, at: createdAt }],
  };
  try {
    await update(ref(db), { [`incidents/${id}`]: record });
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
  return id;
}

// One-time setup: saves a list of incidents (the sample data) in one go.
export async function saveIncidents(list) {
  const changes = {};
  list.forEach((incident) => {
    changes[`incidents/${incident.id}`] = incident;
  });
  try {
    await update(ref(db), changes);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}
