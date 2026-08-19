import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, api } from "../context/AppContext";

const THEME_PRESETS = [
  { name: "Standard", primary: "#0d6e6e", accent: "#ef8354", bgTop: "#f9f3e7", bgBottom: "#e2f3ff" },
  { name: "Dunkel", primary: "#1a1a2e", accent: "#e94560", bgTop: "#16213e", bgBottom: "#0f3460" },
  { name: "Natur", primary: "#2d6a4f", accent: "#d4a373", bgTop: "#fefae0", bgBottom: "#e9edc9" },
  { name: "Blau", primary: "#1e3a5f", accent: "#f4a261", bgTop: "#e8f4f8", bgBottom: "#b8d4e3" }
];
const MARKETS = ["LIDL", "EDEKA", "ALDI", "REWE"];
const EDEKA_BRANCHES = {
  "80331": { name: "EDEKA München Zentrum", id: "801341", url: "https://www.edeka.de/maerkte/801341/angebote/" },
  "10115": { name: "EDEKA Berlin Mitte", id: "700101", url: "https://www.edeka.de/maerkte/700101/angebote/" },
  "20095": { name: "EDEKA Hamburg Zentrum", id: "700200", url: "https://www.edeka.de/maerkte/700200/angebote/" },
  "50667": { name: "EDEKA Köln Zentrum", id: "700506", url: "https://www.edeka.de/maerkte/700506/angebote/" },
  "60311": { name: "EDEKA Frankfurt Zentrum", id: "700603", url: "https://www.edeka.de/maerkte/700603/angebote/" }
};

