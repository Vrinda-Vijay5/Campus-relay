import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '../api/client';

const MetaContext = createContext(null);

export function MetaProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .getMeta()
      .then((data) => {
        setMeta({
          statusLabels: data.statusLabels,
          relaySequence: data.relaySequence,
          vendors: data.vendors,
        });
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <MetaContext.Provider
      value={{
        statusLabels: meta?.statusLabels || {},
        relaySequence: meta?.relaySequence || [],
        vendors: meta?.vendors || [],
        loading,
        error,
        reload: load,
      }}
    >
      {children}
    </MetaContext.Provider>
  );
}

export function useMeta() {
  const ctx = useContext(MetaContext);
  if (!ctx) throw new Error('useMeta must be used within a MetaProvider');
  return ctx;
}
