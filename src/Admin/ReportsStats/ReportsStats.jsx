import { useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import Icon from "../Icon.jsx";
import { INCIDENT_TYPES, OPEN_STATUSES, PRIORITIES, STATUSES, statusLabel } from "../IncidentReports/incidentsData.js";
import { useIncidents } from "../IncidentReports/IncidentsContext.jsx";
import { useTeams } from "../js/useTeams.js";
import { downloadCSV, formatDateTime } from "../js/adminHelpers.js";
import "./ReportsStats.css";

// Tell Chart.js which chart parts we use (required once).
ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

// DisasTrack palette
const BRANDY = "#8f250c";
const SUN = "#f2c14e";
const JET = "#2a2d34";
const SLATE = "#5c6b7a";
const STONE = "#e4e0d9";

const TYPE_COLORS = [BRANDY, SUN, JET, SLATE, "#c4673f", "#8a9aa8", "#d9a441", "#b8b2a7"];
const PRIORITY_COLORS = { Critical: BRANDY, High: "#c4673f", Medium: SUN, Low: SLATE };
const STATUS_LIST = STATUSES;

// Time filter. Compared against each incident's createdAt (ISO timestamp).
//   days = how many days back the filter reaches (today = since midnight)
//   chartDays = how many days the "Reports over time" chart shows
const RANGES = [
  { key: "today", label: "Today", days: 0, chartDays: 7 },
  { key: "7d", label: "Last 7 days", days: 7, chartDays: 7 },
  { key: "30d", label: "Last 30 days", days: 30, chartDays: 30 },
  { key: "all", label: "All reports", days: null, chartDays: 30 },
];

// The earliest time an incident may have to be included (0 = no limit).
function getStartTime(range) {
  if (range.days === null) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0); // midnight today
  start.setDate(start.getDate() - range.days);
  return start.getTime();
}

// Turns a date into text like "2026-10-21" so we can group reports by day.
function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Counts how many items match each label: count(items, "type", ["Flood", "Fire"]) -> [3, 2]
const countBy = (items, field, labels) =>
  labels.map((label) => items.filter((item) => item[field] === label).length);

