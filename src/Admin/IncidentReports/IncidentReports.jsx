import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useIncidents } from "./IncidentsContext.jsx";
import { INCIDENT_TYPES, PRIORITIES, TABS, ago, duplicatesOf, statusLabel } from "./incidentsData.js";
import {
  Badge,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconLayers,
  IconSearch,
} from "./incidentShared.jsx";

const ADMIN_PATH = "/admin/incident-reports";
const PAGE_SIZE = 8;
const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function matchesTab(incident, tab) {
  if (tab.key === "all") return true;
  if (tab.statuses) return tab.statuses.includes(incident.status);
  return incident.status === tab.key;
}

/** [1, "…", 4, 5, 6, "…", 12] */
function pageList(current, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

function exportCsv(list) {
  const head = ["Report ID", "Incident", "Location", "Reporter", "Priority", "Status", "Reported"];
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    head,
    ...list.map((i) => [i.id, i.type, i.location, i.reporter, i.priority, statusLabel(i.status), ago(i.createdAt)]),
  ].map((row) => row.map(esc).join(","));

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "incident-reports.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * readOnly = true is the Disaster Management Officer version: same list, filters and
 * details, but no selecting / verifying / loading samples. basePath is where the
 * detail pages live ("/officer/incident-reports" for the officer).
 */
export default function IncidentReports({ readOnly = false, basePath = ADMIN_PATH }) {
  const LIST_PATH = basePath;
  const { incidents, loading, error, update, loadSamples } = useIncidents();
  const [seedError, setSeedError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const navigate = useNavigate();

  const [tabKey, setTabKey] = useState("all");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  // Duplicate dropdowns: closed by default, open by default on the Duplicate tab.
  // `toggled` holds the reports the admin flipped from that default.
  const [toggled, setToggled] = useState([]);
  const toggleExpanded = (id) => setToggled((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  // any filter change goes back to page 1 and clears the selection
  const onFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
    setSelected([]);
  };

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, incidents.filter((i) => matchesTab(i, t)).length])),
    [incidents]
  );

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.key === tabKey);
    const q = query.trim().toLowerCase();

    const list = incidents.filter(
      (i) =>
        matchesTab(i, tab) &&
        (type === "all" || i.type === type) &&
        (priority === "all" || i.priority === priority) &&
        (!q || [i.id, i.type, i.location, i.reporter].some((v) => v.toLowerCase().includes(q)))
    );

    // ISO timestamps sort as text; newest first
    const byNewest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));
    const byPriority = (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byNewest(a, b);
    // Duplicate tab: show the ORIGINAL report (its duplicates drop down under it)
    // instead of listing each duplicate on its own.
    let result = list;
    if (tab.key === "Duplicate") {
      const seen = new Set();
      result = [];
      list.forEach((d) => {
        const parent = incidents.find((i) => i.id === d.duplicateOf);
        const row = parent || d; // no original found: show the duplicate itself
        if (!seen.has(row.id)) {
          seen.add(row.id);
          result.push(row);
        }
      });
    }
    return [...result].sort(sort === "priority" ? byPriority : byNewest);
  }, [incidents, tabKey, type, priority, sort, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const toggleRow = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () =>
    setSelected((s) =>
      allChecked ? s.filter((id) => !rows.some((r) => r.id === id)) : [...new Set([...s, ...rows.map((r) => r.id)])]
    );

  const pendingSelected = incidents.filter((i) => selected.includes(i.id) && i.status === "Pending");
  const verifySelected = () => {
    pendingSelected.forEach((i) => update(i.id, { status: "Verified" }, "Report verified (bulk action)").catch((err) => setSeedError(err.message)));
    setSelected([]);
  };

  // One-time: saves the sample incidents in Firebase so the screens have something to show.
  async function addSamples() {
    setSeeding(true);
    setSeedError("");
    try {
      await loadSamples();
    } catch (err) {
      setSeedError(err.message);
    }
    setSeeding(false);
  }

  const clearFilters = () => {
    setTabKey("all");
    setType("all");
    setPriority("all");
    setQuery("");
    setPage(1);
  };

  return (
    <div className="ir-page">
      {/* tabs + filters */}
      <div className="ir-toolbar">
        <div className="ir-toolbar__top">
        <div className="ir-tabs" role="tablist" aria-label="Report status">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tabKey === t.key}
              className={`ir-tab ${tabKey === t.key ? "is-active" : ""}`}
              onClick={() => {
                setTabKey(t.key);
                setPage(1);
                setSelected([]);
                setToggled([]);
              }}
            >
              {t.label} <span className="ir-tab__count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
          <button type="button" className="ir-btn ir-btn--sm ir-toolbar__export" onClick={() => exportCsv(filtered)}>
            <IconDownload /> Export CSV
          </button>
        </div>

        <div className="ir-toolbar__filters">
          <label className="ir-searchbox">
            <IconSearch />
            <input
              type="search"
              placeholder="Search reports…"
              value={query}
              onChange={onFilter(setQuery)}
            />
          </label>
          <select className="ir-select" value={type} onChange={onFilter(setType)} aria-label="Filter by type">
            <option value="all">Type: All</option>
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="ir-select" value={priority} onChange={onFilter(setPriority)} aria-label="Filter by priority">
            <option value="all">Priority: All</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select className="ir-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort reports">
            <option value="newest">Sort: Newest</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>
      </div>

      {!readOnly && selected.length > 0 && (
        <div className="ir-bulk" role="status">
          <strong>{selected.length} selected</strong>
          <button
            type="button"
            className="ir-btn ir-btn--sm ir-btn--primary"
            disabled={pendingSelected.length === 0}
            onClick={verifySelected}
          >
            Verify selected ({pendingSelected.length})
          </button>
          <button type="button" className="ir-btn ir-btn--sm" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}

      {/* table */}
      <section className="ir-card" aria-label="Incident reports">
        <div className="ir-table-wrap">
          <table className="ir-table">
            <thead>
              <tr>
                {!readOnly && (
                <th scope="col" className="ir-table__check">
                  <input
                    type="checkbox"
                    className="ir-check"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Select all reports on this page"
                  />
                </th>
                )}
                <th scope="col">Report ID</th>
                <th scope="col">Incident</th>
                <th scope="col">Location</th>
                <th scope="col">Reporter</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Reported</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dups = duplicatesOf(r.id, incidents);
                const open = tabKey === "Duplicate" && !toggled.includes(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr>
                      {!readOnly && (
                      <td className="ir-table__check">
                        <input
                          type="checkbox"
                          className="ir-check"
                          checked={selected.includes(r.id)}
                          onChange={() => toggleRow(r.id)}
                          aria-label={`Select ${r.id}`}
                        />
                      </td>
                      )}
                      <td><Link className="ir-id" to={`${LIST_PATH}/${r.id}`}>{r.id}</Link></td>
                      <td>
                        <span className="ir-strong">{r.type}</span>
                        {r.status === "Duplicate" && r.duplicateOf && (
                          <span className="ir-hint">Duplicate of {r.duplicateOf}</span>
                        )}
                        {tabKey === "Duplicate" && dups.length > 0 && (
                          <button
                            type="button"
                            className={`ir-dupbtn ${open ? "is-open" : ""}`}
                            aria-expanded={open}
                            aria-label={`${open ? "Hide" : "Show"} ${dups.length} duplicate report${dups.length === 1 ? "" : "s"} of ${r.id}`}
                            onClick={() => toggleExpanded(r.id)}
                          >
                            <IconLayers />
                            <span className="ir-dupbtn__count">{dups.length}</span>
                            <span>duplicate{dups.length === 1 ? "" : "s"}</span>
                            <span className="ir-dupbtn__chev"><IconChevronDown /></span>
                          </button>
                        )}
                      </td>
                      <td>{r.location}</td>
                      <td>{r.reporter}</td>
                      <td><Badge label={r.priority} /></td>
                      <td><Badge label={r.status} /></td>
                      <td className="ir-muted">{ago(r.createdAt)}</td>
                      <td className="ir-table__action">
                        <button type="button" className="ir-btn ir-btn--sm ir-btn--link" onClick={() => navigate(`${LIST_PATH}/${r.id}`)}>
                          {readOnly ? "View" : "Review"}
                        </button>
                      </td>
                    </tr>
                    {open &&
                      dups.map((d) => (
                        <tr key={d.id} className="ir-subrow">
                          {!readOnly && <td />}
                          <td className="ir-subrow__indent"><Link className="ir-id" to={`${LIST_PATH}/${d.id}`}>{d.id}</Link></td>
                          <td>Duplicate of {r.id}</td>
                          <td>{d.location}</td>
                          <td>{d.reporter}</td>
                          <td><Badge label={d.priority} /></td>
                          <td><Badge label={d.status} /></td>
                          <td className="ir-muted">{ago(d.createdAt)}</td>
                          <td />
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {loading && <div className="ir-empty"><p>Loading reports…</p></div>}

          {!loading && (error || seedError) && (
            <p className="ir-note" role="alert">{error?.message || seedError}</p>
          )}

          {!loading && incidents.length === 0 && (
            <div className="ir-empty">
              <h3>No incident reports yet</h3>
              <p>
                Reports from residents appear here as soon as they are saved in Firebase (/incidents).
                {!readOnly && " You can also load the sample reports to try the screens."}
              </p>
              {!readOnly && (
                <button type="button" className="ir-btn ir-btn--sm ir-btn--primary" onClick={addSamples} disabled={seeding}>
                  {seeding ? "Saving…" : "Load sample incidents"}
                </button>
              )}
            </div>
          )}

          {!loading && incidents.length > 0 && rows.length === 0 && (
            <div className="ir-empty">
              <h3>No reports match your filters</h3>
              <p>Try a different status, type or search term.</p>
              <button type="button" className="ir-btn ir-btn--sm" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="ir-pager">
            <span>
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} reports
            </span>
            <nav className="ir-pager__nav" aria-label="Pagination">
              <button
                type="button"
                className="ir-page-btn"
                onClick={() => setPage(current - 1)}
                disabled={current === 1}
                aria-label="Previous page"
              >
                <IconChevronLeft />
              </button>
              {pageList(current, pageCount).map((p, i) =>
                p === "…" ? (
                  <span key={`gap-${i}`} className="ir-page-gap">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`ir-page-btn ${p === current ? "is-active" : ""}`}
                    aria-current={p === current ? "page" : undefined}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                className="ir-page-btn"
                onClick={() => setPage(current + 1)}
                disabled={current === pageCount}
                aria-label="Next page"
              >
                <IconChevronRight />
              </button>
            </nav>
          </div>
        )}
      </section>
    </div>
  );
}
