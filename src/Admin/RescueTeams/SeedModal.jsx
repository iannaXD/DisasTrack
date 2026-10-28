import { useEffect, useState } from "react";
import Icon from "../Icon.jsx";
import { DEFAULT_TEAMS, TOTAL_MEMBERS } from "./defaultTeams.js";
import { seedDefaultTeams } from "./seedTeams.js";

/**
 * One-time setup dialog: creates the default teams and their members in Firebase.
 *   existingUsernames = usernames that already exist (those are skipped)
 *   onDone(count)     = called after everything was created
 */
export default function SeedModal({ existingUsernames, onDone, onClose }) {
  const [password, setPassword] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  // Escape closes the dialog, but not while accounts are being created.
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && !running && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, running]);

  async function start(event) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters for the temporary password.");
      return;
    }
    setError("");
    setRunning(true);
    try {
      const count = await seedDefaultTeams({
        password,
        existingUsernames,
        onProgress: (done) => setProgress(done),
      });
      onDone(count);
    } catch (err) {
      setError(err.message);
      setRunning(false);
    }
  }

  return (
    <div className="rt-overlay">
      <form className="rt-modal" role="dialog" aria-modal="true" aria-labelledby="rt-seed-title" onSubmit={start} noValidate>
        <div className="rt-modal__head">
          <h2 id="rt-seed-title">Set up default teams</h2>
          <button type="button" className="admin-iconbtn" onClick={onClose} disabled={running} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="rt-modal__body rt-modal__body--single">
          <p>
            This creates <strong>{DEFAULT_TEAMS.length} teams</strong> (2 firefighter, 2 police, 2 medical, 2 road
            officer) with <strong>{TOTAL_MEMBERS} members</strong> in Firebase. Each member gets a sign-in account,
            like on the Users screen. Names, emails and phone numbers are placeholders you can edit afterwards.
          </p>

          <div className="rt-field" style={{ marginTop: 16 }}>
            <label htmlFor="rt-seed-password">Temporary password for all members</label>
            <input
              id="rt-seed-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={running}
            />
            <p className="rt-hint">Share it with the team and ask them to change it. It is not saved anywhere in the code.</p>
          </div>

          {running && (
            <div className="rt-progress" role="status">
              <div className="rt-progress__bar">
                <span style={{ width: `${(progress / TOTAL_MEMBERS) * 100}%` }} />
              </div>
              <p>
                Creating members… {progress} / {TOTAL_MEMBERS}. Keep this window open.
              </p>
            </div>
          )}

          {error && <p className="rt-error">{error}</p>}
        </div>

        <div className="rt-modal__foot">
          <button type="button" className="admin-btn" onClick={onClose} disabled={running}>Cancel</button>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={running}>
            {running ? "Setting up…" : error ? "Try again" : "Create teams and members"}
          </button>
        </div>
      </form>
    </div>
  );
}
