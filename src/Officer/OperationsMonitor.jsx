import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Admin/Icon.jsx";
import { useIncidents } from "../Admin/IncidentReports/IncidentsContext.jsx";
import { PRIORITIES, ago } from "../Admin/IncidentReports/incidentsData.js";
import { useTeams } from "../Admin/js/useTeams.js";
import "./Officer.css";

/* ------------------------------------------------------------------
   Disaster Management Officer - Operations Monitor

   The live working view of ongoing responses. It lists every incident that is
   being worked on and which rescue team is assigned to it, and shows how far
   each one has moved along:

     Verified -> Awaiting Assignment -> Team Assigned -> In Progress -> Resolved

   View only (the admin assigns teams and changes statuses). Data is live:
     - incidents     -> useIncidents()  (Firebase /incidents)
     - rescue teams  -> useTeams()      (Firebase /rescueTeams)
   incident.team is a team id ("T-01"); the name is looked up in the teams list.
------------------------------------------------------------------- */

const BASE = "/officer";

// Steps of the tracker, in order.
const STEPS = ["Verified", "Awaiting Assignment", "Team Assigned", "In Progress", "Resolved"];
// Statuses shown on this screen (Pending is still being reviewed, so it is not an operation yet).
const ACTIVE = ["Verified", "Awaiting Assignment", "Team Assigned", "In Progress"];

const TABS = [
  { key: "all", label: "All active" },
  { key: "Awaiting Assignment", label: "Awaiting team" },
  { key: "Team Assigned", label: "Team Assigned" },
  { key: "In Progress", label: "In Progress" },
];

const slug = (text) => text.toLowerCase().replace(/\s+/g, "-");

function Badge({ label }) {
  return <span className={`admin-badge admin-badge--${slug(label)}`}>{label}</span>;
}

