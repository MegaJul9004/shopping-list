import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, api } from "../context/AppContext";
import NavBar from "../components/NavBar";

const THEME_PRESETS = [
  { name: "Standard", primary: "#0d6e6e", accent: "#ef8354", bgTop: "#f9f3e7", bgBottom: "#e2f3ff", card: "#ffffffcc", cardText: "#1f2a37", cardFont: '"Space Grotesk", sans-serif' },
  { name: "Dunkel", primary: "#1a1a2e", accent: "#e94560", bgTop: "#16213e", bgBottom: "#0f3460", card: "#1f2a37cc", cardText: "#e8eef2", cardFont: '"Space Grotesk", sans-serif' },
  { name: "Natur", primary: "#2d6a4f", accent: "#d4a373", bgTop: "#fefae0", bgBottom: "#e9edc9", card: "#ffffffcc", cardText: "#2b3427", cardFont: '"Space Grotesk", sans-serif' },
  { name: "Blau", primary: "#1e3a5f", accent: "#f4a261", bgTop: "#e8f4f8", bgBottom: "#b8d4e3", card: "#ffffffcc", cardText: "#1c2b36", cardFont: '"Space Grotesk", sans-serif' }
];

const MARKETS = ["LIDL", "EDEKA", "ALDI", "REWE"];

const CARD_FONTS = [
  { label: "Space Grotesk", value: '"Space Grotesk", sans-serif' },
  { label: "Sora", value: '"Sora", sans-serif' },
  { label: "Serif (Georgia)", value: 'Georgia, "Times New Roman", serif' },
  { label: "Monospace (Courier)", value: '"Courier New", monospace' },
  { label: "Sans (Arial)", value: "Arial, Helvetica, sans-serif" },
  { label: "Comic (Comic Sans)", value: '"Comic Sans MS", "Segoe UI", cursive' }
];

