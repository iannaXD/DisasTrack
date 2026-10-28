import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useIncidents } from "./IncidentReports/IncidentsContext.jsx";
import { OPEN_STATUSES, STATUSES, ago, minutesSince, statusLabel } from "./IncidentReports/incidentsData.js";
import { useTeams } from "./js/useTeams.js";
import {
  L,
  createMap,
  hasPoint,
  incidentMarker,
  syncMarkers,
} from "./LiveMap/mapShared.js";
import MapLegend from "./LiveMap/MapLegend.jsx";

/* ------------------------------------------------------------------
   Everything on this screen is calculated from live data:
     - incidents  -> Firebase (/incidents), the same list the Incident Reports,
                     Live Map and Reports & Stats screens use (so verifying or
                     dispatching anywhere updates this page)
     - rescue teams -> Firebase (/rescueTeams)
     - the map    -> the same OpenStreetMap / Leaflet map as the Live Map screen
                     (pins, colors and popups come from LiveMap/mapShared.js)
------------------------------------------------------------------- */

const LIST_PATH = "/admin/incident-reports";
const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const STATUS_FILTERS = STATUSES;

const LIVE_MAP_PATH = "/admin/live-map";

const MAP_FILTERS = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "pending", label: "Pending" },
];

const slug = (text) => text.toLowerCase().replace(/\s+/g, "-");

function Badge({ label }) {
  return <span className={`admin-badge admin-badge--${slug(label)}`}>{label}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { incidents, loading: incidentsLoading } = useIncidents();
  const { teams, loading: teamsLoading } = useTeams();

  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("all");

  const open = useMemo(() => incidents.filter((i) => OPEN_STATUSES.includes(i.status)), [incidents]);
  const pending = incidents.filter((i) => i.status === "Pending").length;
  // "Resolved today" = resolved within the last 24 hours. The time it was resolved is
  // the last line of its activity log (falls back to when it was reported).
  const resolvedToday = incidents.filter((i) => {
    const last = i.activity[i.activity.length - 1]?.at || i.createdAt;
    return i.status === "Resolved" && minutesSince(last) < 24 * 60;
  }).length;
  const deployed = teams.filter((t) => t.status === "Deployed").length;
  const available = teams.filter((t) => t.status === "Available").length;

  const stats = [
    { label: "Active Incidents", value: open.length, icon: "alert", tone: "brandy" },
    { label: "Pending Verification", value: pending, icon: "clock", tone: "sun" },
    {
      label: "Teams Deployed",
      value: teamsLoading ? "…" : `${deployed} / ${teams.length}`,
      note: teamsLoading ? "" : `${available} available`,
      icon: "users",
      tone: "slate",
    },
    { label: "Resolved Today", value: resolvedToday, icon: "check", tone: "jet" },
  ];

  // ---------- the map (Leaflet, created once; markers updated in place) ----------
  const mapEl = useRef(null);
  const layers = useRef(null);
  const fitted = useRef(false);

  // What the chips show: All = open incidents, Critical / Pending = only those incidents.
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
    syncMarkers(l.incidents, l.incidentMarkers, mapIncidents.map((i) => incidentMarker(i, navigate, ago)));
    // Zoom to the incidents the first time some arrive from Firebase.
    if (!fitted.current && mapIncidents.length > 0) {
      l.map.fitBounds(L.latLngBounds(mapIncidents.map((i) => [i.lat, i.lng])), { padding: [30, 30], maxZoom: 14 });
      fitted.current = true;
    }
  }, [mapIncidents, navigate]);

  // Priority queue: open incidents, most urgent first, newest first within a priority.
  const queue = useMemo(
    () =>
      [...open]
        .sort(
          (a, b) =>
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            String(b.createdAt).localeCompare(String(a.createdAt))
        )
        .slice(0, 4),
    [open]
  );

  // Recent reports: the newest five (optionally for one status).
  const recent = useMemo(
    () =>
      incidents
        .filter((i) => status === "all" || i.status === status)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 5),
    [incidents, status]
  );

  return (
    <>
      {/* Stat cards */}
      <section className="admin-stats" aria-label="Summary">
        {stats.map((s) => (
          <article key={s.label} className="admin-card admin-stat">
            <div>
              <p className="admin-stat__label">{s.label}</p>
              <p className="admin-stat__value">{s.value}</p>
              {s.note && <p className="admin-stat__note">{s.note}</p>}
            </div>
            <span className={`admin-stat__chip admin-stat__chip--${s.tone}`}>
              <Icon name={s.icon} size={20} />
            </span>
          </article>
        ))}
      </section>

      {/* Map + priority queue */}
      <div className="admin-grid">
        <section className="admin-card" aria-labelledby="map-title">
          <div className="admin-card__head">
            <div>
              <h2 id="map-title" className="admin-card__title">Incident Map</h2>
              <p className="admin-card__sub">
                Live · {incidentsLoading ? "loading…" : `${open.length} active incident${open.length === 1 ? "" : "s"}`}
                {" · "}
                <Link className="admin-link-btn" to={LIVE_MAP_PATH}>Open Live Map</Link>
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

          <div
            ref={mapEl}
            className="admin-map admin-map--live"
            role="region"
            aria-label="Map of reported incidents"
          />

          <MapLegend />
        </section>

        <section className="admin-card" aria-labelledby="queue-title">
          <div className="admin-card__head">
            <div>
              <h2 id="queue-title" className="admin-card__title">Priority Queue</h2>
              <p className="admin-card__sub">Sorted by urgency and risk</p>
            </div>
            <Link className="admin-link-btn" to={LIST_PATH}>View all</Link>
          </div>

          {queue.length === 0 ? (
            <p className="admin-card__sub">No open incidents right now.</p>
          ) : (
            <ul className="admin-queue">
              {queue.map((item) => (
                <li key={item.id} className={`admin-queue__item admin-queue__item--${slug(item.priority)}`}>
                  <div className="admin-queue__text">
                    <p className="admin-queue__title">{item.type} · {item.location}</p>
                    <p className="admin-queue__meta">{item.reporter} · {ago(item.createdAt)}</p>
                  </div>
                  <div className="admin-queue__side">
                    <Badge label={item.priority} />
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm"
                      onClick={() => navigate(`${LIST_PATH}/${item.id}`)}
                    >
                      Assign
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent reports */}
      <section className="admin-card" aria-labelledby="recent-title">
        <div className="admin-card__head">
          <h2 id="recent-title" className="admin-card__title">Recent Reports</h2>
          <select
            className="admin-chip"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
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
                <th scope="col"><span className="sr-only">Actions</span></th>
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
                  <td className="admin-table__action">
                    <Link className="admin-link-btn" to={`${LIST_PATH}/${r.id}`}>Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {recent.length === 0 && <p className="admin-card__sub" style={{ padding: "16px 14px" }}>No reports with this status.</p>}
        </div>
      </section>
    </>
  );
}
