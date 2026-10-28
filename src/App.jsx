import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";
import "./Admin/Admin.css";
import logo from "./assets/disastrack-icon.png";
import { signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { homePathForRole, loadAdminProfile, signInAdmin } from "./Admin/js/accountService.js";
import AdminLayout from "./Admin/AdminLayout.jsx";
import Dashboard from "./Admin/Dashboard.jsx";
import { IncidentsLayout } from "./Admin/IncidentReports/IncidentsContext.jsx";
import IncidentReports from "./Admin/IncidentReports/IncidentReports.jsx";
import IncidentDetail from "./Admin/IncidentReports/IncidentDetail.jsx";
import RescueTeams from "./Admin/RescueTeams/RescueTeams.jsx";
import LiveMap from "./Admin/LiveMap/LiveMap.jsx";
import Users from "./Admin/Users/Users.jsx";
import ReportsStats from "./Admin/ReportsStats/ReportsStats.jsx";
import Audit from "./Admin/Audit/Audit.jsx";
import { setAuditActor } from "./Admin/Audit/auditLog.js";
import Profile from "./Admin/Profile/Profile.jsx";
import OfficerLayout from "./Officer/OfficerLayout.jsx";
import OfficerOverview from "./Officer/Overview.jsx";
import OperationsMonitor from "./Officer/OperationsMonitor.jsx";
import IncidentTrends from "./Officer/IncidentTrends.jsx";
import ResponseOutcomes from "./Admin/Outcomes/ResponseOutcomes.jsx";
import LoadingScreen from "./LoadingScreen.jsx";

function UserIcon() {
  return (
    <svg className="field__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5v1H4v-1z" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="field__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M7 10V7a5 5 0 0110 0v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="currentColor" />
    </svg>
  );
}

/**
 * DisasTrack login.
 *
 * There is no role picker on purpose: the backend returns the user's role
 * (resident, admin, rescue team, officer) after sign-in, and the app routes
 * them to the right dashboard from there.
 *
 * Props:
 *   onLogin({ username, password, remember }) -> Promise
 *     Call your API here. Throw an Error with a readable message to show it.
 */
function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setLoading(true);
    try {
      if (onLogin) {
        await onLogin({ username: username.trim(), password, remember });
      } else {
        // Demo only: remove once onLogin is connected to your API.
        await new Promise((resolve) => setTimeout(resolve, 800));
        console.log("Signed in as", username.trim());
      }
    } catch (err) {
      setError(err?.message || "We couldn't sign you in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        {/* decorative shapes */}
        <span className="shape shape--blob" aria-hidden="true" />
        <span className="shape shape--slate" aria-hidden="true" />
        <span className="shape shape--sun" aria-hidden="true" />
        <span className="shape shape--corner" aria-hidden="true" />

        <div className="login-hero">
          <img className="login-hero__logo" src={logo} alt="DisasTrack logo" />
          <h1 className="login-hero__title">Welcome to DisasTrack</h1>
          <p className="login-hero__text">
            Report emergencies, coordinate rescue teams and keep every response on track.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h2 className="login-form__title">Sign in</h2>
          <p className="login-form__hint">Enter your username and password to continue.</p>

          <div className="field">
            <label className="sr-only" htmlFor="username">
              Username
            </label>
            <UserIcon />
            <input
              id="username"
              type="text"
              placeholder="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="sr-only" htmlFor="password">
              Password
            </label>
            <LockIcon />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="field__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="login-form__row">
            <label className="check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          </div>

          <p className="login-form__error" role="alert" aria-live="polite">
            {error}
          </p>

          <button className="login-form__submit" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true); // true while Firebase checks for an existing login
  const navigate = useNavigate();

  // Tell the audit log who is signed in, so every entry gets the right name.
  useEffect(() => {
    setAuditActor(user);
  }, [user]);

  // When the page loads, restore the login if the admin is still signed in.
  useEffect(() => {
    async function restoreSession() {
      try {
        await auth.authStateReady();
        if (auth.currentUser) setUser(await loadAdminProfile(auth.currentUser.uid));
      } catch {
        setUser(null);
      }
      setChecking(false);
    }
    restoreSession();
  }, []);

  // Throws an Error with a readable message when sign-in fails (the Login form shows it).
  async function handleLogin({ username, password, remember }) {
    const account = await signInAdmin(username, password, remember);
    setUser(account);
    // Admin goes to /admin, Disaster Management Officer goes to /officer.
    navigate(homePathForRole(account.role), { replace: true });
  }

  async function handleLogout() {
    await signOut(auth);
    setUser(null);
    navigate("/", { replace: true });
  }

  // Called by the Profile screen so the sidebar shows the new name right away.
  function handleUpdateUser(changes) {
    setUser((current) => ({ ...current, ...changes }));
  }

  if (checking) return <LoadingScreen message="Checking your session…" />;

  // Route guards: each console opens only for its own role.
  //   no user          -> back to the sign-in page
  //   user, wrong role -> sent to their own console
  const isAdmin = user?.role === "Admin";
  const isOfficer = user?.role === "Disaster Management Officer";
  const wrongRoleTarget = user ? homePathForRole(user.role) : "/";

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to={homePathForRole(user.role)} replace /> : <Login onLogin={handleLogin} />}
      />

      {/* The incident list is held here, above every admin screen, so the dashboard
          and the Incident Reports screens always show the same data. */}
      <Route element={<IncidentsLayout />}>
        <Route
          path="/admin"
          element={
            isAdmin ? <AdminLayout user={user} onLogout={handleLogout} /> : <Navigate to={wrongRoleTarget} replace />
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="incident-reports">
            <Route index element={<IncidentReports />} />
            <Route path=":id" element={<IncidentDetail />} />
          </Route>
          <Route path="live-map" element={<LiveMap />} />
          <Route path="rescue-teams" element={<RescueTeams />} />
          <Route path="users" element={<Users />} />
          <Route path="reports" element={<ReportsStats />} />
          <Route path="outcomes" element={<ResponseOutcomes user={user} />} />
          <Route path="audit" element={<Audit />} />
          <Route path="profile" element={<Profile user={user} onUpdate={handleUpdateUser} />} />
        </Route>

        {/* Disaster Management Officer screens: same shell and design as the admin console. */}
        <Route
          path="/officer"
          element={
            isOfficer ? <OfficerLayout user={user} onLogout={handleLogout} /> : <Navigate to={wrongRoleTarget} replace />
          }
        >
          <Route index element={<OfficerOverview />} />
          <Route path="incident-reports">
            <Route index element={<IncidentReports readOnly basePath="/officer/incident-reports" />} />
            <Route path=":id" element={<IncidentDetail readOnly basePath="/officer/incident-reports" />} />
          </Route>
          <Route path="operations" element={<OperationsMonitor />} />
          <Route path="trends" element={<IncidentTrends />} />
          <Route path="outcomes" element={<ResponseOutcomes readOnly />} />
          <Route path="reports" element={<ReportsStats />} />
          <Route path="live-map" element={<LiveMap reviewable={false} />} />
          <Route path="profile" element={<Profile user={user} onUpdate={handleUpdateUser} />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
