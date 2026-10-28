import { useEffect, useRef, useState } from "react";
import Icon from "../Icon.jsx";
import { MANUAL_STATUSES, TEAM_TYPES } from "./rescueTeamsData.js";

const EMPTY = {
  name: "",
  type: TEAM_TYPES[0],
  leader: "",
  phone: "",
  base: "",
  status: "Available",
};

/**
 * Add / edit dialog for a team.
 *   team     = the team being edited, or null to add a new one
 *   existing = all teams (used to block duplicate names)
 *   onSave(values) may be async; if it throws, the message is shown in the dialog.
 */
export default function TeamModal({ team, existing, onSave, onClose }) {
  const isEdit = Boolean(team);
  const deployed = team?.status === "Deployed";

  const [form, setForm] = useState(() => (team ? { ...EMPTY, ...team } : EMPTY));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    const next = {};
    const name = form.name.trim();

    if (!name) next.name = "Enter a team name.";
    else if (existing.some((t) => t.id !== team?.id && t.name.toLowerCase() === name.toLowerCase()))
      next.name = "A team with this name already exists.";
    if (!form.leader.trim()) next.leader = "Enter the team leader.";
    if (!form.phone.trim()) next.phone = "Enter a contact number.";

    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      // Only the fields this form edits (Firebase does not accept "undefined").
      await onSave({
        name,
        type: form.type,
        leader: form.leader.trim(),
        phone: form.phone.trim(),
        base: form.base.trim(),
        status: deployed ? "Deployed" : form.status,
      });
    } catch (err) {
      setErrors({ form: err.message });
      setSaving(false);
    }
  }

  return (
    <div className="rt-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="rt-modal" role="dialog" aria-modal="true" aria-labelledby="rt-modal-title" onSubmit={submit} noValidate>
        <div className="rt-modal__head">
          <h2 id="rt-modal-title">{isEdit ? `Edit ${team.name}` : "Add rescue team"}</h2>
          <button type="button" className="admin-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="rt-modal__body">
          <div className="rt-field rt-field--full">
            <label htmlFor="rt-name">Team name</label>
            <input id="rt-name" ref={firstField} value={form.name} onChange={set("name")} placeholder="e.g. Fire Team Charlie" />
            {errors.name && <p className="rt-error">{errors.name}</p>}
          </div>

          <div className="rt-field">
            <label htmlFor="rt-type">Team type</label>
            <select id="rt-type" value={form.type} onChange={set("type")}>
              {TEAM_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="rt-field">
            <label htmlFor="rt-status">Availability</label>
            {deployed ? (
              <>
                <select id="rt-status" value="Deployed" disabled>
                  <option>Deployed</option>
                </select>
                <p className="rt-hint">Set automatically while the team is on an incident.</p>
              </>
            ) : (
              <select id="rt-status" value={form.status} onChange={set("status")}>
                {MANUAL_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          <div className="rt-field">
            <label htmlFor="rt-leader">Team leader</label>
            <input id="rt-leader" value={form.leader} onChange={set("leader")} />
            {errors.leader && <p className="rt-error">{errors.leader}</p>}
          </div>

          <div className="rt-field">
            <label htmlFor="rt-phone">Contact number</label>
            <input id="rt-phone" value={form.phone} onChange={set("phone")} placeholder="09xx xxx xxxx" />
            {errors.phone && <p className="rt-error">{errors.phone}</p>}
          </div>

          <div className="rt-field rt-field--full">
            <label htmlFor="rt-base">Base / station</label>
            <input id="rt-base" value={form.base} onChange={set("base")} />
            {!isEdit && (
              <p className="rt-hint">
                Add the team's members on the Users screen: role "Rescue Team Member", then pick this team.
              </p>
            )}
          </div>
        </div>

        {errors.form && <p className="rt-error" style={{ padding: "0 22px" }}>{errors.form}</p>}

        <div className="rt-modal__foot">
          <button type="button" className="admin-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add team"}
          </button>
        </div>
      </form>
    </div>
  );
}
