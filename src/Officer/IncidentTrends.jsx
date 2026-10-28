import { useMemo, useState } from "react";
import {
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
import { Bar, Line } from "react-chartjs-2";
import Icon from "../Admin/Icon.jsx";
import { OPEN_STATUSES } from "../Admin/IncidentReports/incidentsData.js";
import { useIncidents } from "../Admin/IncidentReports/IncidentsContext.jsx";
import "../Admin/ReportsStats/ReportsStats.css"; // reuses the same chart cards and filters

/* ------------------------------------------------------------------
   Incident Trends (Disaster Management Officer, view only).

   Shows what is CHANGING, WHERE and WHEN (the totals by type and priority
   are already in Reports & Stats, so they are not repeated here).
   Everything is calculated from the same /incidents list as the other screens.
------------------------------------------------------------------- */

// Tell Chart.js which chart parts we use (safe to repeat).
ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler);

// DisasTrack palette
const BRANDY = "#8f250c";
const SUN = "#f2c14e";
const SLATE = "#5c6b7a";
const STONE = "#e4e0d9";

// Time filter.
//   days = how far back the filter reaches (null = everything)
//   mode = how the line chart groups the points: one point per day, week or month
const RANGES = [
  { key: "7d", label: "Last 7 days", days: 7, mode: "day" },
  { key: "30d", label: "Last 30 days", days: 30, mode: "day" },
  { key: "90d", label: "Last 90 days", days: 90, mode: "week" },
  { key: "all", label: "All reports", days: null, mode: "month" },
];

const MODE_TEXT = { day: "day", week: "week", month: "month" };

// Labels for the "day of the week" chart (Date.getDay(): 0 = Sunday ... 6 = Saturday)
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Labels for the "time of day" chart: eight blocks of 3 hours.
// A report made at 14:30 -> Math.floor(14 / 3) = 4 -> "12–3 PM"
const TIME_BLOCKS = ["12–3 AM", "3–6 AM", "6–9 AM", "9 AM–12 PM", "12–3 PM", "3–6 PM", "6–9 PM", "9 PM–12 AM"];

// The first moment of the day, week (starts Sunday) or month that a date belongs to.
function bucketStart(date, mode) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (mode === "week") d.setDate(d.getDate() - d.getDay());
  if (mode === "month") d.setDate(1);
  return d;
}

// The start of the next day, week or month.
function nextBucket(date, mode) {
  const d = new Date(date);
  if (mode === "day") d.setDate(d.getDate() + 1);
  if (mode === "week") d.setDate(d.getDate() + 7);
  if (mode === "month") d.setMonth(d.getMonth() + 1);
  return d;
}

