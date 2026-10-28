/* ------------------------------------------------------------------
   Shared constants and helpers for the Incident Reports screens.

   Incidents now live in Firebase at  /incidents/{id}  (see incidentService.js).
   Rescue teams come from  /rescueTeams  (useTeams hook), not from this file.

   SEED_INCIDENTS at the bottom is only the sample data that the
   "Load sample incidents" button saves into Firebase (one time).
------------------------------------------------------------------- */

export const PRIORITIES = ["Critical", "High", "Medium", "Low"];

export const INCIDENT_TYPES = [
  "Flood",
  "Fire",
  "Landslide",
  "Earthquake",
  "Medical emergency",
  "Road hazard",
  "Power line",
  "Other",
];

// All statuses are saved exactly as written here, in this order of the report's life:
//   Pending -> Verified -> Awaiting Assignment -> Team Assigned -> In Progress -> Resolved -> Closed
// Duplicate and Rejected are the two ways a report can leave that path early.
//   Pending              = just submitted, waiting for an admin to check it
//   Verified             = admin confirmed the report is real
//   Awaiting Assignment  = verified and queued, no rescue team yet
//   Team Assigned        = a team was dispatched (team id is saved on the report)
//   In Progress          = the team is on site working on it
//   Resolved             = the response is finished
//   Closed               = resolved and signed off by an admin (final)
//   Duplicate / Rejected = not acted on
export const STATUSES = [
  "Pending",
  "Verified",
  "Awaiting Assignment",
  "Team Assigned",
  "In Progress",
  "Resolved",
  "Duplicate",
  "Rejected",
  "Closed",
];

// Reports that still need work (shown on the map, counted as "active").
export const OPEN_STATUSES = ["Pending", "Verified", "Awaiting Assignment", "Team Assigned", "In Progress"];
// Reports a rescue team can be sent to.
export const DISPATCHABLE_STATUSES = ["Verified", "Awaiting Assignment"];
// Reports that have a team working on them right now.
export const ACTIVE_TEAM_STATUSES = ["Team Assigned", "In Progress"];

// Kept so every screen can keep calling statusLabel(); saved values are now the labels themselves.
export const statusLabel = (status) => status;

// Tabs above the table.
export const TABS = [
  { key: "all", label: "All" },
  ...STATUSES.map((s) => ({ key: s, label: s })),
];

/** Reports already marked "Duplicate" of `id` (other residents who reported the same incident). */
export function duplicatesOf(id, incidents) {
  return incidents
    .filter((i) => i.id !== id && i.status === "Duplicate" && i.duplicateOf === id)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** Minutes since an ISO timestamp (never negative). */
export function minutesSince(iso, now = Date.now()) {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 60000)) : 0;
}

