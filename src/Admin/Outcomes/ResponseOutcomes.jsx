import { useMemo, useState } from "react";
import Icon from "../Icon.jsx";
import { useIncidents } from "../IncidentReports/IncidentsContext.jsx";
import { useTeams } from "../js/useTeams.js";
import { formatDateTime } from "../js/adminHelpers.js";
import OutcomeModal from "./OutcomeModal.jsx";
import OutcomeView from "./OutcomeView.jsx";
import { OUTCOME_STATUSES, addSampleOutcomes, removeSampleOutcomes, saveOutcome } from "./outcomesService.js";
import "../ReportsStats/ReportsStats.css"; // rs-empty, rs-card
import "./Outcomes.css";

/* ------------------------------------------------------------------
   Response Outcomes: how many people were rescued and what was done.

   The SAME screen is used twice:
     /admin/outcomes    readOnly = false  (admin can record and edit outcomes)
     /officer/outcomes  readOnly = true   (officer only views)

   Outcomes are saved inside each incident (see outcomesService.js).
------------------------------------------------------------------- */

// Notes longer than this are cut in the table (the full text is in the Edit / View dialog).
const NOTES_PREVIEW = 50;
const shortNotes = (text) => (text.length > NOTES_PREVIEW ? `${text.slice(0, NOTES_PREVIEW).trim()}…` : text);

const FILTERS = [
  { key: "all", label: "All" },
  { key: "recorded", label: "Recorded" },
  { key: "missing", label: "Missing" },
];

