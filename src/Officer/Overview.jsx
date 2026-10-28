import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../Admin/Icon.jsx";
import { useIncidents } from "../Admin/IncidentReports/IncidentsContext.jsx";
import { OPEN_STATUSES, ago } from "../Admin/IncidentReports/incidentsData.js";
import { useTeams } from "../Admin/js/useTeams.js";
import { L, createMap, hasPoint, incidentMarker, syncMarkers } from "../Admin/LiveMap/mapShared.js";
import MapLegend from "../Admin/LiveMap/MapLegend.jsx";
import "./Officer.css";

/* ------------------------------------------------------------------
   Disaster Management Officer - Overview

   Same look as the admin dashboard, but built for monitoring instead of
   dispatching: the officer reads the whole picture and does not assign teams.
   Everything is calculated from the same live lists the admin screens use:
     - incidents     -> useIncidents()  (Firebase /incidents)
     - rescue teams  -> useTeams()      (Firebase /rescueTeams)
     - the map       -> the admin Live Map pieces (LiveMap/mapShared.js)
------------------------------------------------------------------- */

const BASE = "/officer";

// The life of a report, in order. Rejected / Duplicate leave the path early (shown as a note).
const PIPELINE = [
  { status: "Pending", color: "#f2c14e" },
  { status: "Verified", color: "#9aa5b1" },
  { status: "Awaiting Assignment", color: "#c8641d" },
  { status: "Team Assigned", color: "#5c6b7a" },
  { status: "In Progress", color: "#2a2d34" },
  { status: "Resolved", color: "#8f250c" },
  { status: "Closed", color: "#c9c3b8" },
];

const MAP_FILTERS = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "pending", label: "Pending" },
];

const slug = (text) => text.toLowerCase().replace(/\s+/g, "-");

function Badge({ label }) {
  return <span className={`admin-badge admin-badge--${slug(label)}`}>{label}</span>;
}

