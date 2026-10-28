import { useEffect, useState } from "react";
import { watchTeams } from "./teamService.js";

/**
 * Gives a screen the live list of rescue teams from Firebase.
 *   const { teams, loading, error } = useTeams();
 * The list updates by itself whenever the database changes.
 */
export function useTeams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    return watchTeams((list, err) => {
      setTeams(list);
      setError(err);
      setLoading(false);
    });
  }, []);

  return { teams, loading, error };
}
