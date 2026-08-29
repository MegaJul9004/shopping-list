import { createContext, useContext, useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const EDITOR_STORAGE_KEY = "shopping_editor_mode";

export async function api(endpoint, options = {}, token = null) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const extraHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  try {
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
        throw new Error("Session expired - Please reauthenticate");
      }
      throw new Error(errData.message || "Error " + response.status);
    }

    return response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

const AppContext = createContext();

// Editor mode initial state with localStorage fallback
let initialEditorMode = false;
try {
  initialEditorMode = localStorage.getItem(EDITOR_STORAGE_KEY) === "1";
} catch (e) {
  console.warn("Couldn't access localStorage for editor mode");
}

export function AppProvider({ children }) {
  // Editor Mode State
  const [editorMode, setEditorMode] = useState(initialEditorMode);

  // Session State
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem("shopping_session");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // App Settings State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("shopping_settings");
    return saved ? JSON.parse(saved) : { duplicateBehavior: "merge", language: "de" };
  });

  // Theme State (with dark mode toggle)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("shopping_theme");
    return saved ? JSON.parse(saved) : {
      primary: "#0d6e6e",
      accent: "#ef8354",
      bgTop: "#f9f3e7",
      bgBottom: "#e2f3ff",
      darkMode: false
    };
  });

  // Persist editor mode changes
  useEffect(() => {
    try {
      localStorage.setItem(EDITOR_STORAGE_KEY, editorMode ? "1" : "0");
    } catch (e) {
      console.warn("Couldn't save editor mode:", e);
    }
  }, [editorMode]);

  // Persist session changes
  useEffect(() => {
    try {
      if (session) {
        localStorage.setItem("shopping_session", JSON.stringify(session));
      } else {
        localStorage.removeItem("shopping_session");
      }
    } catch (e) {
      console.warn("Couldn't save session:", e);
    }
  }, [session]);

  // Persist settings changes
  useEffect(() => {
    try {
      localStorage.setItem("shopping_settings", JSON.stringify(settings));
    } catch (e) {
      console.warn("Couldn't save settings:", e);
    }
  }, [settings]);

  // Persist theme changes & apply CSS variables
  useEffect(() => {
    try {
      // Save theme config
      localStorage.setItem("shopping_theme", JSON.stringify(theme));

      // Apply CSS variables
      const root = document.documentElement;
      root.style.setProperty("--bg-top", theme.bgTop);
      root.style.setProperty("--bg-bottom", theme.bgBottom);
      root.style.setProperty("--brand", theme.primary);
      root.style.setProperty("--accent", theme.accent);

      // Apply dark mode class
      if (theme.darkMode) {
        root.classList.add("dark-mode");
      } else {
        root.classList.remove("dark-mode");
      }
    } catch (e) {
      console.warn("Couldn't apply theme:", e);
    }
  }, [theme]);

  // Theme helper functions
  const updateTheme = (newValues) => {
    setTheme(prev => ({ ...prev, ...newValues }));
  };

  const resetTheme = () => {
    setTheme({
      primary: "#0d6e6e",
      accent: "#ef8354",
      bgTop: "#f9f3e7",
      bgBottom: "#e2f3ff",
      darkMode: false
    });
  };

  const toggleDarkMode = () => {
    setTheme(prev => ({ ...prev, darkMode: !prev.darkMode }));
  };

  // Settings update function
  const updateSettings = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Context value with all states and functions
  const contextValue = {
    session,
    setSession,
    settings,
    updateSettings,
    theme,
    updateTheme,
    resetTheme,
    toggleDarkMode,
    editorMode,
    setEditorMode
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook for easy context access
export function useApp() {
  return useContext(AppContext);
}
