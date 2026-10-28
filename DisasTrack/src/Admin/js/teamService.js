/* ------------------------------------------------------------------
   Everything that talks to Firebase about rescue TEAMS lives here.

   Teams are saved at  /rescueTeams/{id}   (id looks like "T-01"):
     { name, type, leader, phone, base, status, assignment, createdAt }

   The people in a team are normal accounts (role "Rescue Team") saved under
   /users/RescueTeamMembers/{uid}. Each of them has  team  (the team name)
   and  teamId  (the team id), so a team's members are the accounts whose
   team name matches. Add members on the Users screen.
------------------------------------------------------------------- */
import { onValue, ref, remove, update } from "firebase/database";
import { db } from "../../firebase.js";
import { accountPath, friendlyMessage } from "./accountService.js";

// Calls callback(list, error) every time /rescueTeams changes. Returns a function that stops listening.
export function watchTeams(callback) {
  return onValue(
    ref(db, "rescueTeams"),
    (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      callback(list, null);
    },
    (err) => callback([], new Error(friendlyMessage(err)))
  );
}

// Adds a team. teams = the current list (used to pick the next id). Returns the new id.
export async function createTeam(values, teams) {
  const next = Math.max(0, ...teams.map((t) => Number(String(t.id).replace(/\D/g, "")) || 0)) + 1;
  const id = `T-${String(next).padStart(2, "0")}`;
  try {
    await update(ref(db), {
      [`rescueTeams/${id}`]: { ...values, createdAt: new Date().toISOString() },
    });
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
  return id;
}

// Edits a team. If the NAME changes, the members' "team" field is renamed too,
// in the same save, so nobody is left pointing at an old name.
//   accounts = all accounts (to find the members)
export async function updateTeam(team, values, accounts = []) {
  const changes = {};
  Object.entries(values).forEach(([key, value]) => {
    changes[`rescueTeams/${team.id}/${key}`] = value;
  });
  if (values.name && values.name !== team.name) {
    accounts
      .filter((a) => a.role === "Rescue Team" && a.team === team.name)
      .forEach((a) => {
        changes[`${accountPath(a)}/team`] = values.name;
      });
  }
  try {
    await update(ref(db), changes);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

export async function setTeamStatus(id, status) {
  try {
    await update(ref(db, `rescueTeams/${id}`), { status });
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// Called when an incident is dispatched or finished:
//   incidentId = "DT-1042"  -> the team is "Deployed" and its assignment is that incident
//   incidentId = null       -> the team is "Available" again and the assignment is cleared
// (The Dashboard counts and the Live Map's dispatch lines read these two fields.)
export async function setTeamAssignment(id, incidentId) {
  try {
    await update(ref(db, `rescueTeams/${id}`), {
      status: incidentId ? "Deployed" : "Available",
      assignment: incidentId || null,
    });
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

export async function deleteTeam(team) {
  try {
    await remove(ref(db, `rescueTeams/${team.id}`));
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// ---------- live locations ----------
// A team's phone writes its position at  /rescueTeams/{id}/location = { lat, lng, updatedAt }.
// Until the rescue team app does that, the Live Map's "Simulate" button writes it.

// positions = { "T-01": { lat, lng }, ... }  (saved in one update)
export async function setTeamLocations(positions) {
  const changes = {};
  const now = Date.now();
  Object.entries(positions).forEach(([id, { lat, lng }]) => {
    changes[`rescueTeams/${id}/location`] = { lat, lng, updatedAt: now };
  });
  try {
    await update(ref(db), changes);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// Removes the saved location of the given teams.
export async function clearTeamLocations(teams) {
  const changes = {};
  teams.forEach((t) => {
    changes[`rescueTeams/${t.id}/location`] = null;
  });
  try {
    await update(ref(db), changes);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}
