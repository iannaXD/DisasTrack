/* ------------------------------------------------------------------
   Everything that talks to Firebase about RESPONSE OUTCOMES lives here.

   An outcome is saved INSIDE its incident, at  /incidents/{id}/outcome :
     peopleRescued  number (whole number, 0 or more)
     notes          text (optional, up to 1000 characters)
     completedAt    ISO timestamp (when the rescue work finished)
     recordedBy     name of the person who saved it
     sample         true ONLY on test records made by the "Add sample outcomes" button

   Rescue teams will record outcomes from their own interface later; until
   then, admins can record and edit them on the Response Outcomes screen.
------------------------------------------------------------------- */
import { ref, update } from "firebase/database";
import { db } from "../../firebase.js";
import { friendlyMessage } from "../js/accountService.js";
import { logAction } from "../Audit/auditLog.js";

// Incidents in these statuses can have an outcome.
export const OUTCOME_STATUSES = ["In Progress", "Resolved", "Closed"];

// Saves (or replaces) the outcome of one incident.
//   values = { peopleRescued, notes, completedAt }
export async function saveOutcome(incident, values, recordedBy) {
  const isNew = !incident.outcome;
  const outcome = {
    peopleRescued: values.peopleRescued,
    completedAt: values.completedAt,
    recordedBy: recordedBy || "Admin",
  };
  if (values.notes) outcome.notes = values.notes; // empty notes are simply left out
  try {
    // Saving a whole new object also removes the "sample" mark if the record had one.
    await update(ref(db), { [`incidents/${incident.id}/outcome`]: outcome });
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
  logAction({
    category: "Incident",
    action: isNew ? "Outcome recorded" : "Outcome updated",
    target: incident.id,
    details: `${values.peopleRescued} people rescued`,
  });
}

// ---------- sample (test) data ----------

// Fake numbers and notes used by the sample button.
const SAMPLE_COUNTS = [12, 5, 8, 3, 20];
const SAMPLE_NOTES = [
  "Residents moved to the barangay hall. No injuries reported.",
  "Two people treated on site for minor injuries.",
  "Area cleared and handed over to the barangay.",
  "Family of five evacuated safely.",
  "Operation finished ahead of schedule.",
];

// Adds sample outcomes to up to 5 finished incidents that have none yet.
export async function addSampleOutcomes(incidents) {
  const targets = incidents
    .filter((i) => (i.status === "Resolved" || i.status === "Closed") && !i.outcome)
    .slice(0, 5);
  if (targets.length === 0) {
    throw new Error("There are no resolved or closed reports without an outcome. Resolve a report first.");
  }
  const changes = {};
  targets.forEach((incident, index) => {
    changes[`incidents/${incident.id}/outcome`] = {
      peopleRescued: SAMPLE_COUNTS[index],
      notes: SAMPLE_NOTES[index],
      completedAt: new Date(new Date(incident.createdAt).getTime() + 2 * 60 * 60 * 1000).toISOString(),
      recordedBy: "Sample data",
      sample: true,
    };
  });
  try {
    await update(ref(db), changes);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}

// Deletes every sample outcome (real outcomes are never touched).
export async function removeSampleOutcomes(incidents) {
  const changes = {};
  incidents.forEach((incident) => {
    if (incident.outcome?.sample) changes[`incidents/${incident.id}/outcome`] = null; // null deletes
  });
  if (Object.keys(changes).length === 0) return;
  try {
    await update(ref(db), changes);
  } catch (err) {
    throw new Error(friendlyMessage(err));
  }
}
