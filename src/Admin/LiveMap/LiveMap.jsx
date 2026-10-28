import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIncidents } from "../IncidentReports/IncidentsContext.jsx";
import { ago, statusLabel } from "../IncidentReports/incidentsData.js";
import {
  L,
  OPEN_STATUSES,
  PRIORITY_COLOR,
  PRIORITY_RANK,
  createMap,
  hasPoint,
  incidentMarker,
  syncMarkers,
} from "./mapShared.js";
import MapLegend, { TypeKey } from "./MapLegend.jsx";

/* ------------------------------------------------------------------
   Live Map  (OpenStreetMap tiles + Leaflet)

   - Incidents come from Firebase (/incidents) through the shared incident list
     (same data as Incident Reports, Dashboard and Reports & Stats), each one has
     numbers  lat  and  lng.
   - Leaflet is used directly (not react-leaflet): the map is created once, and the markers
     are updated in place when the data changes.
   - Colors, pins and popups are shared with the Dashboard map (see mapShared.js).
------------------------------------------------------------------- */

const PRIORITIES = ["Critical", "High", "Medium", "Low"];

export default function LiveMap({ listPath, reviewable = true }) {
  const navigate = useNavigate();
  const { incidents } = useIncidents();

  const [priority, setPriority] = useState("all");
  const [scope, setScope] = useState("open"); // "open" | "all"

  const mapEl = useRef(null);
  const layers = useRef(null);
  const fitted = useRef(false);

  // ---------- incidents to show ----------
  const shown = useMemo(
    () =>
      incidents
        .filter(
          (i) =>
            hasPoint(i) &&
            (scope === "all" || OPEN_STATUSES.includes(i.status)) &&
            (priority === "all" || i.priority === priority)
        )
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || String(b.createdAt).localeCompare(String(a.createdAt))),
    [incidents, scope, priority]
  );

  // ---------- 1. create the map once ----------
  useEffect(() => {
    const created = createMap(mapEl.current);
    const { map } = created;
    layers.current = created;
    fitted.current = false;

    return () => {
      map.remove();
      layers.current = null;
    };
  }, []);

  // ---------- 2. incident markers ----------
  useEffect(() => {
    const l = layers.current;
    if (!l) return;
    syncMarkers(
      l.incidents,
      l.incidentMarkers,
      shown.map((i) => incidentMarker(i, navigate, ago, { listPath, reviewable }))
    );

    // Zoom to the incidents the first time some are shown.
    if (!fitted.current && shown.length > 0) {
      l.map.fitBounds(L.latLngBounds(shown.map((i) => [i.lat, i.lng])), { padding: [40, 40], maxZoom: 14 });
      fitted.current = true;
    }
  }, [shown, navigate, listPath, reviewable]);

  function focusIncident(i) {
    const l = layers.current;
    if (!l) return;
    l.map.flyTo([i.lat, i.lng], 15, { duration: 0.6 });
    l.incidentMarkers.get(i.id)?.openPopup();
  }

  return (
    <div className="lm-page">
      {/* filters */}
      <div className="rt-toolbar">
        <div className="admin-chips" role="group" aria-label="Filter by priority">
          {["all", ...PRIORITIES].map((p) => (
            <button
              key={p}
              type="button"
              className={`admin-chip ${priority === p ? "is-active" : ""}`}
              aria-pressed={priority === p}
              onClick={() => setPriority(p)}
            >
              {p === "all" ? "All priorities" : p}
            </button>
          ))}
        </div>

        <div className="rt-toolbar__right">
          <select className="admin-chip" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Which incidents">
            <option value="open">Open incidents</option>
            <option value="all">All incidents</option>
          </select>
        </div>
      </div>

      <div className="lm-layout">
        <section className="admin-card lm-mapcard" aria-label="Live map">
          <div ref={mapEl} className="lm-map" />
          <MapLegend />
        </section>

        <section className="admin-card lm-side" aria-label="Incidents on the map">
          <div className="admin-card__head">
            <div>
              <h2 className="admin-card__title">On the map</h2>
              <p className="admin-card__sub">
                {shown.length} incident{shown.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <ul className="lm-list">
            {shown.map((i) => (
              <li key={i.id}>
                <button type="button" className="lm-item" onClick={() => focusIncident(i)}>
                  <span className="lm-dot" style={{ "--c": PRIORITY_COLOR[i.priority] }} aria-hidden="true" />
                  <TypeKey type={i.type} />
                  <span className="lm-item__text">
                    <span className="lm-item__title">{i.type} · {i.location}</span>
                    <span className="lm-item__meta">{i.id} · {statusLabel(i.status)} · {ago(i.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="admin-card__sub">No incidents match these filters.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