export default function SettingsPage() {
  const { session, settings, updateSettings, theme, updateTheme, resetTheme, t } = useApp();
  const [showTheme, setShowTheme] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState({});
  const [branchMessage, setBranchMessage] = useState("");

  // PLZ / Address search
  const [zipInput, setZipInput] = useState("");
  const [zipResults, setZipResults] = useState([]);
  const [zipSearching, setZipSearching] = useState(false);
  const [zipSaving, setZipSaving] = useState(false);

  const loadBranches = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api(`/families/${session.familyId}/branches`, {}, session.token);
      setBranches(data.branches || {});
    } catch {}
  }, [session]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  // Debounced ZIP search
  useEffect(() => {
    const clean = zipInput.replace(/[^0-9]/g, "");
    if (clean.length < 3) {
      setZipResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setZipSearching(true);
      try {
        const data = await api(`/branches/search?zip=${clean}`);
        setZipResults(Array.isArray(data.branches) ? data.branches : []);
      } catch (e) {
        setZipResults([]);
      }
      setZipSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [zipInput]);

  const handleDuplicateChange = async (behavior) => {
    setSaving(true);
    await updateSettings({ duplicateBehavior: behavior });
    try {
      await api(`/families/${session.familyId}/settings`, {
        method: "POST",
        body: JSON.stringify({ duplicateBehavior: behavior })
      }, session.token);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const applyBranchResults = async () => {
    if (zipResults.length === 0) return;
    setZipSaving(true);
    setBranchMessage("");
    let saved = 0;
    let errors = 0;

    for (const entry of zipResults) {
      if (!entry.market || !entry.name) continue;
      try {
        const data = await api(`/families/${session.familyId}/branches/${entry.market}`,
          { method: "POST", body: JSON.stringify({
            branchName: entry.name,
            branchCity: entry.city || "",
            branchZip: entry.zip || "",
            branchId: entry.id || "",
            locationUrl: entry.url || ""
          }) }, session.token);
        if (data.branch) {
          setBranches((prev) => ({ ...prev, [entry.market]: data.branch }));
          saved++;
        }
      } catch {
        errors++;
      }
    }

    if (errors > 0) {
      setBranchMessage(`${saved} gespeichert, ${errors} Fehler`);
    } else {
      setBranchMessage(`✓ Alle ${saved} Filialen gespeichert`);
    }
    setZipSaving(false);
    setZipResults([]);
    setZipInput("");
  };

  const removeBranch = async (market) => {
    try {
      await api(`/families/${session.familyId}/branches/${market}`, { method: "DELETE" }, session.token);
      setBranches((prev) => { const n = { ...prev }; delete n[market]; return n; });
      setBranchMessage(`${market}: Entfernt`);
    } catch (e) { setBranchMessage(`Fehler: ${e.message}`); }
  };

  return (
    <div className="page-shell">
      <NavBar theme={theme} session={session} onLogout={() => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("shopping_session");
          window.location.reload();
        }
      }} />
      <div className="hero" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}>
        <h1>⚙️ Einstellungen</h1>
        <p>Farbschema, Duplikat-Verhalten und Filialen verwalten</p>
      </div>

      <div className="dashboard-grid" style={{ marginTop: "1.4rem" }}>
        <section className="card">
          <h2>🎨 Farbschema</h2>
          <button type="button" className="ghost" onClick={() => setShowTheme(!showTheme)}>
            {showTheme ? "Schließen" : "Anpassen"}
          </button>
          {showTheme && (
            <div className="theme-picker">
              <div className="theme-presets">
                {THEME_PRESETS.map((preset) => (
                  <button key={preset.name} type="button" className="ghost"
                    onClick={() => updateTheme(preset)}
                    style={{
                      borderLeft: `6px solid ${preset.primary}`,
                      textAlign: "left", fontSize: "0.9rem"
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <div className="theme-grid">
                <label>Primär <input type="color" value={theme.primary}
                  onChange={(e) => updateTheme({ primary: e.target.value })} /></label>
                <label>Akzent <input type="color" value={theme.accent}
                  onChange={(e) => updateTheme({ accent: e.target.value })} /></label>
                <label>Hintergrund oben <input type="color" value={theme.bgTop}
                  onChange={(e) => updateTheme({ bgTop: e.target.value })} /></label>
                <label>Hintergrund unten <input type="color" value={theme.bgBottom}
                  onChange={(e) => updateTheme({ bgBottom: e.target.value })} /></label>
                <label>Kacheln <input type="color" value={theme.card}
                  onChange={(e) => updateTheme({ card: e.target.value })} /></label>
                <label>Kachel-Schrift <input type="color" value={theme.cardText}
                  onChange={(e) => updateTheme({ cardText: e.target.value })} /></label>
                <label>Schriftart
                  <select value={theme.cardFont} onChange={(e) => updateTheme({ cardFont: e.target.value })}>
                    {CARD_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="ghost" onClick={resetTheme}>Zurücksetzen</button>
            </div>
          )}
        </section>

        <section className="card">
          <h2>🌐 {t("settings.language")}</h2>
          <div className="settings-field">
            <label>{t("nav.login") === "Se connecter" ? "Langue" : t("nav.home") === "Inicio" ? "Idioma" : t("nav.home") === "Home" ? "Language" : "Sprache"}</label>
            <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
          <div className="settings-field">
            <label>{t("settings.units")}</label>
            <select value={settings.units} onChange={(e) => updateSettings({ units: e.target.value })}>
              <option value="metric">{t("settings.units.metric")}</option>
              <option value="imperial">{t("settings.units.imperial")}</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Datumsformat</label>
            <select value={settings.dateFormat} onChange={(e) => updateSettings({ dateFormat: e.target.value })}>
              <option value="DD.MM.YYYY">TT.MM.JJJJ (31.12.2026)</option>
              <option value="MM/DD/YYYY">MM/TT/JJJJ (12/31/2026)</option>
              <option value="YYYY-MM-DD">JJJJ-MM-TT (2026-12-31)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Währung</label>
            <select value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
              <option value="EUR">€ Euro</option>
              <option value="USD">$ US-Dollar</option>
              <option value="GBP">£ Britisches Pfund</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Zahlformat</label>
            <select value={settings.numberFormat} onChange={(e) => updateSettings({ numberFormat: e.target.value })}>
              <option value="comma">Komma (1,50)</option>
              <option value="dot">Punkt (1.50)</option>
            </select>
          </div>
          <div className="settings-field">
            <label>Wochenstart</label>
            <select value={settings.weekStart} onChange={(e) => updateSettings({ weekStart: Number(e.target.value) })}>
              <option value={1}>Montag</option>
              <option value={0}>Sonntag</option>
            </select>
          </div>
          <p className="muted" style={{ marginTop: "0.6rem" }}>Änderungen werden automatisch gespeichert und angewendet.</p>
        </section>

        <section className="card">
          <h2>🧠 Smart-Liste</h2>
          <label>Duplikat-Verhalten
            <select value={settings.duplicateBehavior} onChange={(e) => handleDuplicateChange(e.target.value)} disabled={saving}>
              <option value="merge">Mengen zusammenführen</option>
              <option value="separate">Separate Einträge</option>
            </select>
          </label>
          {saving && <p className="muted">Speichere...</p>}
        </section>

        <section className="card" style={{ gridColumn: "1 / -1" }}>
          <h2>🏪 Filialen (LIDL, EDEKA, ALDI, REWE)</h2>
          <p className="muted">Gib eine Postleitzahl ein, um alle Filialen in der Nähe zu finden und zu speichern.</p>

          {/* PLZ Search */}
          <div className="zip-search-row">
            <input type="text" placeholder="PLZ eingeben (z. B. 31303 für Burgdorf)"
              value={zipInput}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 5);
                setZipInput(v);
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && zipResults.length > 0) applyBranchResults(); }}
              style={{ maxWidth: "300px", display: "inline-block" }}
            />
            {zipSearching && <span className="muted" style={{ marginLeft: "0.5rem" }}>Suche...</span>}
            {zipResults.length > 0 && !zipSearching && (
              <>
                <span className="muted" style={{ marginLeft: "0.5rem", color: "var(--ok)" }}>
                  {zipResults.length} Filialen gefunden
                </span>
                <button type="button" onClick={applyBranchResults} disabled={zipSaving}
                  style={{ marginLeft: "0.5rem" }}>
                  {zipSaving ? "Speichere..." : "Alle übernehmen"}
                </button>
              </>
            )}
          </div>

          {/* Search Results Preview */}
          {zipResults.length > 0 && (
            <div className="zip-results-list">
              {MARKETS.map((m) => {
                const marketResults = zipResults.filter((r) => r.market === m);
                if (marketResults.length === 0) return null;
                return (
                  <div key={m} className="zip-result-item">
                    <strong className="zip-result-market">{m}</strong>
                    {marketResults.map((r, i) => (
                      <span key={i} className="zip-result-name">{r.name}{r.city ? ` (${r.city})` : ""}</span>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {branchMessage && <p className="muted" style={{ marginTop: "0.5rem", color: branchMessage.includes("Fehler") ? "var(--danger)" : "var(--ok)" }}>{branchMessage}</p>}

          {/* Saved Branches */}
          <div className="branches-grid" style={{ marginTop: "1rem" }}>
            {MARKETS.map((market) => {
              const branch = branches[market];
              return (
                <div className="branch-card" key={market} style={{ borderLeft: `4px solid var(--primary, ${theme.primary})` }}>
                  <h3>{market}</h3>
                  {branch ? (
                    <div className="branch-saved">
                      <p><strong>{branch.branchName}</strong></p>
                      {branch.branchZip && <span className="muted">PLZ: {branch.branchZip}</span>}
                      {branch.branchCity && <span className="muted"> · {branch.branchCity}</span>}
                      {branch.branchId && <span className="muted"> · ID: {branch.branchId}</span>}
                      {branch.locationUrl && <p><a href={branch.locationUrl} target="_blank" rel="noreferrer">Zur Filial-Website →</a></p>}
                      <button type="button" className="danger" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", marginTop: "0.3rem" }} onClick={() => removeBranch(market)}>Entfernen</button>
                    </div>
                  ) : (
                    <p className="muted">Keine Filiale gespeichert</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
        <Link to="/" className="btn-inline">← Zurück zur Startseite</Link>
      </div>
    </div>
  );
}
