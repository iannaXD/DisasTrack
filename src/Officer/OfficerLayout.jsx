import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Icon from "../Admin/Icon.jsx";
import NotificationBell from "../Admin/Notifications/NotificationBell.jsx";
import logo from "../assets/disastrack-icon.png";

// Sidebar items = the Disaster Management Officer screens, in the order of the design brief.
// "hidden" ones are reached another way (Profile opens from the user card at the bottom).
const NAV = [
  { to: "/officer", label: "Overview", icon: "dashboard", end: true, sub: "today" },
  { to: "/officer/incident-reports", label: "Incident Reports", icon: "reports", sub: "Review reported incidents and where they stand" },
  { to: "/officer/operations", label: "Operations Monitor", icon: "dispatch", sub: "Monitor rescue operations and team activity" },
  { to: "/officer/trends", label: "Incident Trends", icon: "stats", sub: "How incidents change over time, by type and by place" },
  { to: "/officer/outcomes", label: "Response Outcomes", icon: "check", sub: "How rescue operations ended and how many people were rescued" },
  { to: "/officer/reports", label: "Reports & Stats", icon: "audit", sub: "Overall statistics and downloadable reports" },
  { to: "/officer/live-map", label: "Live Map", icon: "map", sub: "Real-time view of incidents and rescue teams" },
  { to: "/officer/profile", label: "Profile", icon: "profile", hidden: true, sub: "Your account details and password" },
];

const todayText = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default function OfficerLayout({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const path = pathname.replace(/\/$/, "");
  const current =
    NAV.find((n) => n.to === path) ||
    NAV.find((n) => n.to !== "/officer" && path.startsWith(`${n.to}/`)) ||
    NAV[0];
  const subtitle =
    current.sub === "today"
      ? `${todayText()}. Overall view of incidents and rescue operations.`
      : current.sub;

  const name = user?.name || "Officer";

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? "is-open" : ""}`}>
        <div className="admin-brand">
          <img src={logo} alt="" />
          <div>
            <div className="admin-brand__name">DisasTrack</div>
            <div className="admin-brand__sub">Officer console</div>
          </div>
        </div>

        <p className="admin-nav-label">Menu</p>
        <nav className="admin-nav" aria-label="Disaster Management Officer">
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
          <NavLink to="/officer/profile" className="admin-usercard__who" onClick={() => setOpen(false)}>
            <span className="admin-avatar">
              {user?.photo ? (
                <img src={user.photo} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                name[0].toUpperCase()
              )}
            </span>
            <span>
              <span className="admin-usercard__name">{name}</span>
              <span className="admin-usercard__role">DM Officer</span>
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
            <NotificationBell uid={user?.uid} base="/officer" />
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
