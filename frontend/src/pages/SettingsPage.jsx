import { useCallback, useEffect, useState } from "react";
import { useApp, api } from "../context/AppContext";

const THEME_PRESETS = [
  { name: "Standard", primary: "#0d6e6e", accent: "#ef8354", bgTop: "#f9f3e7", bgBottom: "#e2f3ff" },
  { name: "Dunkel", primary: "#1a1a2e", accent: "#e94560", bgTop: "#16213e", bgBottom: "#0f3460" },
  { name: "Natur", primary: "#2d6a4f", accent: "#d4a373", bgTop: "#fefae0", bgBottom: "#e9edc9" },
  { name: "Blau", primary: "#1e3a5f", accent: "#f4a261", bgTop: "#e8f4f8", bgBottom: "#b8d4e3" }
];

const MARKETS = ["LIDL", "EDEKA", "ALDI", "REWE"];

// Bekannte EDEKA-Filial-IDs für beliebte Städte (Beispieldaten)
const EDEKA_BRANCHES = {
  "80331": { name: "EDEKA München Zentrum", id: "801341", url: "https://www.edeka.de/maerkte/801341/angebote/" },
  "10115": { name: "EDEKA Berlin Mitte", id: "700101", url: "https://www.edeka.de/maerkte/700101/angebote/" },
  "20095": { name: "EDEKA Hamburg Zentrum", id: "700200", url: "https://www.edeka.de/maerkte/700200/angebote/" },
  "50667": { name: "EDEKA Köln Zentrum", id: "700506", url: "https://www.edeka.de/maerkte/700506/angebote/" },
  "60311": { name: "EDEKA Frankfurt Zentrum", id: "700603", url: "https://www.edeka.de/maerkte/700603/angebote/" }
};
const handleDuplicateChange = async (behavior) => {
    setSaving(true);
    await updateSettings({ duplicateBehavior: behavior });
    setSaving(false);
  };

  const saveBranch = async (market) => {
    const form = branchForms[market] || {};
    if (!form.branchName && !form.branchZip) {
      setBranchMessage(`Bitte mindestens Filialnamen oder PLZ für ${market} eingeben.`);
      return;
    }
    setBranchMessage("");
    try {
      const data = await api(
        `/families/${session.familyId}/branches/${market}`,
        {
          method: "POST",
          body: JSON.stringify(form)
        },
        session.token
      );
      if (data.branch) {
        setBranches((prev) => ({ ...prev, [market]: data.branch }));
        setBranchMessage(`${market}: Gespeichert ✓`);
      }
    } catch (e) {
      setBranchMessage(`Fehler: ${e.message}`);
    }
  };

  const removeBranch = async (market) => {
    try {
      await api(`/families/${session.familyId}/branches/${market}`, { method: "DELETE" }, session.token);
      setBranches((prev) => {
        const next = { ...prev };
        delete next[market];
        return next;
      });
      setBranchMessage(`${market}: Entfernt`);
    } catch (e) {
      setBranchMessage(`Fehler: ${e.message}`);
    }
  };

  const handleBranchZipLookup = (market, zip) => {
    const match = EDEKA_BRANCHES[zip];
    if (match && market === "EDEKA") {
      setBranchForms((prev) => ({
        ...prev,
        [market]: {
          ...prev[market],
          branchName: match.name,
          branchId: match.id,
          locationUrl: match.url,
          branchZip: zip,
          branchCity: match.name.replace("EDEKA ", "")
        }
      }));
    }
  };

export default function SettingsPage({ theme, setTheme, session }) {
  const { settings, updateSettings } = useApp();
  const [showTheme, setShowTheme] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState({});
  const [branchForms, setBranchForms] = useState({});
  const [branchMessage, setBranchMessage] = useState("");

  // Load existing branches
  const loadBranches = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api(`/families/${session.familyId}/branches`, {}, session.token);
      setBranches(data.branches || {});
    } catch { /* ignore */ }
  }, [session]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

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

      {/* ── Filialauswahl ── */}
      <div className="dashboard-grid" style={{ marginTop: "1rem" }}>
        <section className="card" style={{ gridColumn: "1 / -1" }}>
          <h2>🏪 Filialen / Standorte auswählen</h2>
          <p className="muted">
            Gib deine Stamm-Filialen ein – per PLZ, Ort oder direkter Filial-ID.
            Die Angebote werden dann von diesen Filial-Websites geladen.
          </p>
          {branchMessage && (
            <p className="muted" style={{ color: branchMessage.includes("✓") ? "var(--ok)" : "var(--danger)", marginBottom: "0.5rem" }}>
              {branchMessage}
            </p>
          )}
          <div className="branches-grid">
            {MARKETS.map((market) => {
              const branch = branches[market];
              const form = branchForms[market] || {};
              return (
                <div className="branch-card" key={market} style={{ borderLeft: `4px solid ${theme.primary}` }}>
                  <h3>{market}</h3>
                  {branch && (
                    <div className="branch-saved">
                      <p><strong>{branch.branchName}</strong></p>
                      {branch.branchZip && <span className="muted">PLZ: {branch.branchZip}</span>}
                      {branch.branchCity && <span className="muted"> · {branch.branchCity}</span>}
                      {branch.branchId && <span className="muted"> · ID: {branch.branchId}</span>}
                      {branch.locationUrl && (
                        <p><a href={branch.locationUrl} target="_blank" rel="noreferrer">Zur Filial-Website →</a></p>
                      )}
                      <button type="button" className="danger" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }} onClick={() => removeBranch(market)}>
                        Entfernen
                      </button>
                    </div>
                  )}
                  <div className="branch-form">
                    <label>
                      PLZ (für EDEKA-Vorschläge)
                      <input
                        type="text" placeholder="z. B. 80331"
                        value={form.branchZip ?? branch?.branchZip ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBranchForms((prev) => ({ ...prev, [market]: { ...prev[market], branchZip: v } }));
                          if (v.length === 5) handleBranchZipLookup(market, v);
                        }}
                      />
                    </label>
                    <label>
                      Filialname
                      <input
                        type="text" placeholder="z. B. EDEKA Hauptstraße"
                        value={form.branchName ?? branch?.branchName ?? ""}
                        onChange={(e) => setBranchForms((prev) => ({ ...prev, [market]: { ...prev[market], branchName: e.target.value } }))}
                      />
                    </label>
                    <label>
                      Ort
                      <input
                        type="text" placeholder="z. B. München"
                        value={form.branchCity ?? branch?.branchCity ?? ""}
                        onChange={(e) => setBranchForms((prev) => ({ ...prev, [market]: { ...prev[market], branchCity: e.target.value } }))}
                      />
                    </label>
                    <label>
                      Filial-ID
                      <input
                        type="text" placeholder="z. B. 801341"
                        value={form.branchId ?? branch?.branchId ?? ""}
                        onChange={(e) => setBranchForms((prev) => ({ ...prev, [market]: { ...prev[market], branchId: e.target.value } }))}
                      />
                    </label>
                    <label>
                      Angebots-URL
                      <input
                        type="text" placeholder="https://www.edeka.de/maerkte/..."
                        value={form.locationUrl ?? branch?.locationUrl ?? ""}
                        onChange={(e) => setBranchForms((prev) => ({ ...prev, [market]: { ...prev[market], locationUrl: e.target.value } }))}
                      />
                    </label>
                    <button type="button" className="ghost" onClick={() => saveBranch(market)} style={{ marginTop: "0.3rem" }}>
                      {branch ? "Aktualisieren" : "Speichern"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}