import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../Icon.jsx";
import { ago } from "../IncidentReports/incidentsData.js";
import { KIND_ICON } from "./notificationService.js";
import { useNotifications } from "./useNotifications.js";

const TOAST_MS = 7000;

// One pop-up. It closes by itself after a few seconds.
function Toast({ toast, onOpen, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.key), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.key, onClose]);

  return (
    <div className={`nt-toast nt-toast--${toast.kind}`} role="status">
      <button type="button" className="nt-toast__body" onClick={() => onOpen(toast)}>
        <span className="nt-icon"><Icon name={KIND_ICON[toast.kind]} size={16} /></span>
        <span className="nt-text">
          <span className="nt-title">{toast.title}</span>
          {toast.text && <span className="nt-sub">{toast.text}</span>}
        </span>
      </button>
      <button type="button" className="nt-toast__close" onClick={() => onClose(toast.key)} aria-label="Dismiss">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

/**
 * The bell in the admin top bar: unread count, a list of the latest notifications,
 * and pop-ups for new incident reports, new users and new rescue teams.
 * Props: uid = the signed-in admin's uid (each admin has their own "read" marker).
 */
// base = where the console lives: "/admin" (default) or "/officer".
// The officer has no Users / Rescue Teams screens, so those open the Live Map instead.
export default function NotificationBell({ uid, base = "/admin" }) {
  const { items, unread, isUnread, markRead, markAllRead, toasts, dismissToast } = useNotifications(uid);
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const navigate = useNavigate();

  // Close the list when clicking outside it or pressing Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openItem(n) {
    markRead(n.id); // clicking a notification marks it as read (pop-ups for several items have no id)
    setOpen(false);
    dismissToast(n.key || n.id);
    if (base === "/admin") navigate(n.to);
    else if (n.kind === "incident") navigate(`${base}/incident-reports/${String(n.id).split(":")[1]}`);
    else navigate(`${base}/live-map`);
  }

  return (
    <>
      <div className="nt-wrap" ref={wrap}>
        <button
          type="button"
          className="admin-iconbtn"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="bell" />
          {unread > 0 && <span className="nt-badge">{unread > 9 ? "9+" : unread}</span>}
        </button>

        {open && (
          <div className="nt-panel" role="dialog" aria-label="Notifications">
            <div className="nt-panel__head">
              <strong>Notifications</strong>
              <button type="button" className="nt-link" onClick={markAllRead} disabled={unread === 0}>
                Mark all as read
              </button>
            </div>

            {items.length === 0 ? (
              <p className="nt-empty">Nothing yet. New reports, users and rescue teams will show up here.</p>
            ) : (
              <ul className="nt-list">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`nt-item nt-item--${n.kind} ${isUnread(n) ? "is-unread" : ""}`}
                      onClick={() => openItem(n)}
                    >
                      <span className="nt-icon"><Icon name={KIND_ICON[n.kind]} size={16} /></span>
                      <span className="nt-text">
                        <span className="nt-title">{n.title}</span>
                        <span className="nt-sub">{n.text}</span>
                        <span className="nt-meta">{[n.meta, ago(n.at)].filter(Boolean).join(" · ")}</span>
                      </span>
                      {isUnread(n) && <span className="nt-unread" aria-label="Unread" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="nt-toasts" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.key} toast={t} onOpen={openItem} onClose={dismissToast} />
        ))}
      </div>
    </>
  );
}
