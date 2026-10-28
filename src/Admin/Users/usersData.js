/* ------------------------------------------------------------------
   Constants for the Users screen.
   The accounts themselves come from Firebase (/users).

   Admins are NOT added here (they are created in the Firebase console).
   Whole rescue teams are managed in the Rescue Teams screen; here you add the
   individual people (members) of those teams.
   Old Dispatcher accounts are hidden (the Dispatchers screen was removed).
------------------------------------------------------------------- */

// "Rescue Team" is the value stored in Firebase; on screen it reads "Rescue Team Member".
export const ROLES = ["Resident", "Rescue Team", "Disaster Management Officer"];

export function roleLabel(role) {
  return role === "Rescue Team" ? "Rescue Team Member" : role;
}
export const STATUSES = ["Active", "Suspended"];

