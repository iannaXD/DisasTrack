# DisasTrack – Firebase setup

Project: `disastrackdb` · Realtime Database: https://disastrackdb-default-rtdb.firebaseio.com
Coverage: **Bulacan province only** (map, sample data and coordinate checks are all set to Bulacan).

## 1. One-time console steps (do these once, for the whole team)
1. **Authentication → Sign-in method → Email/Password → Enable.**
2. **Authentication → Users → Add user** for the first admin:
   - Email: `<your-username>@disastrack.app`  (example: `admin@disastrack.app`)
   - Password: pick a strong one (at least 8 characters)
   - Copy the **User UID** shown in the table.
3. **Realtime Database → Data tab.** Hover the root, click **+**, and add a child named `users`.
   Inside it add a child named with your UID (paste it), then add these fields:
   ```
   name:      "Your Name"
   username:  "admin"
   email:     "your-real-email@mail.com"
   phone:     "09xx xxx xxxx"
   role:      "Admin"
   status:    "Active"
   createdAt: "2026-10-18T09:00:00.000Z"
   ```
   (The username must match the part before `@disastrack.app` in step 2.)
   This first admin sits directly at `/users/{uid}` (a "legacy" account). The rules accept it
   through its `role` field. After signing in, click **Move into role folders** on the Users screen.
4. **Realtime Database → Rules.** Paste the contents of `database.rules.json`, then **Publish**.
   If your rules were published before the notification bell was added, also add the
   `notificationReads` block from `database.rules.notifications.json` (see section 8), then **Publish** again.
5. **First-time data (once):**
   - Rescue Teams → **Set up default teams** (creates `T-01` to `T-08` and their member accounts).
   - Incident Reports → **Load sample incidents** (19 Bulacan samples).
   - If the database still has old Quezon City / Marikina data, delete `/incidents` and
     `/rescueTeams` first, then run both buttons again.

## 2. How sign-in works
People type a **username**. The app turns it into `username@disastrack.app` for Firebase Auth.
The real email is only stored in the profile. Because of this, the sign-in screen has no "Forgot password" link;
an admin resets passwords in Authentication → Users → (⋮) → Reset password.

## 3. Database structure (shared by the team)
```
/users/Admins/{uid}                       one folder per role; each child is one person
/users/Residents/{uid}                    (the folder name is only a way to organize them)
/users/DisasterManagementOfficers/{uid}
/users/RescueTeamMembers/{uid}
      fields: name, username, email, phone, role, status, createdAt, lastLogin, photo, office
              role = Admin | Resident | Disaster Management Officer | Rescue Team
              status = Active | Suspended
              Rescue Team: team (name), teamId ("T-01")      Resident: address
/userRoles/{uid}    "Admin" | "Resident" | "Disaster Management Officer" | "Rescue Team"
                    (lookup: gives a person's role from their uid, so the app knows which folder to read)
/auditLogs/{id}     timestamp, actor, actorId, role, category, action, target, details
/notificationReads/{uid}   lastReadAt (ISO)   where this admin or officer last read the notification bell
/incidents/{id}     id ("DT-1042"), type, location, reporter, reporterId, phone, priority, status,
                    description, photos, lat, lng, team ("T-01"), duplicateOf, match, createdAt,
                    activity[] = { text, at }
                    priority = Critical | High | Medium | Low
                    status   = Pending | Verified | Awaiting Assignment | Team Assigned | In Progress |
                               Resolved | Duplicate | Rejected | Closed   (see "Incident statuses" below)
/rescueTeams/{id}   name, type, leader, phone, base, status, assignment, createdAt,
                    location = { lat, lng, updatedAt }   (written by the team's phone)
                    status = Available | Standby | Deployed | Off duty
```
Timestamps are ISO strings (`new Date().toISOString()`), except `location.updatedAt`, which is a number
(`Date.now()`). Firebase does not store empty fields, so a missing `team` or `duplicateOf` means "none".

### Incident statuses
Statuses are saved exactly as written (no hidden renaming). A report normally moves through this path:

`Pending` → `Verified` → `Awaiting Assignment` → `Team Assigned` → `In Progress` → `Resolved` → `Closed`

`Duplicate` and `Rejected` are the two ways a report can leave that path without being acted on.

