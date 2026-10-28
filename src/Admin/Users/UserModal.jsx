import { useEffect, useRef, useState } from "react";
import Icon from "../Icon.jsx";
import { phoneText } from "../js/adminHelpers.js";
import { ROLES, STATUSES, roleLabel } from "./usersData.js";

const EMPTY = {
  name: "",
  username: "",
  email: "",
  phone: "",
  role: ROLES[0],
  address: "",
  team: "",
  status: "Active",
  password: "",
};

/**
 * Add / edit dialog for a user account.
 *   user     = the user being edited, or null to add a new one
 *   existing = all users (used to block duplicate usernames and emails)
 *   teams    = rescue teams from Firebase (for the "Rescue team" dropdown)
 *   onSave(values), onClose()
 */
export default function UserModal({ user, existing, teams = [], onSave, onClose }) {
  const isEdit = Boolean(user);

  const [form, setForm] = useState(user ? { ...EMPTY, ...user, phone: phoneText(user.phone) } : EMPTY);
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
    const name = form.name.trim();
    const username = form.username.trim();
    const email = form.email.trim();

    // Is this value already used by a different user?
    const taken = (key, value) =>
      existing.some((u) => u.id !== user?.id && u[key].toLowerCase() === value.toLowerCase());

    if (!name) next.name = "Enter the full name.";

    if (!username) next.username = "Enter a username.";
    else if (!/^[a-z0-9._-]+$/i.test(username)) next.username = "Use only letters, numbers, dots, dashes or underscores.";
    else if (taken("username", username)) next.username = "This username is already taken.";

    if (!email) next.email = "Enter an email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    else if (taken("email", email)) next.email = "This email is already used.";

    if (!form.phone.trim()) next.phone = "Enter a contact number.";

    if (form.role === "Rescue Team") {
      if (!form.team) next.team = "Choose the team this member belongs to.";
      else if (!teams.some((t) => t.name === form.team)) next.team = "This team no longer exists. Choose another team.";
    }

    if (!isEdit && form.password.length < 8) next.password = "Use at least 8 characters.";

    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await onSave({
      ...form,
      name,
      username,
      email,
      phone: form.phone.trim(),
      address: form.address.trim(),
      // Only keep the team for the Rescue Team Member role.
      team: form.role === "Rescue Team" ? form.team : "",
    });
    } catch (err) {
      setErrors({ form: err.message });
      setSaving(false);
    }
  }

  return (
    <div className="rt-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="rt-modal" role="dialog" aria-modal="true" aria-labelledby="us-modal-title" onSubmit={submit} noValidate>
        <div className="rt-modal__head">
          <h2 id="us-modal-title">{isEdit ? `Edit ${user.name}` : "Add user"}</h2>
          <button type="button" className="admin-iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="rt-modal__body">
          <div className="rt-field rt-field--full">
            <label htmlFor="us-name">Full name</label>
            <input id="us-name" ref={firstField} value={form.name} onChange={set("name")} placeholder="e.g. Maria Santos" />
            {errors.name && <p className="rt-error">{errors.name}</p>}
          </div>

          <div className="rt-field">
            <label htmlFor="us-username">Username</label>
            <input id="us-username" value={form.username} onChange={set("username")} />
            {errors.username && <p className="rt-error">{errors.username}</p>}
          </div>

          <div className="rt-field">
            <label htmlFor="us-phone">Contact number</label>
            <input id="us-phone" value={form.phone} onChange={set("phone")} placeholder="09xx xxx xxxx" />
            {errors.phone && <p className="rt-error">{errors.phone}</p>}
          </div>

          <div className="rt-field rt-field--full">
            <label htmlFor="us-email">Email</label>
            <input id="us-email" type="email" value={form.email} onChange={set("email")} />
            {errors.email && <p className="rt-error">{errors.email}</p>}
          </div>

          <div className="rt-field">
            <label htmlFor="us-role">Role</label>
            <select id="us-role" value={form.role} onChange={set("role")}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
          </div>

          <div className="rt-field">
            <label htmlFor="us-status">Account status</label>
            <select id="us-status" value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Extra field that depends on the role */}
          {form.role === "Resident" && (
            <div className="rt-field rt-field--full">
              <label htmlFor="us-address">Address / barangay</label>
              <input id="us-address" value={form.address} onChange={set("address")} />
            </div>
          )}

          {form.role === "Rescue Team" && (
            <div className="rt-field rt-field--full">
              <label htmlFor="us-team">Rescue team</label>
              <select id="us-team" value={teams.some((t) => t.name === form.team) ? form.team : ""} onChange={set("team")}>
                <option value="">Choose a team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              {errors.team && <p className="rt-error">{errors.team}</p>}
            </div>
          )}

          {!isEdit && (
            <div className="rt-field rt-field--full">
              <label htmlFor="us-password">Temporary password</label>
              <input id="us-password" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
              {errors.password ? (
                <p className="rt-error">{errors.password}</p>
              ) : (
                <p className="rt-hint">The user should change this after the first sign-in.</p>
              )}
            </div>
          )}
        </div>

        {errors.form && <p className="rt-error" style={{ padding: "0 22px" }}>{errors.form}</p>}

        <div className="rt-modal__foot">
          <button type="button" className="admin-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add user"}
          </button>
        </div>
      </form>
    </div>
  );
}
