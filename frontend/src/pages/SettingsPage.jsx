import { useState } from "react";
import { useApp } from "../context/AppContext";

const THEME_PRESETS = [
  { name: "Standard", primary: "#0d6e6e", accent: "#ef8354", bgTop: "#f9f3e7", bgBottom: "#e2f3ff" },
  { name: "Dunkel", primary: "#1a1a2e", accent: "#e94560", bgTop: "#16213e", bgBottom: "#0f3460" },
  { name: "Natur", primary: "#2d6a4f", accent: "#d4a373", bgTop: "#fefae0", bgBottom: "#e9edc9" },
  { name: "Blau", primary: "#1e3a5f", accent: "#f4a261", bgTop: "#e8f4f8", bgBottom: "#b8d4e3" }
];

export default function SettingsPage({ theme, setTheme, session }) {
  const { settings, updateSettings } = useApp();
  const [showTheme, setShowTheme] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDuplicateChange = async (behavior) => {
    setSaving(true);
    await updateSettings({ duplicateBehavior: behavior });
    setSaving(false);
  };

  const applyPreset = (preset) => {
    setTheme(preset);
    localStorage.setItem("shoppingTheme", JSON.stringify(preset));
  };

  const updateThemeField = (field, value) => {
    const next = { ...theme, [field]: value };
    setTheme(next);
    localStorage.setItem("shoppingTheme", JSON.stringify(next));
  };

  return (
    <div className="page-shell">
      <div className="hero">
        <p className="eyebrow">Einstellungen</p>
        <h1>Anpassungen</h1>
      </div>

      <div className="dashboard-grid" style={{ marginTop: "1.4rem" }}>
        <section className="card">
          <h2>🎨 Farbschema</h2>
          <div className="theme-presets">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="ghost"
                onClick={() => applyPreset(preset)}
                style={{
                  borderLeft: `4px solid ${preset.primary}`,
                  background: preset.bgTop,
                  color: "#1f2a37"
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => setShowTheme(!showTheme)}
            style={{ marginTop: "0.5rem" }}
          >
            {showTheme ? "Fertige Farben ausblenden" : "Farben individuell anpassen"}
          </button>
          {showTheme && (
            <div className="theme-grid" style={{ marginTop: "0.5rem" }}>
              <label>
                Primärfarbe
                <input
                  type="color"
                  value={theme.primary}
                  onChange={(e) => updateThemeField("primary", e.target.value)}
                />
              </label>
              <label>
                Akzentfarbe
                <input
                  type="color"
                  value={theme.accent}
                  onChange={(e) => updateThemeField("accent", e.target.value)}
                />
              </label>
              <label>
                Hintergrund oben
                <input
                  type="color"
                  value={theme.bgTop}
                  onChange={(e) => updateThemeField("bgTop", e.target.value)}
                />
              </label>
              <label>
                Hintergrund unten
                <input
                  type="color"
                  value={theme.bgBottom}
                  onChange={(e) => updateThemeField("bgBottom", e.target.value)}
                />
              </label>
            </div>
          )}
        </section>

        <section className="card">
          <h2>⚙️ Einkaufsliste</h2>
          <label>
            <strong>Verhalten bei doppelten Artikeln</strong>
            <select
              value={settings.duplicateBehavior}
              onChange={(e) => handleDuplicateChange(e.target.value)}
              disabled={saving}
            >
              <option value="merge">Menge erhöhen (z. B. "Eier 2x")</option>
              <option value="separate">Separate Einträge anlegen</option>
            </select>
            <p className="muted" style={{ marginTop: "0.3rem" }}>
              Wenn "Eier" zweimal eingegeben wird, wird bei "Menge erhöhen" die Stückzahl
              automatisch erhöht, statt einen zweiten Eintrag zu erzeugen.
            </p>
          </label>
        </section>

        <section className="card">
          <h2>ℹ️ Über die App</h2>
          <p className="muted">
            Family Shopping List – Version 2.0<br />
            Backend: {import.meta.env.VITE_API_URL || "http://localhost:4000/api"}<br />
            Familie: {session?.familyName || "—"} (Code: {session?.familyId || "—"})
          </p>
        </section>
      </div>
    </div>
  );
}