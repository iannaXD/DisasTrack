import { useEffect, useState } from "react";
import { watchAccounts } from "./accountService.js";

/**
 * Gives a screen the live list of accounts from Firebase.
 *   const { accounts, loading, error } = useAccounts();
 * The list updates by itself whenever the database changes.
 */
export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // watchAccounts returns a "stop listening" function, which React runs on cleanup.
    return watchAccounts((list, err) => {
      setAccounts(list);
      setError(err);
      setLoading(false);
    });
  }, []);

  return { accounts, loading, error };
}
