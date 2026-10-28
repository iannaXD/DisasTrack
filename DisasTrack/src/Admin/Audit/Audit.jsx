import { useMemo, useState } from "react";
import Icon from "../Icon.jsx";
import { CATEGORIES } from "./auditLog.js";
import { useAuditLogs } from "./useAuditLogs.js";
import { downloadCSV, formatDateTime, slug } from "../js/adminHelpers.js";
import "./Audit.css";

const PAGE_SIZE = 10;

// "2026-10-18T23:30:00Z" -> "2026-10-19" (the date on the viewer's own clock, for the date filters)
function localDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Audit() {
  // Live from Firebase (/auditLogs), newest first.
  const { logs: AUDIT_LOG, loading, error } = useAuditLogs();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [actor, setActor] = useState("all");
  const [from, setFrom] = useState(""); // "2026-10-01"
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const countCategory = (name) => AUDIT_LOG.filter((e) => e.category === name).length;

  const stats = [
    { label: "Total Entries", value: AUDIT_LOG.length, icon: "audit", tone: "slate", note: "All recorded actions" },
    { label: "Incident Changes", value: countCategory("Incident"), icon: "reports", tone: "brandy", note: "Status and priority" },
    { label: "Assignments", value: countCategory("Assignment"), icon: "rescue", tone: "sun", note: "Teams dispatched" },
    { label: "Account Actions", value: countCategory("Account") + countCategory("Login"), icon: "users", tone: "jet", note: "Accounts and sign-ins" },
  ];

  // Everyone who appears in the log (for the "User" dropdown).
  const actors = [...new Set(AUDIT_LOG.map((e) => e.actor).filter(Boolean))].sort();

  // Apply all filters.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AUDIT_LOG.filter((e) => {
      const day = localDay(e.timestamp); // "2026-10-18"
      if (category !== "all" && e.category !== category) return false;
      if (actor !== "all" && e.actor !== actor) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (q && ![e.actor, e.action, e.target, e.details].some((v) => (v || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [AUDIT_LOG, query, category, actor, from, to]);

  // Pagination
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Change a filter and go back to page 1.
  const onFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setActor("all");
    setFrom("");
    setTo("");
    setPage(1);
  }

  function exportCSV() {
    downloadCSV(
      "disastrack-audit-log.csv",
      ["ID", "Date and time", "User", "Role", "Category", "Action", "Target", "Details"],
      filtered.map((e) => [e.id, formatDateTime(e.timestamp), e.actor, e.role, e.category, e.action, e.target, e.details])
    );
  }

  return (
    <div className="rt-page">
      {/* summary cards */}
      <section className="admin-stats" aria-label="Audit summary">
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

      {/* filters */}
      <div className="rt-toolbar">
        <div className="au-filters">
          <label>
            Category
            <select value={category} onChange={onFilter(setCategory)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            User
            <select value={actor} onChange={onFilter(setActor)}>
              <option value="all">All users</option>
              {actors.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={from} onChange={onFilter(setFrom)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={onFilter(setTo)} />
          </label>
          <button type="button" className="admin-btn" onClick={clearFilters}>
            Clear
          </button>
        </div>

        <div className="rt-toolbar__right">
          <label className="rt-search">
            <Icon name="search" size={16} />
            <input type="search" placeholder="Search log…" value={query} onChange={onFilter(setQuery)} />
          </label>
          <button type="button" className="admin-btn admin-btn--primary" onClick={exportCSV}>
            Export CSV
          </button>
        </div>
      </div>

      {/* table */}
      <section className="admin-card rt-card" aria-label="Audit log">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Date and time</th>
                <th scope="col">User</th>
                <th scope="col">Category</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="au-time">{formatDateTime(e.timestamp)}</td>
                  <td>
                    <span className="admin-table__strong">{e.actor}</span>
                    <span className="rt-sub">{e.role}</span>
                  </td>
                  <td>
                    <span className={`au-badge au-badge--${slug(e.category)}`}>{e.category}</span>
                  </td>
                  <td className={e.action === "Failed sign-in" ? "au-failed" : ""}>{e.action}</td>
                  <td>{e.target}</td>
                  <td>{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && <p className="rt-muted" style={{ padding: 16 }}>Loading the audit log…</p>}
          {error && <p className="rt-error" style={{ padding: 16 }}>{error.message}</p>}

          {!loading && !error && filtered.length === 0 && (
            <div className="rt-empty">
              <h3>No entries found</h3>
              <p>{AUDIT_LOG.length === 0 ? "Actions will appear here as they happen." : "Try changing or clearing the filters."}</p>
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="au-pager">
            <span>
              Showing {(current - 1) * PAGE_SIZE + 1}-{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="au-pager__buttons">
              <button type="button" className="admin-btn admin-btn--sm" disabled={current === 1} onClick={() => setPage(current - 1)}>
                Previous
              </button>
              <button type="button" className="admin-btn admin-btn--sm" disabled={current === pages} onClick={() => setPage(current + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