export default function ReportsStats() {
  const [range, setRange] = useState("all");
  const [type, setType] = useState("all");
  // Same Firebase list as the Dashboard and Live Map
  const { incidents: allIncidents, loading, error } = useIncidents();
  const { teams } = useTeams();

  const selectedRange = RANGES.find((r) => r.key === range);

  // The incidents that match the filters above the charts.
  const incidents = useMemo(() => {
    const startTime = getStartTime(selectedRange);
    return allIncidents.filter(
      (i) => new Date(i.createdAt).getTime() >= startTime && (type === "all" || i.type === type)
    );
  }, [allIncidents, selectedRange, type]);

  // ----- summary numbers -----
  const total = incidents.length;
  const resolved = incidents.filter((i) => i.status === "Resolved" || i.status === "Closed").length; // finished = resolved + closed
  const critical = incidents.filter((i) => i.priority === "Critical").length;
  const active = incidents.filter((i) => OPEN_STATUSES.includes(i.status)).length;
  const resolveRate = total ? Math.round((resolved / total) * 100) : 0;

  const stats = [
    { label: "Total Reports", value: total, icon: "reports", tone: "slate", note: "In selected range" },
    { label: "Resolved", value: resolved, icon: "check", tone: "jet", note: `${resolveRate}% resolution rate` },
    { label: "Critical", value: critical, icon: "alert", tone: "brandy", note: "Highest priority" },
    { label: "Still Active", value: active, icon: "clock", tone: "sun", note: "Pending through in progress" },
  ];

  // ----- chart data -----
  // 1) Reports by type (doughnut). Only show types that have reports.
  const typeLabels = INCIDENT_TYPES.filter((t) => incidents.some((i) => i.type === t));
  const typeData = {
    labels: typeLabels,
    datasets: [
      {
        data: countBy(incidents, "type", typeLabels),
        backgroundColor: TYPE_COLORS,
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  // 2) Reports by priority (bar)
  const priorityData = {
    labels: PRIORITIES,
    datasets: [
      {
        label: "Reports",
        data: countBy(incidents, "priority", PRIORITIES),
        backgroundColor: PRIORITIES.map((p) => PRIORITY_COLORS[p]),
        borderRadius: 6,
      },
    ],
  };

  // 3) Reports by status (bar)
  const statusData = {
    labels: STATUS_LIST.map(statusLabel),
    datasets: [
      {
        label: "Reports",
        data: countBy(incidents, "status", STATUS_LIST),
        backgroundColor: SLATE,
        borderRadius: 6,
      },
    ],
  };

  // 4) Reports per day (line). Shows the last 7 or 30 days, oldest on the left.
  const dayLabels = [];
  const perDay = {}; // example: { "2026-10-21": 3 }
  for (let back = selectedRange.chartDays - 1; back >= 0; back--) {
    const date = new Date();
    date.setDate(date.getDate() - back);
    dayLabels.push({ key: dayKey(date), text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
    perDay[dayKey(date)] = 0;
  }
  incidents.forEach((i) => {
    const key = dayKey(new Date(i.createdAt));
    if (key in perDay) perDay[key] += 1; // reports older than the chart are skipped
  });
  const trendData = {
    labels: dayLabels.map((d) => d.text),
    datasets: [
      {
        label: "Reports",
        data: dayLabels.map((d) => perDay[d.key]),
        borderColor: BRANDY,
        backgroundColor: "rgba(143, 37, 12, 0.12)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: BRANDY,
      },
    ],
  };

  // Shared options for the bar and line charts
  const axisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: STONE } },
    },
  };

  // On a phone-sized screen the charts need a different layout to stay readable.
  const isNarrow = window.innerWidth < 640;

  // Status chart: nine bars with long names, so on a phone the bars lie sideways.
  const statusOptions = isNarrow
    ? {
        ...axisOptions,
        indexAxis: "y",
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: STONE } },
          y: { grid: { display: false } },
        },
      }
    : axisOptions;

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: { legend: { position: isNarrow ? "bottom" : "right" } },
  };

  // ----- rescue team table -----
  const teamRows = teams.map((team) => {
    const mine = incidents.filter((i) => i.team === team.id);
    return {
      name: team.name,
      specialty: team.type,
      assigned: mine.length,
      inProgress: mine.filter((i) => i.status === "Team Assigned" || i.status === "In Progress").length,
      resolved: mine.filter((i) => i.status === "Resolved" || i.status === "Closed").length,
    };
  });

  // ----- downloads -----
  function exportCSV() {
    downloadCSV(
      "disastrack-incident-summary.csv",
      ["ID", "Type", "Location", "Priority", "Status", "Date reported", "Assigned team"],
      incidents.map((i) => [
        i.id,
        i.type,
        i.location,
        i.priority,
        statusLabel(i.status),
        formatDateTime(i.createdAt),
        teams.find((t) => t.id === i.team)?.name || "None",
      ])
    );
  }

  // The browser's print window has a "Save as PDF" option.
  const exportPDF = () => window.print();

  return (
    <div className="rt-page">
      {/* filters + downloads */}
      <div className="rt-toolbar rs-noprint">
        <div className="rs-filters">
          <div className="admin-chips" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`admin-chip ${range === r.key ? "is-active" : ""}`}
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <select className="rs-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Incident type">
            <option value="all">All incident types</option>
            {INCIDENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="rt-toolbar__right">
          <button type="button" className="admin-btn" onClick={exportCSV}>
            Download CSV
          </button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={exportPDF}>
            Download PDF
          </button>
        </div>
      </div>

      {/* summary cards */}
      <section className="admin-stats" aria-label="Report summary">
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

      {loading ? (
        <section className="admin-card rs-card">
          <p className="rs-empty">Loading reports…</p>
        </section>
      ) : error ? (
        <section className="admin-card rs-card">
          <p className="rs-empty" role="alert">{error.message}</p>
        </section>
      ) : total === 0 ? (
        <section className="admin-card rs-card">
          <p className="rs-empty">
            {allIncidents.length === 0
              ? "There are no reports yet. Reports will appear here once residents submit them."
              : "No reports match these filters."}
          </p>
        </section>
      ) : (
        <div className="rs-grid">
          <section className="admin-card rs-card rs-card--wide" aria-label="Reports over time">
            <h2 className="admin-card__title">Reports over time</h2>
            <p className="admin-card__sub">Number of reports received each day (last {selectedRange.chartDays} days)</p>
            <div className="rs-chart">
              <Line data={trendData} options={axisOptions} />
            </div>
          </section>

          <section className="admin-card rs-card" aria-label="Reports by type">
            <h2 className="admin-card__title">Reports by type</h2>
            <p className="admin-card__sub">What kind of emergencies are reported</p>
            <div className="rs-chart">
              <Doughnut data={typeData} options={doughnutOptions} />
            </div>
          </section>

          <section className="admin-card rs-card" aria-label="Reports by priority">
            <h2 className="admin-card__title">Reports by priority</h2>
            <p className="admin-card__sub">How urgent the reports are</p>
            <div className="rs-chart">
              <Bar data={priorityData} options={axisOptions} />
            </div>
          </section>

          <section className="admin-card rs-card rs-card--wide" aria-label="Reports by status">
            <h2 className="admin-card__title">Reports by status</h2>
            <p className="admin-card__sub">Where each report is in the response process</p>
            <div className="rs-chart" style={isNarrow ? { height: 340 } : undefined}>
              <Bar data={statusData} options={statusOptions} />
            </div>
          </section>

          <section className="admin-card rs-card rs-card--wide" aria-label="Rescue team performance">
            <h2 className="admin-card__title">Rescue team activity</h2>
            <p className="admin-card__sub">Reports handled by each team in the selected range</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Team</th>
                    <th scope="col">Specialty</th>
                    <th scope="col">Assigned</th>
                    <th scope="col">In progress</th>
                    <th scope="col">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map((t) => (
                    <tr key={t.name}>
                      <td><span className="admin-table__strong">{t.name}</span></td>
                      <td>{t.specialty}</td>
                      <td>{t.assigned}</td>
                      <td>{t.inProgress}</td>
                      <td className="rs-rate">{t.resolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
