import { createContext, useContext, useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function api(endpoint, options = {}, token = null) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const extraHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_BASE}${cleanEndpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `Fehler ${response.status}`);
  }

  return response.json();
}

const AppContext = createContext();

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem("shopping_session");
    return saved ? JSON.parse(saved) : null;
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("shopping_settings");
    return saved ? JSON.parse(saved) : { duplicateBehavior: "merge" };
  });

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("shopping_theme");
    return saved ? JSON.parse(saved) : { primary: "#0d6e6e", accent: "#ef8354", bgTop: "#f9f3e7", bgBottom: "#e2f3ff" };
  });

  useEffect(() => {
    if (session) localStorage.setItem("shopping_session", JSON.stringify(session));
    else localStorage.removeItem("shopping_session");
  }, [session]);

  useEffect(() => {
    localStorage.setItem("shopping_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("shopping_theme", JSON.stringify(theme));
  }, [theme]);

  const updateSettings = async (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const updateTheme = (newTheme) => {
    setTheme((prev) => ({ ...prev, ...newTheme }));
  };

  const resetTheme = () => {
    setTheme({ primary: "#0d6e6e", accent: "#ef8354", bgTop: "#f9f3e7", bgBottom: "#e2f3ff" });
  };

  return (
    <AppContext.Provider value={{ session, setSession, settings, updateSettings, theme, updateTheme, resetTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
