/* ------------------------------------------------------------------
   Constants for the Rescue Teams screen.
   The teams themselves come from Firebase (/rescueTeams).
------------------------------------------------------------------- */

export const STATUSES = ["Available", "Standby", "Deployed", "Off duty"];

// Statuses an admin can pick by hand. "Deployed" is set by dispatching a team
// from an incident report, so it is not in this list.
export const MANUAL_STATUSES = ["Available", "Standby", "Off duty"];

// The kinds of team. Add a new one here and it shows up in the Add team form.
export const TEAM_TYPES = ["Firefighters", "Police", "Medical", "Road Officers"];
