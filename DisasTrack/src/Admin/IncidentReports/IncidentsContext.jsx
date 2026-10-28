import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { seedIncidents } from "./incidentsData.js";
import { logAction } from "../Audit/auditLog.js";
import { saveIncidents, updateIncident, watchIncidents } from "./incidentService.js";

const IncidentsContext = createContext(null);

/**
 * Route wrapper: listens to Firebase /incidents once and shares the list with every
 * admin screen (Dashboard, Incident Reports, Incident Detail, Live Map, Reports & Stats),
 * so all the numbers match. Firebase pushes every change, so edits made on one screen
 * (verify, priority, dispatch...) show up everywhere right away, even on another admin's
 * computer.
 *
 *   const { incidents, loading, error, update, loadSamples } = useIncidents();
 *
 *   update(id, patch, log)  -> saves the changes at /incidents/{id} and adds `log`
 *                              to the activity list ({ text, at: ISO timestamp }).
 *                              Returns a promise (it rejects with a readable message).
 *   loadSamples()           -> one-time: saves the sample incidents in Firebase.
 */
// Decides what to write in the audit log for one incident change.
// patch = the fields that were changed, log = the text of the change.
function auditEntry(id, patch, log) {
  let action = "Incident updated";
  let category = "Incident";
  if (patch.team) {
    action = "Team assigned";
    category = "Assignment";
  } else if (patch.priority) {
    action = "Priority changed";
  } else if (patch.status) {
    action = "Status changed";
  } else if (patch.type) {
    action = "Classification changed";
  }
  return { category, action, target: id, details: log };
}

export function IncidentsLayout() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    return watchIncidents((list, err) => {
      setIncidents(list);
      setError(err);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      incidents,
      loading,
      error,
      update: async (id, patch, log) => {
        await updateIncident(id, patch, log);
        // Only logged after the change was saved. Logging never stops the screen.
        logAction(auditEntry(id, patch, log || "Incident changed"));
      },
      loadSamples: () => saveIncidents(seedIncidents()),
    }),
    [incidents, loading, error]
  );

  return (
    <IncidentsContext.Provider value={value}>
      <Outlet />
    </IncidentsContext.Provider>
  );
}

export function useIncidents() {
  const ctx = useContext(IncidentsContext);
  if (!ctx) throw new Error("useIncidents must be used inside <IncidentsLayout>");
  return ctx;
}