// Row of dots: finished steps are filled, the current one is highlighted.
function Tracker({ status }) {
  // "Verified" and "Awaiting Assignment" both mean "no team yet", but Awaiting is one step further.
  const current = Math.max(0, STEPS.indexOf(status));
  return (
    <ol className="of-track" aria-label={`Progress: ${status}`}>
      {STEPS.map((step, index) => {
        const state = index < current ? "is-done" : index === current ? "is-current" : "";
        return (
          <li key={step} className={`of-track__step ${state}`} aria-current={index === current ? "step" : undefined}>
            <span className="of-track__dot" aria-hidden="true" />
            <span className="of-track__label">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function OperationsMonitor() {
  const { incidents, loading, error } = useIncidents();
  const { teams, loading: teamsLoading } = useTeams();

  const [tab, setTab] = useState("all");
  const [openId, setOpenId] = useState(null); // incident whose activity log is open

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const active = useMemo(() => incidents.filter((i) => ACTIVE.includes(i.status)), [incidents]);

  // "Awaiting team" groups Verified + Awaiting Assignment (neither has a team yet).
  const inTab = (i, key) =>
    key === "all" ||
    (key === "Awaiting Assignment" ? i.status === "Verified" || i.status === "Awaiting Assignment" : i.status === key);
  const countTab = (key) => active.filter((i) => inTab(i, key)).length;

  // Most urgent first; same priority -> the one waiting longest.
  const visible = useMemo(
    () =>
      active
        .filter((i) => inTab(i, tab))
        .sort(
          (a, b) =>
            PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
            String(a.createdAt).localeCompare(String(b.createdAt))
        ),
    [active, tab] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const recentlyDone = useMemo(
    () =>
      incidents
        .filter((i) => i.status === "Resolved" || i.status === "Closed")
        .sort((a, b) => lastTime(b).localeCompare(lastTime(a)))
        .slice(0, 5),
    [incidents]
  );

  const deployed = teams.filter((t) => t.status === "Deployed").length;
  const critical = active.filter((i) => i.priority === "Critical").length;

  const stats = [
    { label: "Active Operations", value: active.length, note: `${critical} critical`, icon: "alert", tone: "brandy" },
    { label: "Awaiting a Team", value: countTab("Awaiting Assignment"), note: "No team sent yet", icon: "clock", tone: "sun" },
    { label: "Team Assigned", value: countTab("Team Assigned"), note: "On the way", icon: "dispatch", tone: "slate" },
    { label: "In Progress", value: countTab("In Progress"), note: teamsLoading ? "" : `${deployed} team${deployed === 1 ? "" : "s"} deployed`, icon: "rescue", tone: "jet" },
  ];

  return (
    <div className="of-ops">
      <section className="admin-stats" aria-label="Operations summary">
        {stats.map((s) => (
          <article key={s.label} className="admin-card admin-stat">
            <div>
              <p className="admin-stat__label">{s.label}</p>
              <p className="admin-stat__value">{loading ? "…" : s.value}</p>
              {s.note && <p className="admin-stat__note">{s.note}</p>}
            </div>
            <span className={`admin-stat__chip admin-stat__chip--${s.tone}`}>
              <Icon name={s.icon} size={20} />
            </span>
          </article>
        ))}
      </section>

      <div className="of-ops__toolbar">
        <div className="admin-chips" role="group" aria-label="Filter by status">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`admin-chip ${tab === t.key ? "is-active" : ""}`}
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="rt-chipcount">{countTab(t.key)}</span>
            </button>
          ))}
        </div>
        <p className="of-ops__live">
          <span className="of-ops__pulse" aria-hidden="true" /> Live · updates automatically
        </p>
      </div>

      {error && <p className="rt-error">{error.message}</p>}

      <ul className="of-ops__list" aria-label="Active operations">
        {visible.map((i) => {
          const team = i.team ? teamById.get(i.team) : null;
          const last = i.activity[i.activity.length - 1];
          const isOpen = openId === i.id;
          return (
            <li key={i.id} className={`admin-card of-op of-op--${slug(i.priority || "low")}`}>
              <div className="of-op__top">
                <div className="of-op__main">
                  <p className="of-op__title">
                    <span className="admin-table__id">{i.id}</span>
                    <span className="admin-table__strong">{i.type}</span>
                  </p>
                  <p className="of-op__where">{i.location}</p>
                </div>
                <div className="of-op__badges">
                  <Badge label={i.priority} />
                  <Badge label={i.status} />
                </div>
              </div>

              <div className="of-op__team">
                <span className="of-op__teamicon" aria-hidden="true">
                  <Icon name="rescue" size={16} />
                </span>
                {i.team ? (
                  <div>
                    <p className="of-op__teamname">{team ? team.name : teamsLoading ? "Loading team…" : i.team}</p>
                    <p className="of-op__teamsub">
                      {team ? `${team.type} · Leader ${team.leader || "not set"}${team.phone ? ` · ${team.phone}` : ""}` : `Team ${i.team}`}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="of-op__teamname of-op__teamname--none">No team assigned yet</p>
                    <p className="of-op__teamsub">Waiting for the admin to dispatch a team</p>
                  </div>
                )}
              </div>

              <Tracker status={i.status} />

              <div className="of-op__foot">
                <p className="of-op__last">
                  {last ? (
                    <>
                      <strong>{ago(last.at)}:</strong> {last.text}
                    </>
                  ) : (
                    <>Reported {ago(i.createdAt)}</>
                  )}
                </p>
                <div className="of-op__links">
                  {i.activity.length > 0 && (
                    <button
                      type="button"
                      className="admin-link-btn"
                      aria-expanded={isOpen}
                      onClick={() => setOpenId(isOpen ? null : i.id)}
                    >
                      {isOpen ? "Hide activity" : `Activity (${i.activity.length})`}
                    </button>
                  )}
                  <Link className="admin-link-btn" to={`${BASE}/live-map`}>View on map</Link>
                </div>
              </div>

              {isOpen && (
                <ol className="of-log">
                  {[...i.activity].reverse().map((a, index) => (
                    <li key={`${a.at}-${index}`}>
                      <span className="of-log__time">{ago(a.at)}</span>
                      <span>{a.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>

      {loading && (
        <section className="admin-card">
          <p className="admin-card__sub">Loading operations…</p>
        </section>
      )}

      {!loading && visible.length === 0 && (
        <section className="admin-card rt-empty">
          <h3>No active operations</h3>
          <p>{tab === "all" ? "Verified reports and dispatched teams will appear here." : "Nothing in this status right now."}</p>
        </section>
      )}

      <section className="admin-card" aria-labelledby="of-done-title">
        <div className="admin-card__head">
          <div>
            <h2 id="of-done-title" className="admin-card__title">Recently Completed</h2>
            <p className="admin-card__sub">Latest operations that were resolved or closed</p>
          </div>
          <Link className="admin-link-btn" to={`${BASE}/outcomes`}>Response outcomes</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Report ID</th>
                <th scope="col">Incident</th>
                <th scope="col">Location</th>
                <th scope="col">Team</th>
                <th scope="col">Status</th>
                <th scope="col">Finished</th>
              </tr>
            </thead>
            <tbody>
              {recentlyDone.map((i) => (
                <tr key={i.id}>
                  <td className="admin-table__id">{i.id}</td>
                  <td className="admin-table__strong">{i.type}</td>
                  <td>{i.location}</td>
                  <td>{teamById.get(i.team)?.name || (i.team ? i.team : <span className="rt-muted">None</span>)}</td>
                  <td><Badge label={i.status} /></td>
                  <td>{ago(lastTime(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentlyDone.length === 0 && (
            <p className="admin-card__sub" style={{ padding: "16px 14px" }}>
              {loading ? "Loading…" : "Nothing has been completed yet."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

// Time of the last activity line (or the report time), as an ISO string.
function lastTime(incident) {
  const last = incident.activity[incident.activity.length - 1];
  return String(last?.at || incident.createdAt || "");
}