export default function SettingsPage() {
  const { session, settings, updateSettings, theme, updateTheme, resetTheme } = useApp();
  const [showTheme, setShowTheme] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState({});
  const [branchForms, setBranchForms] = useState({});
  const [branchMessage, setBranchMessage] = useState("");

  const loadBranches = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api(`/families/${session.familyId}/branches`, {}, session.token);
      setBranches(data.branches || {});
    } catch {}
  }, [session]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const handleDuplicateChange = async (behavior) => {
    setSaving(true);
    await updateSettings({ duplicateBehavior: behavior });
    setSaving(false);
  };

  const saveBranch = async (market) => {
    const form = branchForms[market] || {};
    if (!form.branchName && !form.branchZip) {
      setBranchMessage(\Bitte mindestens Filialnamen oder PLZ für \ eingeben.`);
      return;
    }
    setBranchMessage("");
    try {
      const data = await api(`/families/${session.familyId}/branches/${market}`,
        { method: "POST", body: JSON.stringify(form) }, session.token);
      if (data.branch) {
        setBranches((prev) => ({ ...prev, [market]: data.branch }));
        setBranchMessage(\\: Gespeichert ✓`);
      }
    } catch (e) { setBranchMessage(\Fehler: \`); }
  };

  const removeBranch = async (market) => {
    try {
      await api(`/families/${session.familyId}/branches/${market}`, { method: "DELETE" }, session.token);
      setBranches((prev) => { const n = { ...prev }; delete n[market]; return n; });
      setBranchMessage(\\: Entfernt`);
    } catch (e) { setBranchMessage(\Fehler: \`); }
  };

  const handleBranchZipLookup = (market, zip) => {
    const match = EDEKA_BRANCHES[zip];
    if (match && market === "EDEKA") {
      setBranchForms((prev) => ({
        ...prev, [market]: {
          ...prev[market],
          branchName: match.name, branchId: match.id,
          locationUrl: match.url, branchZip: zip,
          branchCity: match.name.replace("EDEKA ", "")
        }
      }));
    }
  };

  if (!session) {
    return (
      <div className="page-shell">
        <div className="hero">
          <p className="eyebrow">Einstellungen</p>
          <h1>Anmeldung erforderlich</h1>
          <p>Bitte melde dich an, um die Einstellungen zu verwalten.</p>
          <Link to="/" className="btn-inline">Zurück zur Startseite</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="page-shell">
      <div className="hero">
        <p className="eyebrow">Einstellungen</p>
        <h1>Anpassungen</h1>
        <div style={{display:"flex",gap:"0.5rem",marginTop:"0.6rem"}}>
          <Link to="/" className="btn-inline">\u2190 Zur\u00fcck</Link>
          <Link to="/offers" className="btn-inline">\ud83d\udecd Angebote</Link>
        </div>
      </div>

      <div className="dashboard-grid" style={{marginTop:"1.4rem"}}>
        <section className="card">
          <h2>\ud83c\udfa8 Farbschema</h2>
          <div className="theme-presets">
            {THEME_PRESETS.map((preset) => (
              <button key={preset.name} type="button" className="ghost"
                onClick={() => updateTheme(preset)}
                style={{borderLeft:\4px solid \`, background: preset.bgTop, color: "#1f2a37"}}
              >{preset.name}</button>
            ))}
          </div>
          <button type="button" className="ghost" onClick={() => setShowTheme(!showTheme)} style={{marginTop:"0.5rem"}}>
            {showTheme ? "Fertige Farben ausblenden" : "Farben individuell anpassen"}
          </button>
          {showTheme && (
            <div className="theme-grid" style={{marginTop:"0.5rem"}}>
              <label>Prim\u00e4rfarbe <input type="color" value={theme.primary} onChange={(e) => updateTheme({...theme, primary: e.target.value})} /></label>
              <label>Akzentfarbe <input type="color" value={theme.accent} onChange={(e) => updateTheme({...theme, accent: e.target.value})} /></label>
              <label>Hintergrund oben <input type="color" value={theme.bgTop} onChange={(e) => updateTheme({...theme, bgTop: e.target.value})} /></label>
              <label>Hintergrund unten <input type="color" value={theme.bgBottom} onChange={(e) => updateTheme({...theme, bgBottom: e.target.value})} /></label>
            </div>
          )}
          <button className="ghost" onClick={resetTheme} style={{marginTop:"0.5rem"}}>Zur\u00fccksetzen</button>
        </section>

        <section className="card">
          <h2>\u2699\ufe0f Einkaufsliste</h2>
          <label>
            <strong>Verhalten bei doppelten Artikeln</strong>
            <select value={settings.duplicateBehavior} onChange={(e) => handleDuplicateChange(e.target.value)} disabled={saving}>
              <option value="merge">Menge erh\u00f6hen (z. B. "Eier 2x")</option>
              <option value="separate">Separate Eintr\u00e4ge anlegen</option>
            </select>
            <p className="muted" style={{marginTop:"0.3rem"}}>
              Wenn "Eier" zweimal eingegeben wird, wird bei "Menge erh\u00f6hen" die St\u00fcckzahl automatisch erh\u00f6ht.
            </p>
          </label>
        </section>

        <section className="card">
          <h2>\u2139\ufe0f \u00dcber die App</h2>
          <p className="muted">
            Family Shopping List \u2013 Version 2.0<br />
            Backend: {import.meta.env.VITE_API_URL || "http://localhost:4000/api"}<br />
            Familie: {session?.familyName || "\u2014"} (Code: {session?.familyId || "\u2014"})
          </p>
        </section>
      </div>

      <div className="dashboard-grid" style={{marginTop:"1rem"}}>
        <section className="card" style={{gridColumn:"1 / -1"}}>
          <h2>\ud83c\udfea Filialen / Standorte</h2>
          <p className="muted">Gib deine Stamm-Filialen ein \u2013 per PLZ, Ort oder direkter Filial-ID.</p>
          {branchMessage && <p className="muted" style={{color: branchMessage.includes("\u2713") ? "var(--ok)" : "var(--danger)", marginBottom:"0.5rem"}}>{branchMessage}</p>}
          <div className="branches-grid">
            {MARKETS.map((market) => {
              const branch = branches[market];
              const form = branchForms[market] || {};
              return (
                <div className="branch-card" key={market} style={{borderLeft:\4px solid \\}}>
                  <h3>{market}</h3>
                  {branch && (
                    <div className="branch-saved">
                      <p><strong>{branch.branchName}</strong></p>
                      {branch.branchZip && <span className="muted">PLZ: {branch.branchZip}</span>}
                      {branch.branchCity && <span className="muted"> \u00b7 {branch.branchCity}</span>}
                      {branch.branchId && <span className="muted"> \u00b7 ID: {branch.branchId}</span>}
                      {branch.locationUrl && <p><a href={branch.locationUrl} target="_blank" rel="noreferrer">Zur Filial-Website \u2192</a></p>}
                      <button type="button" className="danger" style={{fontSize:"0.8rem",padding:"0.25rem 0.5rem"}} onClick={() => removeBranch(market)}>Entfernen</button>
                    </div>
                  )}
                  <div className="branch-form">
                    <label>PLZ (f\u00fcr EDEKA-Vorschl\u00e4ge)
                      <input type="text" placeholder="z. B. 80331"
                        value={form.branchZip ?? branch?.branchZip ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBranchForms((prev) => ({...prev, [market]: {...prev[market], branchZip: v}}));
                          if (v.length === 5) handleBranchZipLookup(market, v);
                        }}
                      />
                    </label>
                    <label>Filialname
                      <input type="text" placeholder="z. B. EDEKA Hauptstra\u00dfe"
                        value={form.branchName ?? branch?.branchName ?? ""}
                        onChange={(e) => setBranchForms((prev) => ({...prev, [market]: {...prev[market], branchName: e.target.value}}))}
                      />
                    </label>
                    <label>Ort
                      <input type="text" placeholder="z. B. M\u00fcnchen"
                        value={form.branchCity ?? branch?.branchCity ?? ""}
                        onChange={(e) => setBranchForms((prev) => ({...prev, [market]: {...prev[market], branchCity: e.target.value}}))}
                      />
                    </label>
                    <label>Filial-ID
                      <input type="text" placeholder="z. B. 801341"
                        value={form.branchId ?? branch?.branchId ?? ""}
                        onChange={(e) => setBranchForms((prev) => ({...prev, [market]: {...prev[market], branchId: e.target.value}}))}
                      />
                    </label>
                    <label>Angebots-URL
                      <input type="text" placeholder="https://www.edeka.de/maerkte/..."
                        value={form.locationUrl ?? branch?.locationUrl ?? ""}
                        onChange={(e) => setBranchForms((prev) => ({...prev, [market]: {...prev[market], locationUrl: e.target.value}}))}
                      />
                    </label>
                    <button type="button" className="ghost" onClick={() => saveBranch(market)} style={{marginTop:"0.3rem"}}>
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

