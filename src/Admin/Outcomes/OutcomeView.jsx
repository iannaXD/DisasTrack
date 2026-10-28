import { useEffect } from "react";
import Icon from "../Icon.jsx";
import { formatDateTime } from "../js/adminHelpers.js";

/**
 * Read-only dialog with the full details of one outcome (used by the officer).
 *   incident = the incident (its outcome is in incident.outcome)
 *   teamName = the rescue team's name
 *   onClose()
 * Nothing here can be edited or saved.
 */
export default function OutcomeView({ incident, teamName, onClose }) {
  const outcome = incident.outcome;

  // Close the dialog when Escape is pressed.
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // One label + value line.
  const Row = ({ label, children }) => (
    <div className="rt-field">
      <label>{label}</label>
      <p className="oc-value">{children}</p>
    </div>
  );

  return (
    <div className="rt-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rt-modal" role="dialog" aria-modal="true" aria-labelledby="oc-view-title">
        <div className="rt-modal__head">
          <h2 id="oc-view-title">Outcome · {incident.id}</h2>
          <button type="button" className="admin-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="rt-modal__body">
          <Row label="Report">{incident.type}</Row>
          <Row label="Status">{incident.status}</Row>
          <Row label="Location">{incident.location}</Row>
          <Row label="Rescue team">{teamName}</Row>
          <Row label="People rescued">
            {outcome.peopleRescued}
            {outcome.sample && <span className="oc-sample">Sample</span>}
          </Row>
          <Row label="Work finished">{formatDateTime(outcome.completedAt)}</Row>
          <Row label="Recorded by">{outcome.recordedBy || "—"}</Row>
          <div className="rt-field rt-field--full">
            <label>Operation notes</label>
            <p className="oc-value oc-value--notes">{outcome.notes || "No notes were added."}</p>
          </div>
        </div>

        <div className="rt-modal__foot">
          <button type="button" className="admin-btn admin-btn--primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