| Status | Meaning | Who sets it |
|---|---|---|
| Pending | Just submitted, waiting for an admin to check it | Resident app (on create) |
| Verified | Admin confirmed the report is real | Admin |
| Awaiting Assignment | Verified and queued, no rescue team yet | Admin |
| Team Assigned | A team was dispatched (`team` is set on the incident) | Admin (Dispatch) |
| In Progress | The team is on site working on it | Admin or the assigned rescue team |
| Resolved | The response is finished (the team is set back to Available) | Admin or the assigned rescue team |
| Closed | Resolved and signed off (final) | Admin |
| Duplicate | Same incident as another report (`duplicateOf`) | Admin |
| Rejected | Not a valid report | Admin |

Notes:
- A team can only be dispatched from `Verified` or `Awaiting Assignment`.
- "Active" (map, dashboard, stats) means `Pending`, `Verified`, `Awaiting Assignment`, `Team Assigned` or `In Progress`.
- Admins can reopen a `Resolved`, `Closed`, `Rejected` or `Duplicate` report.
- Older records are not converted. Before this change, `Verified` was shown as "Awaiting Assignment" and
  `In Progress` was shown as "Team Assigned". Old `Verified` / `In Progress` records now show under their own names.

## 4. Who can do what (summary of `database.rules.json`)
| Data | Admin | Disaster Mgmt Officer | Rescue Team | Resident |
|---|---|---|---|---|
| `/users`, `/userRoles` | read + write all | – | own profile only | own profile only |
| `/auditLogs` | read; write own entries | read; write own entries | write own entries | write own entries |
| `/incidents` | read + write all | read only (view only, cannot change anything) | read all; update `status` and `activity` of incidents assigned to their team | create (as `Pending`); read own (needs `reporterId`) |
| `/rescueTeams` | read + write all | read only | read all; write own team's `location` and `status` | – |
| `/notificationReads/{uid}` | read + write own marker only | read + write own marker only | – | – |

Other rules worth knowing:
- Audit entries can only be created (never edited or deleted), and `actorId` must be the writer's own uid.
- A user can only edit their own profile fields (name, email, phone, office, photo, lastLogin), and only
  in the folder that matches their role in `/userRoles`.
- Values are checked: priority, status and role must be from the lists above, and text fields have length limits.
  If you add a new status, add it to the `status` `.validate` line in `database.rules.json` and publish the rules,
  otherwise saving fails with `permission_denied`.
- `/notificationReads/{uid}` can only be read or written by that same admin or Disaster Management Officer, and only
  holds `lastReadAt` (a text timestamp). Nobody else, including other admins, can touch it.
- `lat`/`lng` must be inside a box around Bulacan (lat 14.6 to 15.35, lng 120.65 to 121.4).
  To allow anywhere, remove the `LAT` / `LNG` `.validate` lines in the rules.

## 5. Using Firebase in your own screens
```js
import { db } from "../firebase.js";
import { ref, onValue, push, update } from "firebase/database";
```
Incidents and teams already have helpers, so use these instead of writing your own:
- `Admin/IncidentReports/incidentService.js` (`watchIncidents`, `updateIncident`, `createIncident`)
- `Admin/js/teamService.js` (`watchTeams`, `setTeamAssignment`, `setTeamLocations`)

## 6. Role folders (read this if you read /users in your own code)
- To find the signed-in person: read `/userRoles/{uid}` first, then `/users/{folder}/{uid}`
  (Residents, DisasterManagementOfficers, RescueTeamMembers, Admins).
- Accounts created before the folders existed sit directly at `/users/{uid}`. On the Users screen,
  an admin clicks **Move into role folders** once to move them.
- When publishing `database.rules.json`, an admin must also be recognized by the old `role` field
  until their account is moved; that is why the rules check both places.

## 7. For the resident and rescue-team apps
- **Resident app:** write new reports to `/incidents/{id}` with `status: "Pending"`, an ISO `createdAt`,
  numeric `lat` / `lng`, and `reporterId` (the resident's uid). Without `reporterId` the resident cannot
  read their own report back. Reports without `lat`/`lng` show in lists but not on the maps.
- **Rescue team app:** the member's profile needs a `teamId` (set automatically when an admin adds
  them on the Users screen). Without it, their location and status writes are rejected.
  Write the position to `/rescueTeams/{teamId}/location` as `{ lat, lng, updatedAt: Date.now() }`.