/** ISO timestamp -> "4 min ago", "2 hr ago", "Just now" */
export function ago(iso) {
  const minutes = minutesSince(iso);
  if (minutes <= 0) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/** 14.65071, 121.10294 -> "14.6507, 121.1029" */
export function formatCoords(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "No GPS";
}

// One map point per town (the sample places below only name the town, so every
// report starts from its town's point and gets a small offset in pointFor).
const BULACAN_TOWNS = {
  Malolos: [14.8527, 120.816],
  Meycauayan: [14.737, 120.9608],
  Marilao: [14.7581, 120.9483],
  Bocaue: [14.799, 120.9264],
  Balagtas: [14.815, 120.9086],
  Guiguinto: [14.8333, 120.8789],
  Plaridel: [14.8869, 120.8564],
  Pulilan: [14.8987, 120.8478],
  Calumpit: [14.916, 120.765],
  Hagonoy: [14.8333, 120.7333],
  Paombong: [14.8333, 120.7833],
  Bulakan: [14.7936, 120.8795],
  Obando: [14.7058, 120.9272],
  "Santa Maria": [14.819, 121.011],
  "San Jose del Monte": [14.8139, 121.0453],
  Norzagaray: [14.915, 121.045],
  Angat: [14.9333, 121.0333],
  Baliuag: [14.9548, 120.8975],
  "San Rafael": [14.9833, 120.9333],
  "San Ildefonso": [15.0775, 120.9411],
};

function coordsFor(location) {
  const town = Object.keys(BULACAN_TOWNS).find((name) => location.includes(name));
  const [lat, lng] = BULACAN_TOWNS[town] || BULACAN_TOWNS.Malolos; // Malolos = provincial capital
  return `${lat}, ${lng}`;
}

// [id, type, location, reporter, phone, priority, status, minutesAgo,
//  description, photos, team, duplicateOf, match%]
// The sample places above share one point per area, so every report gets a small
// stable offset (about +/- 400 m, worked out from its id). Real reports carry
// their own lat/lng from the phone's GPS (or the pin the resident placed).
function pointFor(id, location) {
  const [baseLat, baseLng] = coordsFor(location).split(",").map(Number);
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    lat: baseLat + ((hash % 100) - 50) / 12500,
    lng: baseLng + ((Math.floor(hash / 100) % 100) - 50) / 12500,
  };
}

// Sample data only. "minutesAgo" is turned into real ISO timestamps (createdAt and
// the activity "at" values) when the list is built, so the saved records match what
// the app writes for real reports. team = a team id from /rescueTeams ("T-01").
const iso = (minutesAgo, now) => new Date(now - minutesAgo * 60000).toISOString();

const mk = (now) => ([
  id, type, location, reporter, phone, priority, status, minutesAgo,
  description, photos = 0, team = null, duplicateOf = null, match = null,
]) => {
  const incident = {
    id, type, location, reporter, phone, priority, status,
    description, photos,
    ...pointFor(id, location), // lat, lng (numbers)
    createdAt: iso(minutesAgo, now),
    activity: [
      { text: `Report submitted by ${reporter}`, at: iso(minutesAgo, now) },
      ...(duplicateOf ? [{ text: `Flagged as possible duplicate of ${duplicateOf}`, at: iso(minutesAgo, now) }] : []),
      ...(status !== "Pending" ? [{ text: `Status set to ${status}`, at: iso(Math.max(minutesAgo - 3, 0), now) }] : []),
    ],
  };
  // Firebase does not keep empty fields, so only add these when they have a value.
  if (team) incident.team = team;
  if (duplicateOf) incident.duplicateOf = duplicateOf;
  if (match) incident.match = match;
  return incident;
};

