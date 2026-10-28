import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Icon from "./Icon.jsx";
import NotificationBell from "./Notifications/NotificationBell.jsx";
import logo from "../assets/disastrack-icon.png";

// Sidebar items = the admin screens. "hidden" ones are reached another way
// (Profile opens from the user card at the bottom of the sidebar).
const NAV = [
  { to: "/admin", label: "Dashboard", icon: "dashboard", end: true, sub: "today" },
  { to: "/admin/incident-reports", label: "Incident Reports", icon: "reports", sub: "Verify, classify and prioritize incoming reports" },
  { to: "/admin/live-map", label: "Live Map", icon: "map", sub: "Real-time view of incidents and rescue teams" },
  { to: "/admin/rescue-teams", label: "Rescue Teams", icon: "rescue", sub: "Manage teams and their availability" },
  { to: "/admin/users", label: "Users", icon: "users", sub: "Manage resident and responder accounts" },
  { to: "/admin/reports", label: "Reports & Stats", icon: "stats", sub: "Overall statistics and downloadable reports" },
  { to: "/admin/outcomes", label: "Response Outcomes", icon: "check", sub: "Record and edit how rescue operations ended" },
  { to: "/admin/audit", label: "Audit", icon: "audit", sub: "Record of important actions and status changes" },
  { to: "/admin/profile", label: "Profile", icon: "profile", hidden: true, sub: "Your account details and password" },
];

const todayText = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default function AdminLayout({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const path = pathname.replace(/\/$/, "");
  const current =
    NAV.find((n) => n.to === path) ||
    NAV.find((n) => n.to !== "/admin" && path.startsWith(`${n.to}/`)) ||
    NAV[0];
  const subtitle =
    current.sub === "today"
      ? `${todayText()}. Real-time overview of incidents and rescue operations.`
      : current.sub;

  const name = user?.name || "Admin";

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? "is-open" : ""}`}>
        <div className="admin-brand">
          <img src={logo} alt="" />
          <div>
            <div className="admin-brand__name">DisasTrack</div>
            <div className="admin-brand__sub">Admin console</div>
          </div>
        </div>

        <p className="admin-nav-label">Menu</p>
        <nav className="admin-nav" aria-label="Admin">
          {NAV.filter((item) => !item.hidden).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-usercard">
          <NavLink to="/admin/profile" className="admin-usercard__who" onClick={() => setOpen(false)}>
            <span className="admin-avatar">
              {user?.photo ? (
                <img src={user.photo} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                name[0].toUpperCase()
              )}
            </span>
            <span>
              <span className="admin-usercard__name">{name}</span>
              <span className="admin-usercard__role">Administrator</span>
            </span>
          </NavLink>
          <button type="button" className="admin-usercard__logout" onClick={onLogout} aria-label="Log out">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      {open && <div className="admin-overlay" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <button
              type="button"
              className="admin-iconbtn admin-menu-btn"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <div>
              <h1 className="admin-topbar__title">{current.label}</h1>
              <p className="admin-topbar__sub">{subtitle}</p>
            </div>
          </div>

          <div className="admin-topbar__actions">
            <NotificationBell uid={user?.uid} />
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