- **Rescue team app, statuses:** an incident assigned to the team arrives as `Team Assigned`. When the team
  arrives, set `status: "In Progress"`; when finished, set `status: "Resolved"`. Add a line to `activity[]`
  (`{ text, at }`) for each change. Only the team named in the incident's `team` field can write these.

## 8. Notifications (the bell in the admin top bar)
The bell tells an admin (and the Disaster Management Officer) when something new was added:

| Notification | Triggered by | Opens |
|---|---|---|
| New incident report | a new record in `/incidents` (admin form or the resident app) | that report |
| New user created | a new account in `/users/...` | Users screen (admin only) |
| New rescue team created | a new record in `/rescueTeams` | Rescue Teams screen (officer: Live Map) |

How it works:
- **Nothing is copied into a notifications list.** The bell is built live from `createdAt` on the three
  places above, so reports sent by the resident app while no admin is signed in are still caught.
  This means every new record **must have an ISO `createdAt`** (the resident app already does this for incidents).
- Each admin has their own read marker at `/notificationReads/{uid}/lastReadAt`. Anything created after it is
  unread. **Mark all as read** moves the marker to "now". One admin reading does not clear it for others.
- A pop-up (toast) also appears when something arrives while the page is open. If several arrive at once
  (for example **Load sample incidents** or **Set up default teams**), you get one summary pop-up per kind.
- The first time an admin signs in, everything already in the database counts as read.
- If the rules block below is not published yet, the bell still works for this session (live arrivals only),
  but the "read" state is not remembered after a refresh.
- The officer's bell works the same way, but it cannot list new users (officers cannot read `/users`), and its
  links open `/officer/...` screens.
- The list shows the 30 newest items. Code lives in `Admin/Notifications/`.

Rules block. It is already merged into `database.rules.json` (between `userRoles` and `auditLogs`).
The same block is also saved alone as `database.rules.notifications.json`:
```json
"notificationReads": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid && (root.child('userRoles').child(auth.uid).val() === 'Admin' || root.child('userRoles').child(auth.uid).val() === 'Disaster Management Officer' || root.child('users').child(auth.uid).child('role').val() === 'Admin')",
    ".validate": "newData.hasChildren(['lastReadAt'])",
    "lastReadAt": { ".validate": "newData.isString() && newData.val().length <= 40" },
    "$other": { ".validate": false }
  }
}
```
The write check accepts an admin through `/userRoles` or the old `role` field, the same way the other rules do,
and also a Disaster Management Officer (through `/userRoles`).

## 9. Disaster Management Officer console (`/officer`)
Signed-in users whose role is `Disaster Management Officer` land on `/officer` (admins land on `/admin`).
The officer console is **view only**: it reads live data and never writes incidents or teams.

| Screen | What it shows | Data it reads |
|---|---|---|
| Overview | Totals, live map, response pipeline, reports last 7 days, by type, recent reports | `/incidents`, `/rescueTeams` |
| Incident Reports | The admin list and detail screens in read-only mode (search, filters, CSV export; no verify, reject, priority, dispatch or status buttons) | `/incidents`, `/rescueTeams` |
| Operations Monitor | Active incidents (Verified, Awaiting Assignment, Team Assigned, In Progress), the assigned team, a progress tracker, activity log, recently completed | `/incidents`, `/rescueTeams` |
| Incident Trends, Response Outcomes, Reports & Stats | Statistics and outcomes | `/incidents` |
| Live Map | Same map as the admin (Bulacan only), no "Review report" button | `/incidents`, `/rescueTeams` |
| Profile | Own account details | `/users/DisasterManagementOfficers/{uid}` |

Notes for developers:
- `IncidentReports` and `IncidentDetail` take two props: `readOnly` (hides every action) and `basePath`
  (`/officer/incident-reports` for the officer). The admin routes use the defaults, so nothing changes for admins.
- Hiding the buttons is only the screen. The database rules are what actually stop an officer from writing:
  there is no write rule for the officer role on `/incidents` or `/rescueTeams`.
- Create the first officer on the Users screen (role **Disaster Management Officer**); the account is saved in
  `/users/DisasterManagementOfficers/{uid}` and `/userRoles/{uid}`.# DisasTrack – Firebase setup