export default function ResponseOutcomes({ user, readOnly = false }) {
  const { incidents: allIncidents, loading, error } = useIncidents();
  const { teams } = useTeams();
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null); // the incident being edited (admin), or null
  const [viewing, setViewing] = useState(null); // the incident being read (officer), or null
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  // Reports that can have an outcome: in progress, resolved or closed (or already have one).
  const rows = useMemo(
    () =>
      allIncidents
        .filter((i) => OUTCOME_STATUSES.includes(i.status) || i.outcome)
        .sort((a, b) => (b.outcome?.completedAt || b.createdAt || "").localeCompare(a.outcome?.completedAt || a.createdAt || "")),
    [allIncidents]
  );

  const recorded = rows.filter((i) => i.outcome);
  // Resolved/Closed reports that still need an outcome ("In Progress" ones are not finished yet).
  const missing = rows.filter((i) => !i.outcome && (i.status === "Resolved" || i.status === "Closed"));
  const sampleCount = recorded.filter((i) => i.outcome.sample).length;
  const realCount = recorded.length - sampleCount;

  const visible = rows.filter((i) => {
    if (filter === "recorded") return Boolean(i.outcome);
    if (filter === "missing") return !i.outcome;
    return true;
  });

  // ----- summary cards -----
  const totalRescued = recorded.reduce((sum, i) => sum + (Number(i.outcome.peopleRescued) || 0), 0);
  const average = recorded.length ? Math.round((totalRescued / recorded.length) * 10) / 10 : 0;
  const stats = [
    { label: "People Rescued", value: totalRescued, icon: "users", tone: "brandy", note: "Across recorded outcomes" },
    { label: "Outcomes Recorded", value: recorded.length, icon: "check", tone: "jet", note: `Average ${average} per operation` },
    { label: "Missing Outcomes", value: missing.length, icon: "alert", tone: "sun", note: "Resolved or closed, none recorded" },
    { label: "In Progress", value: rows.filter((i) => i.status === "In Progress" && !i.outcome).length, icon: "clock", tone: "slate", note: "Rescue still ongoing" },
  ];

  // ----- actions (admin only) -----
  async function handleSave(values) {
    await saveOutcome(modal, values, user?.name);
    setModal(null);
  }

  // Runs one of the sample-data actions and shows its error, if any.
  async function runSample(action) {
    setBusy(true);
    setActionError("");
    try {
      await action(allIncidents);
    } catch (err) {
      setActionError(err.message);
    }
    setBusy(false);
  }

  const teamName = (id) => teams.find((t) => t.id === id)?.name || (id ? id : "None");

  return (
    <div className="rt-page">
      <section className="admin-stats" aria-label="Outcome summary">
        {stats.map((s) => (
          <article key={s.label} className="admin-card admin-stat">
            <div>
              <p className="admin-stat__label">{s.label}</p>
              <p className="admin-stat__value">{s.value}</p>
              <p className="admin-stat__note">{s.note}</p>
            </div>
            <span className={`admin-stat__chip admin-stat__chip--${s.tone}`}>
              <Icon name={s.icon} size={20} />
            </span>
          </article>
        ))}
      </section>

      <div className="rt-toolbar">
        <div className="admin-chips" role="group" aria-label="Filter outcomes">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`admin-chip ${filter === f.key ? "is-active" : ""}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="rt-chipcount">
                {f.key === "all" ? rows.length : f.key === "recorded" ? recorded.length : rows.length - recorded.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sample data (admin only). The "Add" button disappears as soon as a real outcome exists. */}
      {!readOnly && (realCount === 0 || sampleCount > 0) && (
        <div className="oc-sampletools">
          {realCount === 0 && sampleCount === 0 && (
            <>
              <button type="button" className="admin-btn" disabled={busy} onClick={() => runSample(addSampleOutcomes)}>
                Add sample outcomes
              </button>
              <p className="rt-hint" style={{ margin: 0 }}>
                For testing only. This button disappears once a real outcome is recorded.
              </p>
            </>
          )}
          {sampleCount > 0 && (
            <>
              <button type="button" className="admin-btn" disabled={busy} onClick={() => runSample(removeSampleOutcomes)}>
                Remove sample outcomes ({sampleCount})
              </button>
              <p className="rt-hint" style={{ margin: 0 }}>Test records are marked "Sample". Saving an edit turns a sample into a real record.</p>
            </>
          )}
        </div>
      )}

      {(error || actionError) && <p className="rt-error">{(error || { message: actionError }).message}</p>}

      <section className="admin-card rt-card" aria-label="Response outcomes">
        {loading ? (
          <p className="rs-empty">Loading outcomes…</p>
        ) : visible.length === 0 ? (
          <p className="rs-empty">
            {rows.length === 0
              ? "No reports are in progress, resolved or closed yet. Outcomes will appear here once rescue work starts."
              : "No reports match this filter."}
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Report</th>
                  <th scope="col">Location</th>
                  <th scope="col">Team</th>
                  <th scope="col">Status</th>
                  <th scope="col">Rescued</th>
                  <th scope="col">Finished</th>
                  <th scope="col">Notes</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <span className="admin-table__strong">{i.id}</span>
                      <span className="rt-sub">{i.type}</span>
                    </td>
                    <td>{i.location}</td>
                    <td>{teamName(i.team)}</td>
                    <td>{i.status}</td>
                    <td>
                      {i.outcome ? (
                        <>
                          {i.outcome.peopleRescued}
                          {i.outcome.sample && <span className="oc-sample">Sample</span>}
                        </>
                      ) : (
                        <span className="rt-muted">Not recorded</span>
                      )}
                    </td>
                    <td>{i.outcome ? formatDateTime(i.outcome.completedAt) : <span className="rt-muted">—</span>}</td>
                    <td className="oc-notes" title={i.outcome?.notes || ""}>
                      {i.outcome?.notes ? shortNotes(i.outcome.notes) : <span className="rt-muted">—</span>}
                    </td>
                    <td className="admin-table__action">
                      {readOnly ? (
                        // Officer: can only read the full details.
                        i.outcome && (
                          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setViewing(i)}>
                            View
                          </button>
                        )
                      ) : (
                        // Admin: can record or edit.
                        <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal(i)}>
                          {i.outcome ? "Edit" : "Record"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && <OutcomeModal incident={modal} onSave={handleSave} onClose={() => setModal(null)} />}
      {viewing && <OutcomeView incident={viewing} teamName={teamName(viewing.team)} onClose={() => setViewing(null)} />}
    </div>
  );
}
