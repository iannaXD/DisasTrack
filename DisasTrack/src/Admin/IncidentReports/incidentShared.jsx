import { statusLabel } from "./incidentsData.js";

const slug = (text) => text.toLowerCase().replace(/\s+/g, "-");

/** Priority or status pill. Colors live in Admin/Admin.css (.ir-badge--*) */
export function Badge({ label }) {
  return <span className={`ir-badge ir-badge--${slug(label)}`}>{label}</span>;
}

const base = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
};

export const IconSearch = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

export const IconBack = () => (
  <svg {...base}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const IconDownload = () => (
  <svg {...base}>
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </svg>
);

export const IconLayers = () => (
  <svg {...base}>
    <path d="M12 4l8 4-8 4-8-4 8-4z" />
    <path d="M4 12l8 4 8-4M4 16l8 4 8-4" />
  </svg>
);

export const IconChevronDown = () => (
  <svg {...base}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconChevronLeft = () => (
  <svg {...base}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconChevronRight = () => (
  <svg {...base}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconCheck = () => (
  <svg {...base}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const IconAlert = () => (
  <svg {...base}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18h.01" />
  </svg>
);

export const IconImage = () => (
  <svg {...base} width={24} height={24}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10.5" r="1.8" />
    <path d="M4 18l5-5 4 4 3-3 4 4" />
  </svg>
);