Project: `disastrackdb` · Realtime Database: https://disastrackdb-default-rtdb.firebaseio.com
Coverage: **Bulacan province only** (map, sample data and coordinate checks are all set to Bulacan).

## 1. One-time console steps (do these once, for the whole team)
1. **Authentication → Sign-in method → Email/Password → Enable.**
2. **Authentication → Users → Add user** for the first admin:
   - Email: `<your-username>@disastrack.app`  (example: `admin@disastrack.app`)
   - Password: pick a strong one (at least 8 characters)
   - Copy the **User UID** shown in the table.
3. **Realtime Database → Data tab.** Hover the root, click **+**, and add a child named `users`.
   Inside it add a child named with your UID (paste it), then add these fields:
   ```
   name:      "Your Name"
   username:  "admin"
   email:     "your-real-email@mail.com"
   phone:     "09xx xxx xxxx"
   role:      "Admin"
   status:    "Active"
   createdAt: "2026-10-18T09:00:00.000Z"
   ```
   (The username must match the part before `@disastrack.app` in step 2.)
   This first admin sits directly at `/users/{uid}` (a "legacy" account). The rules accept it
   through its `role` field. After signing in, click **Move into role folders** on the Users screen.
4. **Realtime Database → Rules.** Paste the contents of `database.rules.json`, then **Publish**.
   If your rules were published before the notification bell was added, also add the
   `notificationReads` block from `database.rules.notifications.json` (see section 8), then **Publish** again.
5. **First-time data (once):**
   - Rescue Teams → **Set up default teams** (creates `T-01` to `T-08` and their member accounts).
   - Incident Reports → **Load sample incidents** (19 Bulacan samples).
   - If the database still has old Quezon City / Marikina data, delete `/incidents` and
     `/rescueTeams` first, then run both buttons again.

## 2. How sign-in works
People type a **username**. The app turns it into `username@disastrack.app` for Firebase Auth.
The real email is only stored in the profile. Because of this, the sign-in screen has no "Forgot password" link;
an admin resets passwords in Authentication → Users → (⋮) → Reset password.

## 3. Database structure (shared by the team)
```
/users/Admins/{uid}                       one folder per role; each child is one person
/users/Residents/{uid}                    (the folder name is only a way to organize them)
/users/DisasterManagementOfficers/{uid}
/users/RescueTeamMembers/{uid}
      fields: name, username, email, phone, role, status, createdAt, lastLogin, photo, office
              role = Admin | Resident | Disaster Management Officer | Rescue Team
              status = Active | Suspended
              Rescue Team: team (name), teamId ("T-01")      Resident: address
/userRoles/{uid}    "Admin" | "Resident" | "Disaster Management Officer" | "Rescue Team"
                    (lookup: gives a person's role from their uid, so the app knows which folder to read)
/auditLogs/{id}     timestamp, actor, actorId, role, category, action, target, details
/notificationReads/{uid}   lastReadAt (ISO)   where this admin or officer last read the notification bell
/incidents/{id}     id ("DT-1042"), type, location, reporter, reporterId, phone, priority, status,
                    description, photos, lat, lng, team ("T-01"), duplicateOf, match, createdAt,
                    activity[] = { text, at }
                    priority = Critical | High | Medium | Low
                    status   = Pending | Verified | Awaiting Assignment | Team Assigned | In Progress |
                               Resolved | Duplicate | Rejected | Closed   (see "Incident statuses" below)
/rescueTeams/{id}   name, type, leader, phone, base, status, assignment, createdAt,
                    location = { lat, lng, updatedAt }   (written by the team's phone)
                    status = Available | Standby | Deployed | Off duty
```
Timestamps are ISO strings (`new Date().toISOString()`), except `location.updatedAt`, which is a number
(`Date.now()`). Firebase does not store empty fields, so a missing `team` or `duplicateOf` means "none".

### Incident statuses
Statuses are saved exactly as written (no hidden renaming). A report normally moves through this path:

`Pending` → `Verified` → `Awaiting Assignment` → `Team Assigned` → `In Progress` → `Resolved` → `Closed`

`Duplicate` and `Rejected` are the two ways a report can leave that path without being acted on.

