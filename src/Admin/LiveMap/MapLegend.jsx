import { INCIDENT_TYPES } from "../IncidentReports/incidentsData.js";
import { PRIORITY_COLOR, TYPE_GLYPH, glyphSvg } from "./mapShared.js";

/* Legend shared by the Live Map and the Dashboard map.
   The symbols are the same ones drawn inside the pins, so the key matches the map.
   Each row = a label on the left + its items on the right. When the items wrap onto a
   second line they stay lined up next to the label instead of going under it. */
export function TypeKey({ type }) {
  return (
    <span
      className="lm-key lm-key--glyph"
      dangerouslySetInnerHTML={{ __html: glyphSvg(TYPE_GLYPH[type] || TYPE_GLYPH.Other, 14) }}
    />
  );
}

export default function MapLegend() {
  return (
    <div className="lm-legend">
      <div className="lm-legend__row">
        <span className="lm-legend-title">Type</span>
        <ul className="lm-legend__items">
          {INCIDENT_TYPES.map((t) => (
            <li key={t}><TypeKey type={t} />{t}</li>
          ))}
        </ul>
      </div>

      <div className="lm-legend__row">
        <span className="lm-legend-title">Priority</span>
        <ul className="lm-legend__items">
          {["Critical", "High", "Medium", "Low"].map((p) => (
            <li key={p}><span className="lm-key lm-key--dot" style={{ "--c": PRIORITY_COLOR[p] }} />{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
