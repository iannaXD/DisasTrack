import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon.jsx";
import TeamModal from "./TeamModal.jsx";
import SeedModal from "./SeedModal.jsx";
import { MANUAL_STATUSES, STATUSES } from "./rescueTeamsData.js";
import { useTeams } from "../js/useTeams.js";
import { useAccounts } from "../js/useAccounts.js";
import { createTeam, deleteTeam, setTeamStatus, updateTeam } from "../js/teamService.js";
import { logAction } from "../Audit/auditLog.js";

const INCIDENTS_PATH = "/admin/incident-reports";
const slug = (text) => text.toLowerCase().replace(/\s+/g, "-");

function StatusBadge({ label }) {
  return <span className={`rt-badge rt-badge--${slug(label)}`}>{label}</span>;
}

export default function RescueTeams() {
  const { teams, loading, error } = useTeams();
  const { accounts } = useAccounts();
  const [actionError, setActionError] = useState("");
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null); // null | { team } (team null = add)
  const [removing, setRemoving] = useState(null); // team awaiting delete confirmation
  const [seeding, setSeeding] = useState(false);

  // The members of a team are the "Rescue Team" accounts whose team name matches.
  const membersOf = (team) => accounts.filter((a) => a.role === "Rescue Team" && a.team === team.name);
  const totalMembers = teams.reduce((sum, t) => sum + membersOf(t).length, 0);
  const count = (status) => teams.filter((t) => t.status === status).length;

  const stats = [
    { label: "Total Teams", value: teams.length, icon: "users", tone: "slate", note: `${totalMembers} members` },
    { label: "Available", value: count("Available"), icon: "check", tone: "jet", note: `${count("Standby")} on standby` },
    { label: "Deployed", value: count("Deployed"), icon: "rescue", tone: "brandy", note: "On an incident" },
    { label: "Off Duty", value: count("Off duty"), icon: "clock", tone: "sun", note: "Not reachable" },
  ];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter(
      (t) =>
        (tab === "all" || t.status === tab) &&
        (!q || [t.name, t.type, t.leader, t.base].some((v) => (v || "").toLowerCase().includes(q)))
    );
  }, [teams, tab, query]);

  // Errors thrown here are shown inside the dialog.
  async function save(values) {
    if (modal.team) {
      await updateTeam(modal.team, values, accounts);
      logAction({ category: "System", action: "Rescue team updated", target: values.name, details: `${values.type} team edited` });
    } else {
      await createTeam(values, teams);
      logAction({ category: "System", action: "Rescue team added", target: values.name, details: `${values.type} team created` });
    }
    setModal(null);
  }

  async function changeStatus(team, status) {
    setActionError("");
    try {
      await setTeamStatus(team.id, status);
      logAction({ category: "Assignment", action: "Team availability changed", target: team.name, details: `${team.status} -> ${status}` });
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function confirmRemove() {
    setActionError("");
    try {
      await deleteTeam(removing);
      logAction({ category: "System", action: "Rescue team removed", target: removing.name, details: `${removing.type} team deleted` });
    } catch (err) {
      setActionError(err.message);
    }
    setRemoving(null);
  }

  function seedDone(created) {
    setSeeding(false);
    logAction({ category: "System", action: "Default teams created", target: `${created} members`, details: "8 rescue teams set up" });
  }

  return (
    <div className="rt-page">
      {/* summary */}
      <section className="admin-stats" aria-label="Team summary">
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

      {/* toolbar */}
      <div className="rt-toolbar">
        <div className="admin-chips" role="group" aria-label="Filter by status">
          {["all", ...STATUSES].map((key) => (
            <button
              key={key}
              type="button"
              className={`admin-chip ${tab === key ? "is-active" : ""}`}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {key === "all" ? "All" : key}
              <span className="rt-chipcount">{key === "all" ? teams.length : count(key)}</span>
            </button>
          ))}
        </div>

        <div className="rt-toolbar__right">
          <label className="rt-search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Search teams…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setModal({ team: null })}>
            <Icon name="plus" size={16} />
            Add team
          </button>
        </div>
      </div>

      {(error || actionError) && <p className="rt-error">{(error || { message: actionError }).message}</p>}

      {/* first-time setup */}
      {!loading && !error && teams.length === 0 && (
        <section className="admin-card rt-banner" aria-label="First-time setup">
          <div>
            <h2 className="admin-card__title">No rescue teams yet</h2>
            <p className="admin-card__sub">
              Create the 8 starting teams (2 firefighter, 2 police, 2 medical, 2 road officer) with 5 members each,
              or add a team yourself.
            </p>
          </div>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setSeeding(true)}>
            Set up default teams
          </button>
        </section>
      )}

      {/* table */}
      <section className="admin-card rt-card" aria-label="Rescue teams">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Type</th>
                <th scope="col">Leader</th>
                <th scope="col">Members</th>
                <th scope="col">Status</th>
                <th scope="col">Current assignment</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="admin-table__strong">{t.name}</span>
                    <span className="rt-sub">{t.id} · {t.base || "No base set"}</span>
                  </td>
                  <td>{t.type}</td>
                  <td>
                    {t.leader}
                    <span className="rt-sub">{t.phone}</span>
                  </td>
                  <td>{membersOf(t).length}</td>
                  <td>
                    {t.status === "Deployed" ? (
                      <StatusBadge label="Deployed" />
                    ) : (
                      <select
                        className={`rt-status rt-status--${slug(t.status)}`}
                        value={t.status}
                        onChange={(e) => changeStatus(t, e.target.value)}
                        aria-label={`Availability of ${t.name}`}
                      >
                        {MANUAL_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {t.assignment ? (
                      <Link className="admin-link-btn" to={`${INCIDENTS_PATH}/${t.assignment}`}>
                        {t.assignment}
                      </Link>
                    ) : (
                      <span className="rt-muted">None</span>
                    )}
                  </td>
                  <td className="admin-table__action">
                    <div className="rt-actions">
                      <button
                        type="button"
                        className="rt-iconbtn"
                        data-tip="Edit team"
                        aria-label={`Edit ${t.name}`}
                        onClick={() => setModal({ team: t })}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        className="rt-iconbtn rt-iconbtn--danger"
                        data-tip={t.status === "Deployed" ? "Deployed teams can't be removed" : "Remove team"}
                        aria-label={`Remove ${t.name}`}
                        disabled={t.status === "Deployed"}
                        onClick={() => setRemoving(t)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && (
            <div className="rt-empty">
              <h3>Loading teams…</h3>
            </div>
          )}

          {!loading && teams.length > 0 && visible.length === 0 && (
            <div className="rt-empty">
              <h3>No teams found</h3>
              <p>Try a different status or search term.</p>
            </div>
          )}
        </div>
      </section>

      {modal && (
        <TeamModal team={modal.team} existing={teams} onSave={save} onClose={() => setModal(null)} />
      )}

      {seeding && (
        <SeedModal
          existingUsernames={accounts.map((a) => (a.username || "").toLowerCase())}
          onDone={seedDone}
          onClose={() => setSeeding(false)}
        />
      )}

      {removing && (
        <div className="rt-overlay" onMouseDown={(e) => e.target === e.currentTarget && setRemoving(null)}>
          <div className="rt-modal rt-modal--small" role="alertdialog" aria-modal="true" aria-labelledby="rt-remove-title">
            <div className="rt-modal__body rt-modal__body--single">
              <h2 id="rt-remove-title">Remove {removing.name}?</h2>
              {membersOf(removing).length > 0 ? (
                <p>
                  This team still has {membersOf(removing).length} members. Move them to another team (or delete
                  them) on the Users screen first, then remove the team.
                </p>
              ) : (
                <p>This team will no longer appear in the list or be available for dispatch.</p>
              )}
            </div>
            <div className="rt-modal__foot">
              <button type="button" className="admin-btn" onClick={() => setRemoving(null)}>Cancel</button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={membersOf(removing).length > 0}
                onClick={confirmRemove}
              >
                Remove team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
