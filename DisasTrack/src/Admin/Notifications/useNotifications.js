import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIncidents } from "../IncidentReports/IncidentsContext.jsx";
import { useAccounts } from "../js/useAccounts.js";
import { useTeams } from "../js/useTeams.js";
import {
  KIND_LINK,
  MAX_NOTIFICATIONS,
  buildNotifications,
  saveLastRead,
  toMs,
  watchLastRead,
} from "./notificationService.js";

// Text of the pop-up when several things of one kind arrive at once (for example the sample data).
const BATCH_TITLE = {
  incident: (n) => `${n} new incident reports`,
  user: (n) => `${n} new users created`,
  team: (n) => `${n} new rescue teams created`,
};

// Notifications the person has clicked are remembered on this device, per account,
// so they stay "read" after a refresh. (The "Mark all as read" marker is saved in Firebase.)
const READ_KEY = (uid) => `disastrack-read-notifications:${uid}`;
const MAX_REMEMBERED = 300;

function loadReadIds(uid) {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY(uid)) || "[]"));
  } catch {
    return new Set(); // storage blocked or unreadable: start empty
  }
}

function saveReadIds(uid, ids) {
  try {
    localStorage.setItem(READ_KEY(uid), JSON.stringify([...ids].slice(-MAX_REMEMBERED)));
  } catch {
    // Storage full or blocked: the item still shows as read until the page is refreshed.
  }
}

/**
 * Live notifications for the signed-in admin. Must be used inside <IncidentsLayout>.
 *
 *   const { items, unread, isUnread, markRead, markAllRead, toasts, dismissToast } = useNotifications(uid);
 *
 *   items    = the latest notifications (newest first)
 *   unread   = how many of them this admin has not read yet
 *   markRead(id) = marks one notification as read (called when it is clicked)
 *   toasts   = small pop-ups for things that arrive while the page is open
 */
export function useNotifications(uid) {
  const { incidents, loading: incidentsLoading } = useIncidents();
  const { accounts, loading: accountsLoading } = useAccounts();
  const { teams, loading: teamsLoading } = useTeams();

  const [lastRead, setLastRead] = useState(null); // ms, null until loaded
  const [liveIds, setLiveIds] = useState(() => new Set()); // arrived while this page was open
  const [toasts, setToasts] = useState([]);
  const [readIds, setReadIds] = useState(() => loadReadIds(uid)); // ids the person clicked
  const seen = useRef(null); // ids already known; null until the first full load

  useEffect(() => {
    if (!uid) return undefined;
    return watchLastRead(uid, setLastRead);
  }, [uid]);

  // A different person signed in: load their own list of read notifications.
  useEffect(() => {
    setReadIds(loadReadIds(uid));
  }, [uid]);

  const all = useMemo(() => buildNotifications({ incidents, accounts, teams }), [incidents, accounts, teams]);
  const items = useMemo(() => all.slice(0, MAX_NOTIFICATIONS), [all]);
  const loaded = !incidentsLoading && !accountsLoading && !teamsLoading;

  // Spot what is new since the last update and pop a toast for it.
  useEffect(() => {
    if (!loaded) return;
    const ids = new Set(all.map((n) => n.id));
    if (seen.current === null) {
      seen.current = ids; // first load: everything here is "already there", no pop-ups
      return;
    }
    const fresh = all.filter((n) => !seen.current.has(n.id));
    seen.current = ids;
    if (fresh.length === 0) return;

    setLiveIds((prev) => new Set([...prev, ...fresh.map((n) => n.id)]));

    const groups = {};
    fresh.forEach((n) => (groups[n.kind] = [...(groups[n.kind] || []), n]));
    const popups = Object.entries(groups).map(([kind, list]) =>
      list.length === 1
        ? { ...list[0], key: list[0].id }
        : {
            key: `${kind}:batch:${Date.now()}`,
            kind,
            title: BATCH_TITLE[kind](list.length),
            text: "",
            meta: "",
            to: KIND_LINK[kind],
          }
    );
    setToasts((prev) => [...popups, ...prev].slice(0, 4));
  }, [all, loaded]);

  const isUnread = useCallback(
    (n) => lastRead !== null && !readIds.has(n.id) && (liveIds.has(n.id) || toMs(n.at) > lastRead),
    [lastRead, liveIds, readIds]
  );
  const unread = useMemo(() => items.filter(isUnread).length, [items, isUnread]);

  // Clicking one notification marks just that one as read.
  const markRead = useCallback(
    (id) => {
      if (!id) return;
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        saveReadIds(uid, next);
        return next;
      });
    },
    [uid]
  );

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastRead(toMs(now));
    setLiveIds(new Set());
    saveLastRead(uid, now);
  }, [uid]);

  const dismissToast = useCallback((key) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  return { items, unread, isUnread, markRead, markAllRead, toasts, dismissToast };
}