import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useIncidents } from "./IncidentsContext.jsx";
import {
  ACTIVE_TEAM_STATUSES,
  DISPATCHABLE_STATUSES,
  INCIDENT_TYPES,
  OPEN_STATUSES,
  PRIORITIES,
  ago,
  duplicatesOf,
  formatCoords,
  statusLabel,
} from "./incidentsData.js";
import IncidentMap from "./IncidentMap.jsx";
import { Badge, IconAlert, IconBack, IconCheck, IconImage } from "./incidentShared.jsx";
import { useTeams } from "../js/useTeams.js";
import { setTeamAssignment } from "../js/teamService.js";

const ADMIN_PATH = "/admin/incident-reports";

// Straight-line distance in km between two points (used to show how far a team is).
function distanceKm(a, b) {
  if (!a || !b || ![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return null;
  const rad = (deg) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * readOnly = true is the Disaster Management Officer version: the whole report can be
 * read, but there are no buttons that change it (verify, priority, dispatch, ...).
 * basePath is where the list lives ("/officer/incident-reports" for the officer).
 */
export default function IncidentDetail({ readOnly = false, basePath = ADMIN_PATH }) {
  const LIST_PATH = basePath;
  const { id } = useParams();
  const navigate = useNavigate();
  const { incidents, loading, update } = useIncidents();
  const { teams } = useTeams(); // live list from Firebase /rescueTeams

  const [teamId, setTeamId] = useState(null);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [viewing, setViewing] = useState(null); // photo shown full-size

  const incident = incidents.find((i) => i.id === id);

  if (!incident && loading) {
    return (
      <div className="ir-page">
        <p className="ir-muted">Loading report…</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="ir-page">
        <section className="ir-card ir-empty">
          <h3>Report not found</h3>
          <p>We couldn't find a report with the ID {id}.</p>
          <Link className="ir-btn ir-btn--sm" to={LIST_PATH}>Back to Incident Reports</Link>
        </section>
      </div>
    );
  }

  const { status } = incident;
  // Pictures sent by the resident app: a list of "data:image/jpeg;base64,..." strings.
  // Firebase may hand a list back as an object, so normalise it to an array.
  const photos = (Array.isArray(incident.photoData) ? incident.photoData : Object.values(incident.photoData || {})).filter(Boolean);
  const isOpen = OPEN_STATUSES.includes(status);
  const canDispatch = DISPATCHABLE_STATUSES.includes(status);
  const teamWorking = ACTIVE_TEAM_STATUSES.includes(status);
  const assignedTeam = teams.find((t) => t.id === incident.team);
  const chosenTeam = teams.find((t) => t.id === teamId);
  // Newest first. "at" is an ISO timestamp, so it sorts as text.
  const log = [...incident.activity].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const coords = formatCoords(incident.lat, incident.lng);
  const duplicates = duplicatesOf(incident.id, incidents); // reports from other residents about this same incident
  const original = incident.duplicateOf ? incidents.find((i) => i.id === incident.duplicateOf) : null;

  // Runs a save and shows the error (if any) instead of failing silently.
  async function run(task) {
    setError("");
    try {
      await task();
    } catch (err) {
      setError(err.message);
    }
  }

  // Frees the team when its incident is finished or reopened.
  const releaseTeam = () => (incident.team ? setTeamAssignment(incident.team, null) : null);

  const verify = () => run(() => update(id, { status: "Verified" }, "Report verified by Admin"));
  const confirmReject = () => {
    run(() => update(id, { status: "Rejected" }, `Report rejected: ${reason.trim() || "no reason given"}`));
    setRejecting(false);
    setReason("");
  };
  const changePriority = (p) => {
    if (p !== incident.priority)
      run(() => update(id, { priority: p }, `Priority changed from ${incident.priority} to ${p}`));
  };
  const changeType = (event) => {
    const value = event.target.value;
    run(() => update(id, { type: value }, `Classification changed to ${value}`));
  };
  const queue = () => run(() => update(id, { status: "Awaiting Assignment" }, "Report queued for team assignment"));
  const dispatch = () =>
    run(async () => {
      // 1) the incident (status + team id)  2) the team (Deployed + which incident)
      await update(id, { status: "Team Assigned", team: chosenTeam.id }, `${chosenTeam.name} dispatched`);
      await setTeamAssignment(chosenTeam.id, id);
      setTeamId(null);
    });
  const startWork = () => run(() => update(id, { status: "In Progress" }, "Team started working on the incident"));
  const resolve = () =>
    run(async () => {
      await update(id, { status: "Resolved" }, "Marked as resolved");
      await releaseTeam();
    });
  const close = () => run(() => update(id, { status: "Closed" }, "Report closed by Admin"));
  const reopen = () =>
    run(async () => {
      await update(id, { status: "Pending", team: null }, "Report reopened");
      await releaseTeam();
    });
  const markDuplicate = () =>
    run(() => update(id, { status: "Duplicate" }, `Marked as duplicate of ${incident.duplicateOf}`));
  const notDuplicate = () =>
    run(() => update(id, { duplicateOf: null, match: null }, "Duplicate flag dismissed"));

  return (
    <div className="ir-page">
      {/* header */}
      <nav className="ir-crumbs" aria-label="Breadcrumb">
        <Link to={LIST_PATH}>Incident Reports</Link>
        <span aria-hidden="true">›</span>
        <span>{incident.id}</span>
      </nav>

      <div className="ir-detail-head">
        <div className="ir-detail-title">
          <h2>{incident.id} · {incident.type}</h2>
          <Badge label={incident.priority} />
          <Badge label={status} />
        </div>
        <button type="button" className="ir-btn" onClick={() => navigate(LIST_PATH)}>
          <IconBack /> Back to list
        </button>
      </div>

      <div className="ir-detail-grid">
        {/* left column */}
        <div className="ir-stack">
          <section className="ir-card">
            <div className="ir-card__head"><h3 className="ir-card__title">Report overview</h3></div>
            <div className="ir-card__body">
              <dl className="ir-fields">
                <div className="ir-field"><dt>Reporter</dt><dd>{incident.reporter}</dd></div>
                <div className="ir-field"><dt>Contact</dt><dd>{incident.phone}</dd></div>
                <div className="ir-field"><dt>Reported</dt><dd>{ago(incident.createdAt)}</dd></div>
                <div className="ir-field"><dt>Incident type</dt><dd>{incident.type}</dd></div>
                <div className="ir-field"><dt>Location</dt><dd>{incident.location}</dd></div>
                <div className="ir-field"><dt>GPS coordinates</dt><dd>{coords}</dd></div>
              </dl>
              <h4 className="ir-subtitle">Description</h4>
              <p className="ir-desc">{incident.description}</p>
            </div>
          </section>

          <section className="ir-card">
            <div className="ir-card__head">
              <h3 className="ir-card__title">Attached photos ({photos.length || incident.photos})</h3>
            </div>
            <div className="ir-card__body">
              {photos.length > 0 ? (
                <div className="ir-photos">
                  {photos.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      className="ir-photo ir-photo--img"
                      onClick={() => setViewing(src)}
                      aria-label={`View photo ${i + 1} full size`}
                    >
                      <img src={src} alt={`Photo ${i + 1} from the reporter`} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : incident.photos > 0 ? (
                // Older / sample reports only stored a photo count, not the pictures.
                <div className="ir-photos">
                  {Array.from({ length: incident.photos }, (_, i) => (
                    <div key={i} className="ir-photo" role="img" aria-label={`Photo ${i + 1} (placeholder)`}>
                      <IconImage />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ir-muted">The reporter did not attach any photos.</p>
              )}
            </div>
          </section>

          {viewing && (
            <div className="ir-lightbox" role="dialog" aria-label="Photo" onClick={() => setViewing(null)}>
              <img src={viewing} alt="Full-size photo from the reporter" />
              <button type="button" className="ir-lightbox__close" onClick={() => setViewing(null)} aria-label="Close photo">×</button>
            </div>
          )}

          <section className="ir-card">
            <div className="ir-card__head">
              <h3 className="ir-card__title">Location</h3>
              <span className="ir-muted">GPS {coords}</span>
            </div>
            <div className="ir-card__body">
              <IncidentMap incident={incident} />
            </div>
          </section>
        </div>

        {/* right column */}
        <div className="ir-stack">
          {readOnly ? (
            <section className="ir-card">
              <div className="ir-card__head"><h3 className="ir-card__title">Response</h3></div>
              <div className="ir-section">
                <dl className="ir-fields ir-fields--single">
                  <div className="ir-field"><dt>Priority</dt><dd><Badge label={incident.priority} /></dd></div>
                  <div className="ir-field"><dt>Status</dt><dd><Badge label={status} /></dd></div>
                  <div className="ir-field">
                    <dt>Rescue team</dt>
                    <dd>
                      {incident.team
                        ? assignedTeam
                          ? `${assignedTeam.name} (${assignedTeam.type})`
                          : `Team ${incident.team}`
                        : "No team assigned"}
                    </dd>
                  </div>
                </dl>
                <p className="ir-hint-text">View only. Verifying, dispatching and status changes are done by the admin.</p>
              </div>
            </section>
          ) : (
          <section className="ir-card">
            <div className="ir-card__head"><h3 className="ir-card__title">Actions</h3></div>

            {error && <p className="ir-note" role="alert">{error}</p>}

            {/* verification */}
            <div className="ir-section">
              <h4 className="ir-section__title">Verification</h4>

              {status === "Pending" && !rejecting && (
                <div className="ir-actions-row">
                  <button type="button" className="ir-btn ir-btn--primary" onClick={verify}>
                    <IconCheck /> Verify report
                  </button>
                  <button type="button" className="ir-btn" onClick={() => setRejecting(true)}>
                    Reject
                  </button>
                </div>
              )}

              {status === "Pending" && rejecting && (
                <div>
                  <label className="ir-label" htmlFor="reject-reason">Reason for rejecting</label>
                  <textarea
                    id="reject-reason"
                    className="ir-input ir-textarea"
                    placeholder="For example: no valid location, prank report…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="ir-actions-row">
                    <button type="button" className="ir-btn ir-btn--primary" onClick={confirmReject}>
                      Confirm reject
                    </button>
                    <button type="button" className="ir-btn" onClick={() => setRejecting(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {["Verified", "Awaiting Assignment", "Team Assigned", "In Progress"].includes(status) && (
                <p className="ir-note ir-note--ok"><IconCheck /> This report has been verified.</p>
              )}

              {status === "Verified" && (
                <button type="button" className="ir-btn ir-btn--block" onClick={queue}>
                  Mark as awaiting assignment
                </button>
              )}

              {status === "Resolved" && (
                <button type="button" className="ir-btn ir-btn--dark ir-btn--block" onClick={close}>
                  Close report
                </button>
              )}

              {!isOpen && (
                <>
                  <p className="ir-note">
                    This report is <strong>{statusLabel(status).toLowerCase()}</strong> and can no longer be edited.
                  </p>
                  <button type="button" className="ir-btn ir-btn--block" onClick={reopen}>
                    Reopen report
                  </button>
                </>
              )}
            </div>

            {/* priority + classification */}
            <div className="ir-section">
              <h4 className="ir-section__title">Priority</h4>
              <div className="ir-chiprow" role="group" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`ir-chip ${incident.priority === p ? "is-active" : ""}`}
                    aria-pressed={incident.priority === p}
                    disabled={!isOpen}
                    onClick={() => changePriority(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <label className="ir-label ir-label--spaced" htmlFor="classification">Classification</label>
              <select
                id="classification"
                className="ir-input ir-input--select"
                value={incident.type}
                disabled={!isOpen}
                onChange={changeType}
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* team assignment */}
            <div className="ir-section">
              <h4 className="ir-section__title">Rescue team</h4>

              {teamWorking && assignedTeam && (
                <>
                  <div className="ir-assigned">
                    <strong>{assignedTeam.name}</strong>
                    <span>{assignedTeam.type} · {status === "In Progress" ? "working on site" : "on the way"}</span>
                  </div>
                  {status === "Team Assigned" && (
                    <button type="button" className="ir-btn ir-btn--primary ir-btn--block" onClick={startWork}>
                      Start response (in progress)
                    </button>
                  )}
                  <button type="button" className="ir-btn ir-btn--dark ir-btn--block" onClick={resolve}>
                    Mark as resolved
                  </button>
                </>
              )}

              {teamWorking && incident.team && !assignedTeam && (
                <p className="ir-muted">Assigned to team {incident.team} (not found in Rescue Teams).</p>
              )}

              {(status === "Resolved" || status === "Closed") && assignedTeam && (
                <div className="ir-assigned">
                  <strong>{assignedTeam.name}</strong>
                  <span>Completed this response</span>
                </div>
              )}

              {(status === "Pending" || canDispatch) && (
                <>
                  {teams.length === 0 && (
                    <p className="ir-muted">No rescue teams yet. Add them on the Rescue Teams screen.</p>
                  )}
                  {teams.map((t) => {
                    const free = t.status === "Available" || t.status === "Standby";
                    const km = distanceKm(incident, t.location);
                    const picked = teamId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`ir-team ${picked ? "is-selected" : ""}`}
                        disabled={!free || status === "Pending"}
                        aria-pressed={picked}
                        onClick={() => setTeamId(t.id)}
                      >
                        <span className="ir-team__radio" aria-hidden="true" />
                        <span>
                          <span className="ir-team__name">{t.name}</span>
                          <span className="ir-team__meta">
                            {km !== null ? `${km.toFixed(1)} km · ` : `${t.type} · `}{t.status}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="ir-btn ir-btn--primary ir-btn--block"
                    disabled={!canDispatch || !chosenTeam}
                    onClick={dispatch}
                  >
                    Dispatch team
                  </button>
                  {status === "Pending" && (
                    <p className="ir-hint-text">Verify the report first to dispatch a team.</p>
                  )}
                </>
              )}

              {(status === "Duplicate" || status === "Rejected") && (
                <p className="ir-muted">No team assigned.</p>
              )}
            </div>
          </section>
          )}

          {status === "Duplicate" && incident.duplicateOf && (
            <section className="ir-dup" aria-label="Duplicate report">
              <div className="ir-dup__title"><IconAlert /> Duplicate report</div>
              <p>
                This is the same incident as{" "}
                <Link to={`${LIST_PATH}/${incident.duplicateOf}`}>{incident.duplicateOf}</Link>
                {original ? ` (${original.reporter}, ${statusLabel(original.status)})` : ""}
                {incident.match ? ` · ${incident.match}% match` : ""}.
              </p>
            </section>
          )}

          {duplicates.length > 0 && (
            <section className="ir-card" aria-label="Duplicate reports">
              <details className="ir-dups" open>
                <summary className="ir-dups__summary">
                  <span className="ir-card__title">Duplicate reports ({duplicates.length})</span>
                  <span className="ir-muted">from other residents</span>
                </summary>
                <ul className="ir-dups__list">
                  {duplicates.map((d) => (
                    <li key={d.id} className="ir-dups__item">
                      <div className="ir-dups__row">
                        <Link className="ir-id" to={`${LIST_PATH}/${d.id}`}>{d.id}</Link>
                        <Badge label={d.status} />
                        <span className="ir-muted">{ago(d.createdAt)}</span>
                      </div>
                      <div className="ir-dups__who">{d.reporter} · {d.phone}</div>
                      <p className="ir-dups__desc">{d.description}</p>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )}

          {incident.duplicateOf && status === "Pending" && (
            <section className="ir-dup" aria-label="Possible duplicate">
              <div className="ir-dup__title"><IconAlert /> Possible duplicate detected</div>
              <p>
                {incident.match}% match with {incident.duplicateOf}. Same area and reported close together.
              </p>
              <div className="ir-actions-row">
                <Link className="ir-btn ir-btn--sm" to={`${LIST_PATH}/${incident.duplicateOf}`}>
                  Compare reports
                </Link>
                {!readOnly && (
                  <>
                    <button type="button" className="ir-btn ir-btn--sm ir-btn--primary" onClick={markDuplicate}>
                      Mark as duplicate
                    </button>
                    <button type="button" className="ir-btn ir-btn--sm" onClick={notDuplicate}>
                      Not a duplicate
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          <section className="ir-card">
            <div className="ir-card__head"><h3 className="ir-card__title">Activity log</h3></div>
            <div className="ir-card__body">
              <ol className="ir-log">
                {log.map((entry, i) => (
                  <li key={i}>
                    <span className="ir-log__text">{entry.text}</span>
                    <span className="ir-log__time">{ago(entry.at)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
