import { useEffect, useRef, useState } from "react";
import Icon from "../Icon.jsx";

// ISO time -> text for <input type="datetime-local">, in the person's own time zone.
function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Dialog to record or edit the outcome of one incident (admin only).
 *   incident = the incident (its current outcome, if any, is in incident.outcome)
 *   onSave({ peopleRescued, notes, completedAt }), onClose()
 */
export default function OutcomeModal({ incident, onSave, onClose }) {
  const old = incident.outcome;
  const [form, setForm] = useState({
    peopleRescued: old ? String(old.peopleRescued) : "",
    completedAt: toLocalInput(old?.completedAt),
    notes: old?.notes || "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const firstField = useRef(null);

  // Focus the first field, and close the dialog when Escape is pressed.
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
    const count = Number(form.peopleRescued);
    const finished = new Date(form.completedAt);

    if (form.peopleRescued.trim() === "") next.peopleRescued = "Enter how many people were rescued (0 if none).";
    else if (!Number.isInteger(count) || count < 0 || count > 10000) next.peopleRescued = "Enter a whole number from 0 to 10,000.";

    if (!form.completedAt || Number.isNaN(finished.getTime())) next.completedAt = "Choose the date and time the work finished.";
    else if (finished.getTime() > Date.now() + 60 * 1000) next.completedAt = "The finish time cannot be in the future.";

    if (form.notes.length > 1000) next.notes = "Keep the notes under 1000 characters.";

    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await onSave({
        peopleRescued: count,
        completedAt: finished.toISOString(),
        notes: form.notes.trim(),
      });
    } catch (err) {
      setErrors({ form: err.message });
      setSaving(false);
    }
  }

  return (
    <div className="rt-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="rt-modal" role="dialog" aria-modal="true" aria-labelledby="oc-modal-title" onSubmit={submit} noValidate>
        <div className="rt-modal__head">
          <h2 id="oc-modal-title">{old ? "Edit outcome" : "Record outcome"} · {incident.id}</h2>
          <button type="button" className="admin-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="rt-modal__body">
          <p className="rt-hint rt-field--full">
            {incident.type} · {incident.location}
          </p>

          <div className="rt-field">
            <label htmlFor="oc-count">People rescued</label>
            <input id="oc-count" type="number" min="0" max="10000" ref={firstField} value={form.peopleRescued} onChange={set("peopleRescued")} />
            {errors.peopleRescued && <p className="rt-error">{errors.peopleRescued}</p>}
          </div>

          <div className="rt-field">
            <label htmlFor="oc-time">Work finished at</label>
            <input id="oc-time" type="datetime-local" value={form.completedAt} onChange={set("completedAt")} />
            {errors.completedAt && <p className="rt-error">{errors.completedAt}</p>}
          </div>

          <div className="rt-field rt-field--full">
            <label htmlFor="oc-notes">Operation notes (optional)</label>
            <textarea id="oc-notes" rows="4" value={form.notes} onChange={set("notes")} placeholder="What was done, who was involved, anything to remember." />
            {errors.notes && <p className="rt-error">{errors.notes}</p>}
          </div>
        </div>

        {errors.form && <p className="rt-error" style={{ padding: "0 22px" }}>{errors.form}</p>}

        <div className="rt-modal__foot">
          <button type="button" className="admin-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save outcome"}
          </button>
        </div>
      </form>
    </div>
  );
}
