import { useEffect, useRef } from "react";
import { ago } from "./incidentsData.js";
import { createMap, hasPoint, incidentMarker, syncMarkers } from "../LiveMap/mapShared.js";

/* ------------------------------------------------------------------
   Map for ONE incident (Incident Detail page).
   Same OpenStreetMap / Leaflet map as the Live Map screen, showing the incident pin.
------------------------------------------------------------------- */
export default function IncidentMap({ incident }) {
  const mapEl = useRef(null);
  const layers = useRef(null);
  const located = hasPoint(incident);

  // 1. create the map once (cleaned up when leaving the page)
  useEffect(() => {
    if (!mapEl.current) return undefined;
    const created = createMap(mapEl.current, { scrollWheelZoom: false });
    layers.current = created;
    // The card may still be laying out: re-measure so tiles fill the box.
    const fix = setTimeout(() => created.map.invalidateSize(), 150);
    return () => {
      clearTimeout(fix);
      created.map.remove();
      layers.current = null;
    };
  }, []);

  // 2. incident pin; zoom to it
  useEffect(() => {
    const l = layers.current;
    if (!l) return;
    syncMarkers(l.incidents, l.incidentMarkers, located ? [incidentMarker(incident, () => {}, ago)] : []);
    if (located) l.map.setView([incident.lat, incident.lng], 15);
  }, [incident, located]);

  return (
    <>
      <div className="ir-map ir-map--live" ref={mapEl} role="region" aria-label={`Live map of ${incident.location}`} />
      {!located && <p className="ir-muted ir-map__none">This report has no GPS point, so it can't be shown on the map.</p>}
    </>
  );
}
