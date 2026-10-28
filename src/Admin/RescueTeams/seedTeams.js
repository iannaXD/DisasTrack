/* ------------------------------------------------------------------
   One-time setup: saves the default teams in Firebase, then creates one
   sign-in account + profile for every member (same as the Users screen's
   "Add user"). People who already exist (same username) are skipped, so it
   is safe to run again after a failure.
------------------------------------------------------------------- */
import { ref, update } from "firebase/database";
import { db } from "../../firebase.js";
import { createAccount, friendlyMessage } from "../js/accountService.js";
import { DEFAULT_TEAMS, TOTAL_MEMBERS } from "./defaultTeams.js";

/**
 * password          = temporary password given to every new member (8+ characters)
 * existingUsernames = usernames that already exist (lowercase)
 * onProgress(done, total) is called after each member
 */
export async function seedDefaultTeams({ password, existingUsernames, onProgress }) {
  // 1. The teams first. If the database rules don't allow it, this fails right away
  //    and no accounts have been created yet.
  const now = new Date().toISOString();
  const changes = {};
  DEFAULT_TEAMS.forEach((t) => {
    changes[`rescueTeams/${t.id}`] = {
      name: t.name,
      type: t.type,
      leader: t.members[0].name,
      phone: t.members[0].phone,
      base: t.base,
      status: "Available",
      createdAt: now,
    };
  });
  try {
    await update(ref(db), changes);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }

  // 2. The members, one at a time.
  const existing = new Set(existingUsernames);
  let done = 0;
  for (const team of DEFAULT_TEAMS) {
    for (const person of team.members) {
      if (!existing.has(person.username.toLowerCase())) {
        try {
          await createAccount(
            {
              name: person.name,
              username: person.username,
              email: person.email,
              phone: person.phone,
              role: "Rescue Team",
              address: "",
              team: team.name,
              teamId: team.id,
              status: "Active",
            },
            password
          );
        } catch (err) {
          throw new Error(`${person.name} (${person.username}): ${err.message}`);
        }
      }
      done += 1;
      onProgress?.(done, TOTAL_MEMBERS);
    }
  }
  return TOTAL_MEMBERS;
}
