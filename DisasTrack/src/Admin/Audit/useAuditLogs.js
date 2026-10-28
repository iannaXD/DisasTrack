import { useEffect, useState } from "react";
import { watchAuditLogs } from "./auditLog.js";

/**
 * Gives a screen the live audit log (newest first).
 *   const { logs, loading, error } = useAuditLogs();
 */
export function useAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    return watchAuditLogs((list, err) => {
      setLogs(list);
      setError(err);
      setLoading(false);
    });
  }, []);

  return { logs, loading, error };
}