| Status | Meaning | Who sets it |
|---|---|---|
| Pending | Just submitted, waiting for an admin to check it | Resident app (on create) |
| Verified | Admin confirmed the report is real | Admin |
| Awaiting Assignment | Verified and queued, no rescue team yet | Admin |
| Team Assigned | A team was dispatched (`team` is set on the incident) | Admin (Dispatch) |
| In Progress | The team is on site working on it | Admin or the assigned rescue team |
| Resolved | The response is finished (the team is set back to Available) | Admin or the assigned rescue team |
| Closed | Resolved and signed off (final) | Admin |
| Duplicate | Same incident as another report (`duplicateOf`) | Admin |
| Rejected | Not a valid report | Admin |

Notes:
- A team can only be dispatched from `Verified` or `Awaiting Assignment`.
- "Active" (map, dashboard, stats) means `Pending`, `Verified`, `Awaiting Assignment`, `Team Assigned` or `In Progress`.
- Admins can reopen a `Resolved`, `Closed`, `Rejected` or `Duplicate` report.
- Older records are not converted. Before this change, `Verified` was shown as "Awaiting Assignment" and
  `In Progress` was shown as "Team Assigned". Old `Verified` / `In Progress` records now show under their own names.

## 4. Who can do what (summary of `database.rules.json`)
| Data | Admin | Disaster Mgmt Officer | Rescue Team | Resident |
|---|---|---|---|---|
| `/users`, `/userRoles` | read + write all | – | own profile only | own profile only |
| `/auditLogs` | read; write own entries | read; write own entries | write own entries | write own entries |
| `/incidents` | read + write all | read only (view only, cannot change anything) | read all; update `status` and `activity` of incidents assigned to their team | create (as `Pending`); read own (needs `reporterId`) |
| `/rescueTeams` | read + write all | read only | read all; write own team's `location` and `status` | – |
| `/notificationReads/{uid}` | read + write own marker only | read + write own marker only | – | – |

Other rules worth knowing:
- Audit entries can only be created (never edited or deleted), and `actorId` must be the writer's own uid.
- A user can only edit their own profile fields (name, email, phone, office, photo, lastLogin), and only
  in the folder that matches their role in `/userRoles`.
- Values are checked: priority, status and role must be from the lists above, and text fields have length limits.
  If you add a new status, add it to the `status` `.validate` line in `database.rules.json` and publish the rules,
  otherwise saving fails with `permission_denied`.
- `/notificationReads/{uid}` can only be read or written by that same admin or Disaster Management Officer, and only
  holds `lastReadAt` (a text timestamp). Nobody else, including other admins, can touch it.
- `lat`/`lng` must be inside a box around Bulacan (lat 14.6 to 15.35, lng 120.65 to 121.4).
  To allow anywhere, remove the `LAT` / `LNG` `.validate` lines in the rules.

## 5. Using Firebase in your own screens
```js
import { db } from "../firebase.js";
import { ref, onValue, push, update } from "firebase/database";
```
Incidents and teams already have helpers, so use these instead of writing your own:
- `Admin/IncidentReports/incidentService.js` (`watchIncidents`, `updateIncident`, `createIncident`)
- `Admin/js/teamService.js` (`watchTeams`, `setTeamAssignment`, `setTeamLocations`)

## 6. Role folders (read this if you read /users in your own code)
- To find the signed-in person: read `/userRoles/{uid}` first, then `/users/{folder}/{uid}`
  (Residents, DisasterManagementOfficers, RescueTeamMembers, Admins).
- Accounts created before the folders existed sit directly at `/users/{uid}`. On the Users screen,
  an admin clicks **Move into role folders** once to move them.
- When publishing `database.rules.json`, an admin must also be recognized by the old `role` field
  until their account is moved; that is why the rules check both places.

## 7. For the resident and rescue-team apps
- **Resident app:** write new reports to `/incidents/{id}` with `status: "Pending"`, an ISO `createdAt`,
  numeric `lat` / `lng`, and `reporterId` (the resident's uid). Without `reporterId` the resident cannot
  read their own report back. Reports without `lat`/`lng` show in lists but not on the maps.
- **Rescue team app:** the member's profile needs a `teamId` (set automatically when an admin adds
  them on the Users screen). Without it, their location and status writes are rejected.
  Write the position to `/rescueTeams/{teamId}/location` as `{ lat, lng, updatedAt: Date.now() }`.
