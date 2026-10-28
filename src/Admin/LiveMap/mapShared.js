/* ------------------------------------------------------------------
   Map pieces shared by the Live Map screen and the small map on the
   Dashboard, so both look and behave the same (same colors, same pins,
   same popups). Uses Leaflet + OpenStreetMap tiles.
------------------------------------------------------------------- */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { OPEN_STATUSES, statusLabel } from "../IncidentReports/incidentsData.js";

export const CENTER = [14.88, 120.93]; // middle of Bulacan province
export const DEFAULT_ZOOM = 10; // whole province in view
// Roughly the edges of Bulacan (a little loose). The map cannot be dragged far outside it.
export const BULACAN_BOUNDS = [[14.6, 120.65], [15.35, 121.4]];
export { OPEN_STATUSES };
export const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export const PRIORITY_COLOR = { Critical: "#8f250c", High: "#c8641d", Medium: "#f2c14e", Low: "#5c6b7a" };
export const LIST_PATH = "/admin/incident-reports";

export const hasPoint = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/* Small white symbols (24x24 grid, drawn with strokes) that say WHAT the incident is.
   They are drawn inside the pin, and the legends reuse them so the key matches the map. */
export const TYPE_GLYPH = {
  Flood: '<path d="M3 8q2.25-2 4.5 0t4.5 0 4.5 0 4.5 0M3 13q2.25-2 4.5 0t4.5 0 4.5 0 4.5 0M3 18q2.25-2 4.5 0t4.5 0 4.5 0 4.5 0"/>',
  Fire: '<path d="M12 3c1 4 5 6 5 11a5 5 0 01-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z"/>',
  Landslide: '<path d="M3 19l6-11 4 7 3-4 5 8z"/><path d="M15 4l1 1.5M19 6l1 1.5"/>',
  Earthquake: '<path d="M2 12h4l2-5 3 10 3-8 2 3h6"/>',
  "Medical emergency": '<path d="M12 5v14M5 12h14"/>',
  "Road hazard": '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  "Power line": '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  Other: '<path d="M12 6v7M12 18h.01"/>',
};
export const typeGlyph = (type) => TYPE_GLYPH[type] || TYPE_GLYPH.Other;

// A glyph on its own (white strokes), for legends and list rows. Static markup, no user text.
export const glyphSvg = (inner, size = 14) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

// Incident pin: teardrop colored by PRIORITY, symbol inside shows the TYPE.
export const incidentIcon = (priority, faded, type) =>
  L.divIcon({
    className: "lm-icon",
    html:
      `<span class="lm-pin${faded ? " is-faded" : ""}" style="--c:${PRIORITY_COLOR[priority] || "#5c6b7a"}">` +
      `<svg viewBox="0 0 30 38" width="30" height="38" aria-hidden="true" focusable="false">` +
      `<path class="lm-pin__body" d="M15 36S2 23 2 14.5a13 13 0 0126 0C28 23 15 36 15 36z"/>` +
      `<g transform="translate(6 5.5) scale(0.75)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${typeGlyph(type)}</g>` +
      `</svg></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    popupAnchor: [0, -34],
  });

// Creates the OpenStreetMap map inside `element` with the layer groups both screens use.
export function createMap(element, options = {}) {
  const map = L.map(element, {
    center: CENTER,
    zoom: DEFAULT_ZOOM,
    minZoom: 9,
    maxBounds: BULACAN_BOUNDS,
    maxBoundsViscosity: 0.8,
    ...options,
  });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return {
    map,
    incidents: L.layerGroup().addTo(map),
    incidentMarkers: new Map(),
  };
}

// Popup content is built with textContent (never HTML strings), because names and
// locations typed by residents must not be able to inject markup.
export function popupEl(title, lines, action) {
  const root = document.createElement("div");
  root.className = "lm-popup";
  const heading = document.createElement("strong");
  heading.textContent = title;
  root.append(heading);
  lines.forEach((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    root.append(p);
  });
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-btn admin-btn--sm";
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    root.append(button);
  }
  return root;
}

// Adds new markers, moves/restyles existing ones, removes the ones that are gone.
export function syncMarkers(group, store, items) {
  const seen = new Set();
  items.forEach(({ key, latlng, icon, popup }) => {
    seen.add(key);
    const marker = store.get(key);
    if (!marker) {
      const created = L.marker(latlng, { icon }).bindPopup(popup);
      store.set(key, created);
      group.addLayer(created);
    } else {
      marker.setLatLng(latlng);
      marker.setIcon(icon);
      marker.setPopupContent(popup);
    }
  });
  store.forEach((marker, key) => {
    if (!seen.has(key)) {
      group.removeLayer(marker);
      store.delete(key);
    }
  });
}

// The popup + icon for one incident (same on both maps).
// options.listPath   -> where "Review report" goes (admin list by default)
// options.reviewable -> false hides the button (screens that only view incidents)
export function incidentMarker(i, navigate, ago, options = {}) {
  const { listPath = LIST_PATH, reviewable = true } = options;
  return {
    key: i.id,
    latlng: [i.lat, i.lng],
    icon: incidentIcon(i.priority, !OPEN_STATUSES.includes(i.status), i.type),
    popup: popupEl(
      `${i.id} · ${i.type}`,
      [`${i.priority} priority · ${statusLabel(i.status)}`, i.location, `${i.reporter} · ${ago(i.createdAt)}`],
      reviewable ? { label: "Review report", onClick: () => navigate(`${listPath}/${i.id}`) } : null
    ),
  };
}

export { L };
