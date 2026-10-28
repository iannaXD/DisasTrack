import { useRef, useState } from "react";
import { logAction } from "../Audit/auditLog.js";
import { useAuditLogs } from "../Audit/useAuditLogs.js";
import { changeOwnPassword, updateOwnProfile } from "../js/accountService.js";
import { formatDate, formatDateTime, phoneText, resizePhoto } from "../js/adminHelpers.js";
import "./Profile.css";

// Counts how many simple password rules are met (0 to 4).
function passwordScore(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const STRENGTH_TEXT = ["", "Weak", "Fair", "Good", "Strong"];

/**
 * Props (passed from App.jsx):
 *   user     = the signed-in admin's profile from Firebase (uid, name, email, phone, photo, ...)
 *   onUpdate = function that saves the new name so the sidebar updates too
 */
export default function Profile({ user, onUpdate }) {
  // ---- details form ----
  const [details, setDetails] = useState({
    name: user.name || "",
    email: user.email || "",
    phone: phoneText(user.phone),
    office: user.office || "",
  });
  const [detailErrors, setDetailErrors] = useState({});
  const [detailsSaved, setDetailsSaved] = useState(false);

  const setDetail = (key) => (event) => {
    setDetails((d) => ({ ...d, [key]: event.target.value }));
    setDetailsSaved(false);
  };

  async function saveDetails(event) {
    event.preventDefault();
    const next = {};
    if (!details.name.trim()) next.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(details.email.trim())) next.email = "Enter a valid email address.";
    if (!/^[0-9+\s-]{7,20}$/.test(details.phone.trim())) next.phone = "Enter a valid contact number.";

    setDetailErrors(next);
    if (Object.keys(next).length) return;

    // Save to Firebase, then update the screen and the sidebar.
    const values = {
      name: details.name.trim(),
      email: details.email.trim(),
      phone: details.phone.trim(),
      office: details.office.trim(),
    };
    try {
      await updateOwnProfile(user.uid, values);
      logAction({ category: "Account", action: "Profile updated", target: values.name, details: "Name and contact details saved" });
      onUpdate(values);
      setDetailsSaved(true);
    } catch (err) {
      setDetailErrors({ form: err.message });
    }
  }

  // ---- password form ----
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [pwSaved, setPwSaved] = useState(false);

  const setPassword = (key) => (event) => {
    setPw((p) => ({ ...p, [key]: event.target.value }));
    setPwSaved(false);
  };

  async function savePassword(event) {
    event.preventDefault();
    const next = {};
    if (!pw.current) next.current = "Enter your current password.";
    if (pw.next.length < 8) next.next = "Use at least 8 characters.";
    else if (pw.next === pw.current) next.next = "The new password must be different.";
    if (pw.confirm !== pw.next) next.confirm = "The passwords do not match.";

    setPwErrors(next);
    if (Object.keys(next).length) return;

    try {
      await changeOwnPassword(pw.current, pw.next);
      logAction({ category: "Account", action: "Password changed", target: user.name, details: "Own password changed" });
      setPw({ current: "", next: "", confirm: "" });
      setPwSaved(true);
    } catch (err) {
      setPwErrors({ current: err.message });
    }
  }

  // ---- profile photo ----
  const fileInput = useRef(null);
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  async function choosePhoto(event) {
    const file = event.target.files[0];
    event.target.value = ""; // lets the same file be picked again later
    if (!file) return;

    setPhotoError("");
    if (!file.type.startsWith("image/")) return setPhotoError("Please choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setPhotoError("The image is too big. Use one under 5 MB.");

    setPhotoBusy(true);
    try {
      const photo = await resizePhoto(file);
      await updateOwnProfile(user.uid, { photo });
      onUpdate({ photo });
    } catch (err) {
      setPhotoError(err.message);
    }
    setPhotoBusy(false);
  }

  async function removePhoto() {
    setPhotoError("");
    setPhotoBusy(true);
    try {
      await updateOwnProfile(user.uid, { photo: null }); // null deletes it from the database
      onUpdate({ photo: "" });
    } catch (err) {
      setPhotoError(err.message);
    }
    setPhotoBusy(false);
  }

  // ---- recent activity: my latest entries from the audit log ----
  const { logs } = useAuditLogs();
  const myActivity = logs.filter((entry) => entry.actorId === user.uid).slice(0, 5);

  const score = passwordScore(pw.next);
  const initial = (user.name || "A")[0].toUpperCase();

  return (
    <div className="pf-page">
      {/* left column: summary */}
      <div className="pf-side">
        <section className="admin-card pf-summary" aria-label="Profile summary">
          <div className="pf-avatar">
            {user.photo ? <img src={user.photo} alt="Your profile" /> : initial}
          </div>
          <h2 className="pf-name">{user.name || "Admin"}</h2>
          <span className="pf-role">{user.role}</span>

          <input ref={fileInput} type="file" accept="image/*" onChange={choosePhoto} hidden />
          <div className="pf-photo-actions">
            <button type="button" className="admin-btn admin-btn--sm" disabled={photoBusy} onClick={() => fileInput.current.click()}>
              {photoBusy ? "Saving…" : user.photo ? "Change photo" : "Upload photo"}
            </button>
            {user.photo && (
              <button type="button" className="admin-btn admin-btn--sm" disabled={photoBusy} onClick={removePhoto}>
                Remove
              </button>
            )}
          </div>
          {photoError && <p className="rt-error">{photoError}</p>}

          <dl className="pf-facts">
            <div>
              <dt>Email</dt>
              <dd>{user.email || "Not set"}</dd>
            </div>
            <div>
              <dt>Office</dt>
              <dd>{user.office || "Not set"}</dd>
            </div>
            <div>
              <dt>Account created</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt>Last login</dt>
              <dd>{formatDateTime(user.lastLogin)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* right column: forms and activity */}
      <div className="pf-main">
        <form className="admin-card pf-form" onSubmit={saveDetails} noValidate>
          <h2 className="admin-card__title">Account details</h2>
          <p className="admin-card__sub">Update your name and contact information.</p>

          <div className="pf-form__grid">
            <div className="rt-field">
              <label htmlFor="pf-name">Full name</label>
              <input id="pf-name" value={details.name} onChange={setDetail("name")} />
              {detailErrors.name && <p className="rt-error">{detailErrors.name}</p>}
            </div>

            <div className="rt-field">
              <label htmlFor="pf-role">Role</label>
              <input id="pf-role" value={user.role} disabled />
            </div>

            <div className="rt-field">
              <label htmlFor="pf-email">Email</label>
              <input id="pf-email" type="email" value={details.email} onChange={setDetail("email")} />
              {detailErrors.email && <p className="rt-error">{detailErrors.email}</p>}
            </div>

            <div className="rt-field">
              <label htmlFor="pf-phone">Contact number</label>
              <input id="pf-phone" value={details.phone} onChange={setDetail("phone")} />
              {detailErrors.phone && <p className="rt-error">{detailErrors.phone}</p>}
            </div>

            <div className="rt-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="pf-office">Office / agency</label>
              <input id="pf-office" value={details.office} onChange={setDetail("office")} />
            </div>
          </div>

          {detailErrors.form && <p className="rt-error">{detailErrors.form}</p>}

          <div className="pf-form__foot">
            {detailsSaved && <p className="pf-success" role="status">Profile updated.</p>}
            <button type="submit" className="admin-btn admin-btn--primary">Save changes</button>
          </div>
        </form>

        <form className="admin-card pf-form" onSubmit={savePassword} noValidate>
          <h2 className="admin-card__title">Change password</h2>
          <p className="admin-card__sub">Use at least 8 characters with letters, numbers and a symbol.</p>

          <div className="pf-form__grid">
            <div className="rt-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="pf-current">Current password</label>
              <input
                id="pf-current"
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={setPassword("current")}
              />
              {pwErrors.current && <p className="rt-error">{pwErrors.current}</p>}
            </div>

            <div className="rt-field">
              <label htmlFor="pf-new">New password</label>
              <input
                id="pf-new"
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={setPassword("next")}
              />
              {pw.next && (
                <>
                  <div className={`pf-strength pf-strength--${score}`} aria-hidden="true">
                    <span /><span /><span /><span />
                  </div>
                  <p className="rt-hint">Strength: {STRENGTH_TEXT[score] || "Weak"}</p>
                </>
              )}
              {pwErrors.next && <p className="rt-error">{pwErrors.next}</p>}
            </div>

            <div className="rt-field">
              <label htmlFor="pf-confirm">Confirm new password</label>
              <input
                id="pf-confirm"
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={setPassword("confirm")}
              />
              {pwErrors.confirm && <p className="rt-error">{pwErrors.confirm}</p>}
            </div>
          </div>

          <div className="pf-form__foot">
            {pwSaved && <p className="pf-success" role="status">Password changed.</p>}
            <button type="submit" className="admin-btn admin-btn--primary">Update password</button>
          </div>
        </form>

        <section className="admin-card pf-form" aria-label="Recent activity">
          <h2 className="admin-card__title">Recent activity</h2>
          <p className="admin-card__sub">Your latest actions. The Audit screen has the full history.</p>
          <ul className="pf-activity">
            {myActivity.map((entry) => (
              <li key={entry.id}>
                <span>{entry.action}{entry.target ? ` - ${entry.target}` : ""}</span>
                <time>{formatDateTime(entry.timestamp)}</time>
              </li>
            ))}
          </ul>
          {myActivity.length === 0 && <p className="rt-hint">No activity yet.</p>}
        </section>
      </div>
    </div>
  );
}