const ROWS = [
  ["DT-1042", "Flood", "Brgy. Frances, Calumpit", "Juan Santos", "0917 *** 4521", "Critical", "Pending", 4,
    "Water level is rising fast along the main road. About 15 households are already affected, including children and elderly residents who need evacuation.", 3],
  ["DT-1041", "Fire", "Brgy. Muzon, San Jose del Monte", "Maria Reyes", "0928 *** 1187", "Critical", "Team Assigned", 11,
    "Fire is spreading from a two-storey house to the neighboring homes. Neighbors are using buckets while waiting for responders.", 2, "T-02"],
  ["DT-1040", "Landslide", "Brgy. Bitungol, Norzagaray", "Carlo Mendoza", "0915 *** 9032", "High", "Verified", 26,
    "Soil and rocks blocked the barangay road after heavy rain. Two houses near the slope are at risk of collapsing.", 4],
  ["DT-1043", "Flood", "MacArthur Highway, Meycauayan", "Nina Co", "0917 *** 8830", "Low", "Pending", 31,
    "Another report of the flooded stretch near the MacArthur Highway overpass. Vehicles are slowing down but passing.", 1, null, "DT-1038", 92],
  ["DT-1039", "Road hazard", "MacArthur Highway, Marilao", "Ana Cruz", "0919 *** 7714", "Medium", "Resolved", 52,
    "Two fallen trees are blocking the right lane after strong winds.", 2, "T-01"],
  ["DT-1038", "Flood", "MacArthur Highway, Meycauayan", "Leo Garcia", "0926 *** 3358", "Low", "Duplicate", 58,
    "Knee-deep floodwater on the service road near the overpass.", 1, null, "DT-1043", 92],
  ["DT-1037", "Medical emergency", "Brgy. Poblacion, Baliuag", "Ben Tan", "0905 *** 6620", "Critical", "In Progress", 62,
    "A resident collapsed inside a wet market. Neighbors are doing CPR while waiting for the ambulance.", 0, "T-05"],
  ["DT-1036", "Power line", "Brgy. Lolomboy, Bocaue", "Rosa Diaz", "0918 *** 4409", "Medium", "Pending", 95,
    "A live wire is hanging low across the street after strong winds. Residents are keeping children away.", 2],
  ["DT-1035", "Earthquake", "Brgy. Longos, Malolos", "Pia Lim", "0921 *** 5571", "High", "Awaiting Assignment", 70,
    "Cracks appeared on the wall of a three-storey building after the tremor. Occupants moved outside.", 3],
  ["DT-1034", "Fire", "Brgy. Banga, Plaridel", "Mark Villanueva", "0933 *** 2210", "High", "Resolved", 190,
    "Small fire in a junk shop, already controlled by neighbors. Requesting inspection for hot spots.", 1, "T-02"],
  ["DT-1033", "Flood", "Brgy. San Sebastian, Hagonoy", "Joy Bautista", "0927 *** 7788", "Critical", "Resolved", 240,
    "Flooding reached the second floor of several houses. Families were waiting on rooftops.", 4, "T-01"],
  ["DT-1032", "Landslide", "Brgy. Banaban, Angat", "Ramon Dizon", "0916 *** 1043", "High", "Team Assigned", 130,
    "Part of a hillside gave way and covered a footpath. Residents below are asking for assessment.", 2, "T-07"],
  ["DT-1031", "Road hazard", "MacArthur Highway, Guiguinto", "Ella Ramos", "0935 *** 9921", "Medium", "Closed", 300,
    "Large sinkhole forming on the outer lane near the flyover.", 2],
  ["DT-1030", "Other", "Brgy. Poblacion, Pulilan", "Tess Cruz", "0912 *** 3307", "Low", "Rejected", 360,
    "Report did not include a valid location or details.", 0],
  ["DT-1029", "Flood", "Brgy. Poblacion, Paombong", "Paolo Reyes", "0917 *** 6015", "High", "Pending", 15,
    "Creek overflowed and water is entering ground-floor homes along the riverbank.", 2],
  ["DT-1028", "Fire", "Brgy. Tarcan, Baliuag", "Dina Salvador", "0920 *** 8842", "Medium", "Awaiting Assignment", 45,
    "Smoke coming from a roadside food stall. Gas tank is nearby.", 1],
  ["DT-1027", "Medical emergency", "Brgy. Pulong Buhangin, Santa Maria", "Carl Uy", "0908 *** 2754", "Medium", "Resolved", 400,
    "Elderly resident with difficulty breathing after smoke exposure.", 0, "T-05"],
  ["DT-1026", "Power line", "Brgy. Tabing Ilog, Marilao", "Hana Lee", "0929 *** 5532", "Low", "Closed", 480,
    "Sparking transformer reported by several neighbors, already isolated.", 1],
  ["DT-1025", "Flood", "Brgy. Sumapang Matanda, Malolos", "Ivan Go", "0922 *** 1096", "Critical", "Awaiting Assignment", 20,
    "Water is waist-deep in the barangay hall area, about 40 residents stranded.", 3],
];

/** The sample incidents, with timestamps counted back from "now". */
export const seedIncidents = (now = Date.now()) => ROWS.map(mk(now));
