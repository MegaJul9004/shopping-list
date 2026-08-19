import { createContext, useContext, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

export async function api(path, options = {}, token) {
  const extraHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...extraHeaders },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "API request failed");
  }
  return data;
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem("authSession");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [settings, setSettings] = useState({ duplicateBehavior: "merge" });

  useEffect(() => {
    if (session) {
      localStorage.setItem("authSession", JSON.stringify(session));
    } else {
      localStorage.removeItem("authSession");
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      api(`/families/${session.familyId}/settings`, {}, session.token)
        .then((data) => {
          if (data.settings) setSettings(data.settings);
        })
        .catch(() => {});
    }
  }, [session]);

  const updateSettings = async (newSettings) => {
    if (!session) return;
    try {
      const data = await api(
        `/families/${session.familyId}/settings`,
        {
          method: "POST",
          body: JSON.stringify(newSettings)
        },
        session.token
      );
      if (data.settings) setSettings(data.settings);
    } catch (e) {
      console.error("Settings update failed", e);
    }
  };

  const value = {
    session,
    setSession,
    settings,
    updateSettings,
    API_BASE
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}