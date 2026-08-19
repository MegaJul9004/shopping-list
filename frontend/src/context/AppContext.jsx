import { createContext, useContext, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const DEFAULT_THEME = {
  primary: "#0d6e6e",
  accent: "#ef8354",
  bgTop: "#f9f3e7",
  bgBottom: "#e2f3ff"
};

function loadTheme() {
  try {
    const raw = localStorage.getItem("shoppingTheme");
    return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

export async function api(path, options = {}, token) {
  const extraHeaders = token
    ? { Authorization: Bearer  }
    : {};
  const response = await fetch(${API_BASE}, {
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
  const [theme, setTheme] = useState(loadTheme);

  // Theme CSS-Variablen setzen
  useEffect(() => {
    document.documentElement.style.setProperty("--brand", theme.primary);
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty("--bg-top", theme.bgTop);
    document.documentElement.style.setProperty("--bg-bottom", theme.bgBottom);
  }, [theme]);

  useEffect(() => {
    if (session) {
      localStorage.setItem("authSession", JSON.stringify(session));
    } else {
      localStorage.removeItem("authSession");
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      api(/families//settings, {}, session.token)
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
        /families//settings,
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

  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("shoppingTheme", JSON.stringify(newTheme));
  };

  const resetTheme = () => {
    setTheme({ ...DEFAULT_THEME });
    localStorage.setItem("shoppingTheme", JSON.stringify(DEFAULT_THEME));
  };

  const value = {
    session,
    setSession,
    settings,
    updateSettings,
    theme,
    updateTheme,
    resetTheme,
    DEFAULT_THEME,
    API_BASE
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
