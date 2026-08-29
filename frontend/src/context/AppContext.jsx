import { createContext, useContext, useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const EDITOR_STORAGE_KEY = "shopping_editor_mode";

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
    if (response.status === 401) {
      localStorage.removeItem("shopping_session");
    }
    throw new Error(errData.message || `Fehler ${response.status}`);
  }

const AppContext = createContext();

// Editor mode state in context
let initialEditorMode = false;
try { initialEditorMode = localStorage.getItem(EDITOR_STORAGE_KEY) === "1"; } catch {}

  return response.json();
}

const AppContext = createContext();

export function AppProvider({ children }) {
export function AppProvider({ children }) {
  const [editorMode, setEditorMode] = useState(initialEditorMode);
  useEffect(() => {
    try { localStorage.setItem(EDITOR_STORAGE_KEY, editorMode ? "1" : "0"); } catch {}
  }, [editorMode]);
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem("shopping_session");
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.token) return null;
      // Token-Expiry wird beim naechsten API-Call geprueft (401)
      return parsed;
    } catch { return null; }
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

  // Apply theme as CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-top', theme.bgTop);
    root.style.setProperty('--bg-bottom', theme.bgBottom);
    root.style.setProperty('--brand', theme.primary);
    root.style.setProperty('--accent', theme.accent);
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

<AppContext.Provider value={{ session, setSession, settings, updateSettings, theme, updateTheme, resetTheme, editorMode, setEditorMode }}>
  return (
    <AppContext.Provider value={{ session, setSession, settings, updateSettings, theme, updateTheme, resetTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