// Text shown under each point of the line chart.
function bucketLabel(date, mode) {
  if (mode === "month") return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Counts items by a text value and returns the biggest first:
// countValues(["a", "b", "a"]) -> [["a", 2], ["b", 1]]
function countValues(values) {
  const counts = {};
  values.forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// "Brgy. Frances, Calumpit" -> "Calumpit"
const townOf = (location) => (location || "Unknown").split(",").pop().trim() || "Unknown";

export default function IncidentTrends() {
  const [range, setRange] = useState("30d");
  const { incidents: allIncidents, loading, error } = useIncidents();
  const selectedRange = RANGES.find((r) => r.key === range);

  // Start of the selected range (0 = no limit). A 7-day range = today and the 6 days before.
  const startTime = useMemo(() => {
    if (selectedRange.days === null) return 0;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (selectedRange.days - 1));
    return start.getTime();
  }, [selectedRange]);

  // Incidents inside the range.
  const incidents = useMemo(
    () => allIncidents.filter((i) => new Date(i.createdAt).getTime() >= startTime),
    [allIncidents, startTime]
  );

  // Incidents in the period just before it (same length), used for "compared to before".
  // null = "All reports" has no previous period.
  const previousIncidents = useMemo(() => {
    if (selectedRange.days === null) return null;
    const previousStart = new Date(startTime);
    previousStart.setDate(previousStart.getDate() - selectedRange.days);
    return allIncidents.filter((i) => {
      const time = new Date(i.createdAt).getTime();
      return time >= previousStart.getTime() && time < startTime;
    });
  }, [allIncidents, selectedRange, startTime]);
  const previousCount = previousIncidents === null ? null : previousIncidents.length;

  // ----- line chart: incidents per day / week / month -----
  const mode = selectedRange.mode;
  const buckets = []; // [{ time, label, count }]
  if (incidents.length > 0) {
    // "All reports" starts at the oldest report; the others start at the range start.
    const oldest = Math.min(...incidents.map((i) => new Date(i.createdAt).getTime()));
    let current = bucketStart(new Date(startTime || oldest), mode);
    const now = Date.now();
    while (current.getTime() <= now) {
      buckets.push({ time: current.getTime(), label: bucketLabel(current, mode), count: 0 });
      current = nextBucket(current, mode);
    }
    incidents.forEach((i) => {
      const time = bucketStart(new Date(i.createdAt), mode).getTime();
      const bucket = buckets.find((b) => b.time === time);
      if (bucket) bucket.count += 1;
    });
  }
  const busiest = buckets.reduce((best, b) => (b.count > (best?.count ?? 0) ? b : best), null);

  // ----- by type (only used for the "Most Common Type" card), by place -----
  const typeCounts = countValues(incidents.map((i) => i.type));

  // ----- change by type: this period vs the period before -----
  // One row per type: { type, now, before, change }, biggest increase first.
  const changeRows = [];
  if (previousIncidents !== null) {
    const nowCounts = Object.fromEntries(typeCounts);
    const beforeCounts = Object.fromEntries(countValues(previousIncidents.map((i) => i.type)));
    const allTypes = [...new Set([...Object.keys(nowCounts), ...Object.keys(beforeCounts)])];
    allTypes.forEach((type) => {
      const now = nowCounts[type] || 0;
      const before = beforeCounts[type] || 0;
      changeRows.push({ type, now, before, change: now - before });
    });
    changeRows.sort((a, b) => b.change - a.change || b.now - a.now);
  }

  // ----- by day of the week (Sunday to Saturday) -----
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  incidents.forEach((i) => {
    dayCounts[new Date(i.createdAt).getDay()] += 1;
  });

  // ----- by time of day (eight 3-hour blocks) -----
  const timeCounts = [0, 0, 0, 0, 0, 0, 0, 0];
  incidents.forEach((i) => {
    timeCounts[Math.floor(new Date(i.createdAt).getHours() / 3)] += 1;
  });

  const townCounts = countValues(incidents.map((i) => townOf(i.location))).slice(0, 6);

  // Top 5 exact locations with a few numbers each.
  const locationRows = countValues(incidents.map((i) => i.location || "Unknown"))
    .slice(0, 5)
    .map(([location, count]) => {
      const here = incidents.filter((i) => (i.location || "Unknown") === location);
      return {
        location,
        count,
        critical: here.filter((i) => i.priority === "Critical").length,
        active: here.filter((i) => OPEN_STATUSES.includes(i.status)).length,
      };
    });

  // ----- summary cards -----
  const total = incidents.length;
  const difference = previousCount === null ? null : total - previousCount;
  const stats = [
    { label: "Reports in Range", value: total, icon: "reports", tone: "slate", note: selectedRange.label },
    {
      label: "Compared to Before",
      value: difference === null ? "—" : `${difference > 0 ? "+" : ""}${difference}`,
      icon: "stats",
      tone: "brandy",
      note: difference === null ? "Not available for all reports" : `Previous ${selectedRange.days} days: ${previousCount}`,
    },
    {
      label: "Most Common Type",
      value: typeCounts[0] ? typeCounts[0][0] : "—",
      icon: "alert",
      tone: "sun",
      note: typeCounts[0] ? `${typeCounts[0][1]} reports` : "No reports",
    },
    {
      label: `Busiest ${MODE_TEXT[mode][0].toUpperCase()}${MODE_TEXT[mode].slice(1)}`,
      value: busiest ? busiest.label : "—",
      icon: "clock",
      tone: "jet",
      note: busiest ? `${busiest.count} reports` : "No reports",
    },
  ];

  // ----- chart data -----
  const lineData = {
    labels: buckets.map((b) => b.label),
    datasets: [
      {
        label: "Reports",
        data: buckets.map((b) => b.count),
        borderColor: BRANDY,
        backgroundColor: "rgba(143, 37, 12, 0.12)",
        fill: true,
        tension: 0.3,
        pointBackgroundColor: BRANDY,
      },
    ],
  };

  const townData = {
    labels: townCounts.map(([name]) => name),
    datasets: [
      {
        label: "Reports",
        data: townCounts.map(([, count]) => count),
        backgroundColor: SLATE,
        borderRadius: 6,
      },
    ],
  };

  const dayData = {
    labels: DAY_NAMES.map((name) => name.slice(0, 3)),
    datasets: [{ label: "Reports", data: dayCounts, backgroundColor: BRANDY, borderRadius: 6 }],
  };

  const timeData = {
    labels: TIME_BLOCKS,
    datasets: [{ label: "Reports", data: timeCounts, backgroundColor: SUN, borderRadius: 6 }],
  };

  // Chart options
  const axisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: STONE } },
    },
  };
  // Horizontal bars (names are long, so they read better on the left).
  const sidewaysOptions = {
    ...axisOptions,
    indexAxis: "y",
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: STONE } },
      y: { grid: { display: false } },
    },
  };
  return (
    <div className="rt-page">
      {/* time filter */}
      <div className="rt-toolbar">
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
      </div>

      {/* summary cards */}
      <section className="admin-stats" aria-label="Trend summary">
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
          <p className="rs-empty">Loading trends…</p>
        </section>
      ) : error ? (
        <section className="admin-card rs-card">
          <p className="rs-empty" role="alert">{error.message}</p>
        </section>
      ) : total === 0 ? (
        <section className="admin-card rs-card">
          <p className="rs-empty">
            {allIncidents.length === 0
              ? "There are no reports yet. Trends will appear here once residents submit reports."
              : "No reports in this time range."}
          </p>
        </section>
      ) : (
        <div className="rs-grid">
          <section className="admin-card rs-card rs-card--wide" aria-label="Reports over time">
            <h2 className="admin-card__title">Reports over time</h2>
            <p className="admin-card__sub">
              One point per {MODE_TEXT[mode]}
              {mode === "week" ? " (weeks start on Sunday)" : ""}
            </p>
            <div className="rs-chart">
              <Line data={lineData} options={axisOptions} />
            </div>
          </section>

          <section className="admin-card rs-card" aria-label="Change by type">
            <h2 className="admin-card__title">Change by type</h2>
            <p className="admin-card__sub">This period compared to the one before</p>
            {previousIncidents === null ? (
              <p className="rs-empty">
                "All reports" has no earlier period to compare with. Pick Last 7, 30 or 90 days.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>This period</th>
                      <th>Before</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeRows.map((row) => (
                      <tr key={row.type}>
                        <td>{row.type}</td>
                        <td>{row.now}</td>
                        <td>{row.before}</td>
                        <td>
                          <strong>{row.change > 0 ? `+${row.change}` : row.change}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-card rs-card" aria-label="Reports by town">
            <h2 className="admin-card__title">By town</h2>
            <p className="admin-card__sub">Towns with the most reports (top 6)</p>
            <div className="rs-chart">
              <Bar data={townData} options={sidewaysOptions} />
            </div>
          </section>

          <section className="admin-card rs-card" aria-label="Reports by day of the week">
            <h2 className="admin-card__title">By day of the week</h2>
            <p className="admin-card__sub">Which days get the most reports</p>
            <div className="rs-chart">
              <Bar data={dayData} options={axisOptions} />
            </div>
          </section>

          <section className="admin-card rs-card" aria-label="Reports by time of day">
            <h2 className="admin-card__title">By time of day</h2>
            <p className="admin-card__sub">When reports come in (3-hour blocks)</p>
            <div className="rs-chart">
              <Bar data={timeData} options={axisOptions} />
            </div>
          </section>

          <section className="admin-card rs-card rs-card--wide" aria-label="Top locations">
            <h2 className="admin-card__title">Top locations</h2>
            <p className="admin-card__sub">Places with repeated reports (top 5)</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Reports</th>
                    <th>Critical</th>
                    <th>Still active</th>
                  </tr>
                </thead>
                <tbody>
                  {locationRows.map((row) => (
                    <tr key={row.location}>
                      <td>{row.location}</td>
                      <td>{row.count}</td>
                      <td>{row.critical}</td>
                      <td>{row.active}</td>
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