// One row of a simple horizontal bar list (label, bar, number).
function BarRows({ rows, total, empty }) {
  if (rows.length === 0 || total === 0) return <p className="admin-card__sub">{empty}</p>;
  return (
    <ul className="of-bars">
      {rows.map((r) => (
        <li key={r.label} className="of-bars__row">
          <span className="of-bars__label">{r.label}</span>
          <span className="of-bars__track" aria-hidden="true">
            <span
              className="of-bars__fill"
              style={{ width: `${Math.max(r.value > 0 ? 3 : 0, (r.value / total) * 100)}%`, background: r.color }}
            />
          </span>
          <span className="of-bars__count">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const { incidents, loading: incidentsLoading } = useIncidents();
  const { teams, loading: teamsLoading } = useTeams();

  const [filter, setFilter] = useState("all");

  // ---------- numbers for the cards ----------
  const open = useMemo(() => incidents.filter((i) => OPEN_STATUSES.includes(i.status)), [incidents]);
  const resolved = incidents.filter((i) => i.status === "Resolved" || i.status === "Closed").length;
  // Duplicates and rejected reports were never acted on, so they are left out of the rate.
  const handled = incidents.filter((i) => i.status !== "Duplicate" && i.status !== "Rejected").length;
  const rate = handled ? Math.round((resolved / handled) * 100) : 0;
  const deployed = teams.filter((t) => t.status === "Deployed").length;
  const available = teams.filter((t) => t.status === "Available").length;

  const stats = [
    { label: "Total Reports", value: incidents.length, note: `${open.length} still open`, icon: "reports", tone: "slate" },
    { label: "Active Incidents", value: open.length, icon: "alert", tone: "brandy" },
    { label: "Resolution Rate", value: `${rate}%`, note: `${resolved} of ${handled} handled`, icon: "check", tone: "jet" },
    {
      label: "Teams Deployed",
      value: teamsLoading ? "…" : `${deployed} / ${teams.length}`,
      note: teamsLoading ? "" : `${available} available`,
      icon: "users",
      tone: "sun",
    },
  ];

  // ---------- the map (same Leaflet map as the admin Live Map) ----------
  const mapEl = useRef(null);
  const layers = useRef(null);
  const fitted = useRef(false);

  const mapIncidents = useMemo(
    () =>
      open.filter(
        (i) =>
          hasPoint(i) &&
          (filter === "all" ||
            (filter === "critical" && i.priority === "Critical") ||
            (filter === "pending" && i.status === "Pending"))
      ),
    [open, filter]
  );

  useEffect(() => {
    const created = createMap(mapEl.current, { scrollWheelZoom: false }); // wheel scrolls the page, not the map
    layers.current = created;
    fitted.current = false;
    return () => {
      created.map.remove();
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    const l = layers.current;
    if (!l) return;
    syncMarkers(
      l.incidents,
      l.incidentMarkers,
      mapIncidents.map((i) => incidentMarker(i, navigate, ago, { reviewable: false }))
    );
    if (!fitted.current && mapIncidents.length > 0) {
      l.map.fitBounds(L.latLngBounds(mapIncidents.map((i) => [i.lat, i.lng])), { padding: [30, 30], maxZoom: 14 });
      fitted.current = true;
    }
  }, [mapIncidents, navigate]);

  // ---------- response pipeline ----------
  const pipeline = useMemo(
    () => PIPELINE.map((p) => ({ label: p.status, color: p.color, value: incidents.filter((i) => i.status === p.status).length })),
    [incidents]
  );
  const pipelineTotal = pipeline.reduce((sum, p) => sum + p.value, 0);
  const rejected = incidents.filter((i) => i.status === "Rejected").length;
  const duplicates = incidents.filter((i) => i.status === "Duplicate").length;

  // ---------- reports over the last 7 days ----------
  const week = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let k = 6; k >= 0; k -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - k);
      days.push({ start: d.getTime(), label: d.toLocaleDateString("en-US", { weekday: "short" }), count: 0 });
    }
    incidents.forEach((i) => {
      const time = new Date(i.createdAt).getTime();
      if (!Number.isFinite(time)) return;
      const index = Math.floor((time - days[0].start) / 86400000);
      if (index >= 0 && index < days.length) days[index].count += 1;
    });
    return days;
  }, [incidents]);
  const weekMax = Math.max(1, ...week.map((d) => d.count));
  const weekTotal = week.reduce((sum, d) => sum + d.count, 0);

  // ---------- incidents by type ----------
  const byType = useMemo(() => {
    const counts = new Map();
    incidents.forEach((i) => counts.set(i.type, (counts.get(i.type) || 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value, color: "#8f250c" }));
  }, [incidents]);
  const typeMax = byType[0]?.value || 0;

  // ---------- recent reports ----------
  const recent = useMemo(
    () => [...incidents].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5),
    [incidents]
  );

  return (
    <>
      {/* Stat cards */}
      <section className="admin-stats" aria-label="Summary">
        {stats.map((s) => (
          <article key={s.label} className="admin-card admin-stat">
            <div>
              <p className="admin-stat__label">{s.label}</p>
              <p className="admin-stat__value">{incidentsLoading && s.label !== "Teams Deployed" ? "…" : s.value}</p>
              {s.note && <p className="admin-stat__note">{s.note}</p>}
            </div>
            <span className={`admin-stat__chip admin-stat__chip--${s.tone}`}>
              <Icon name={s.icon} size={20} />
            </span>
          </article>
        ))}
      </section>

      {/* Live map + response pipeline */}
      <div className="admin-grid">
        <section className="admin-card" aria-labelledby="of-map-title">
          <div className="admin-card__head">
            <div>
              <h2 id="of-map-title" className="admin-card__title">Live Incident Map</h2>
              <p className="admin-card__sub">
                Live · {incidentsLoading ? "loading…" : `${open.length} active incident${open.length === 1 ? "" : "s"}`}
                {" · "}
                <Link className="admin-link-btn" to={`${BASE}/live-map`}>Open Live Map</Link>
              </p>
            </div>
            <div className="admin-chips" role="group" aria-label="Map filter">
              {MAP_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`admin-chip ${filter === f.key ? "is-active" : ""}`}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={mapEl} className="admin-map admin-map--live" role="region" aria-label="Map of reported incidents" />

          <MapLegend />
        </section>

        <section className="admin-card" aria-labelledby="of-pipe-title">
          <div className="admin-card__head">
            <div>
              <h2 id="of-pipe-title" className="admin-card__title">Response Pipeline</h2>
              <p className="admin-card__sub">Where every report stands right now</p>
            </div>
          </div>

          <BarRows rows={pipeline} total={Math.max(1, ...pipeline.map((p) => p.value))} empty="No reports yet." />

          <p className="of-note">
            {rejected} rejected · {duplicates} duplicate{duplicates === 1 ? "" : "s"} (not acted on)
          </p>
        </section>
      </div>

      {/* Trends */}
      <div className="of-grid-2">
        <section className="admin-card" aria-labelledby="of-week-title">
          <div className="admin-card__head">
            <div>
              <h2 id="of-week-title" className="admin-card__title">Reports, Last 7 Days</h2>
              <p className="admin-card__sub">{weekTotal} report{weekTotal === 1 ? "" : "s"} this week</p>
            </div>
          </div>

          <div className="of-week" role="img" aria-label={`Reports per day: ${week.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
            {week.map((d) => (
              <div key={d.start} className="of-week__col">
                <span className="of-week__val">{d.count}</span>
                <span className="of-week__plot">
                  <span
                    className={`of-week__bar ${d.count > 0 && d.count === weekMax ? "is-peak" : ""}`}
                    style={{ height: `${(d.count / weekMax) * 100}%` }}
                  />
                </span>
                <span className="of-week__label">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card" aria-labelledby="of-type-title">
          <div className="admin-card__head">
            <div>
              <h2 id="of-type-title" className="admin-card__title">Incidents by Type</h2>
              <p className="admin-card__sub">All reports, most common first</p>
            </div>
          </div>

          <BarRows rows={byType} total={typeMax} empty="No reports yet." />
        </section>
      </div>

      {/* Recent reports (view only) */}
      <section className="admin-card" aria-labelledby="of-recent-title">
        <div className="admin-card__head">
          <h2 id="of-recent-title" className="admin-card__title">Recent Reports</h2>
          <Link className="admin-link-btn" to={`${BASE}/incident-reports`}>View all</Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Report ID</th>
                <th scope="col">Incident</th>
                <th scope="col">Location</th>
                <th scope="col">Reporter</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Reported</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="admin-table__id">{r.id}</td>
                  <td className="admin-table__strong">{r.type}</td>
                  <td>{r.location}</td>
                  <td>{r.reporter}</td>
                  <td><Badge label={r.priority} /></td>
                  <td><Badge label={r.status} /></td>
                  <td>{ago(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {recent.length === 0 && (
            <p className="admin-card__sub" style={{ padding: "16px 14px" }}>
              {incidentsLoading ? "Loading reports…" : "No reports yet."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