- **Rescue team app, statuses:** an incident assigned to the team arrives as `Team Assigned`. When the team
  arrives, set `status: "In Progress"`; when finished, set `status: "Resolved"`. Add a line to `activity[]`
  (`{ text, at }`) for each change. Only the team named in the incident's `team` field can write these.

## 8. Notifications (the bell in the admin top bar)
The bell tells an admin (and the Disaster Management Officer) when something new was added:

| Notification | Triggered by | Opens |
|---|---|---|
| New incident report | a new record in `/incidents` (admin form or the resident app) | that report |
| New user created | a new account in `/users/...` | Users screen (admin only) |
| New rescue team created | a new record in `/rescueTeams` | Rescue Teams screen (officer: Live Map) |

How it works:
- **Nothing is copied into a notifications list.** The bell is built live from `createdAt` on the three
  places above, so reports sent by the resident app while no admin is signed in are still caught.
  This means every new record **must have an ISO `createdAt`** (the resident app already does this for incidents).
- Each admin has their own read marker at `/notificationReads/{uid}/lastReadAt`. Anything created after it is
  unread. **Mark all as read** moves the marker to "now". One admin reading does not clear it for others.
- A pop-up (toast) also appears when something arrives while the page is open. If several arrive at once
  (for example **Load sample incidents** or **Set up default teams**), you get one summary pop-up per kind.
- The first time an admin signs in, everything already in the database counts as read.
- If the rules block below is not published yet, the bell still works for this session (live arrivals only),
  but the "read" state is not remembered after a refresh.
- The officer's bell works the same way, but it cannot list new users (officers cannot read `/users`), and its
  links open `/officer/...` screens.
- The list shows the 30 newest items. Code lives in `Admin/Notifications/`.

Rules block. It is already merged into `database.rules.json` (between `userRoles` and `auditLogs`).
The same block is also saved alone as `database.rules.notifications.json`:
```json
"notificationReads": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": "auth != null && auth.uid === $uid && (root.child('userRoles').child(auth.uid).val() === 'Admin' || root.child('userRoles').child(auth.uid).val() === 'Disaster Management Officer' || root.child('users').child(auth.uid).child('role').val() === 'Admin')",
    ".validate": "newData.hasChildren(['lastReadAt'])",
    "lastReadAt": { ".validate": "newData.isString() && newData.val().length <= 40" },
    "$other": { ".validate": false }
  }
}
```
The write check accepts an admin through `/userRoles` or the old `role` field, the same way the other rules do,
and also a Disaster Management Officer (through `/userRoles`).

## 9. Disaster Management Officer console (`/officer`)
Signed-in users whose role is `Disaster Management Officer` land on `/officer` (admins land on `/admin`).
The officer console is **view only**: it reads live data and never writes incidents or teams.

| Screen | What it shows | Data it reads |
|---|---|---|
| Overview | Totals, live map, response pipeline, reports last 7 days, by type, recent reports | `/incidents`, `/rescueTeams` |
| Incident Reports | The admin list and detail screens in read-only mode (search, filters, CSV export; no verify, reject, priority, dispatch or status buttons) | `/incidents`, `/rescueTeams` |
| Operations Monitor | Active incidents (Verified, Awaiting Assignment, Team Assigned, In Progress), the assigned team, a progress tracker, activity log, recently completed | `/incidents`, `/rescueTeams` |
| Incident Trends, Response Outcomes, Reports & Stats | Statistics and outcomes | `/incidents` |
| Live Map | Same map as the admin (Bulacan only), no "Review report" button | `/incidents`, `/rescueTeams` |
| Profile | Own account details | `/users/DisasterManagementOfficers/{uid}` |

Notes for developers:
- `IncidentReports` and `IncidentDetail` take two props: `readOnly` (hides every action) and `basePath`
  (`/officer/incident-reports` for the officer). The admin routes use the defaults, so nothing changes for admins.
- Hiding the buttons is only the screen. The database rules are what actually stop an officer from writing:
  there is no write rule for the officer role on `/incidents` or `/rescueTeams`.
- Create the first officer on the Users screen (role **Disaster Management Officer**); the account is saved in
  `/users/DisasterManagementOfficers/{uid}` and `/userRoles/{uid}`.