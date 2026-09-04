import { useEffect, useRef, useState } from "react";
import { useApp, api } from "../context/AppContext";
import NavBar from "../components/NavBar";

/** Skaliert eine Menge um einen Faktor (Integer, Bruch oder Zahl+Einheit). */
function scaleAmount(line, factor) {
  const m = String(line || "").match(/^([\d.,/]+)\s*(.*)$/);
  if (!m) return line;
  const numText = m[1];
  const unit = m[2];
  let value;
  if (numText.includes("/")) {
    const [a, b] = numText.split("/");
    value = (Number(a.replace(",", ".")) || 0) / (Number(b.replace(",", ".")) || 1);
  } else {
    value = Number(numText.replace(",", ".")) || 0;
  }
  const scaled = value * factor;
  const rounded = Math.round(scaled * 100) / 100;
  return `${formatNum(rounded)}${unit ? " " + unit : ""}`;
}

function formatNum(n) {
  const s = Math.round(n * 1000) / 1000;
  return Number.isInteger(s) ? String(s) : (Math.round(s * 100) / 100).toString().replace(".", ",");
}

export default function RecipesPage() {
  const { session, settings, t, setSession } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saved, setSaved] = useState([]);
  const [error, setError] = useState("");
  const [displayOn, setDisplayOn] = useState({});
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef(null);

  const toggleWakeLock = async () => {
    if (wakeLockActive) {
      try { wakeLockRef.current?.release(); } catch {}
      wakeLockRef.current = null;
      setWakeLockActive(false);
      return;
    }
    try {
      if ("wakeLock" in navigator) {
        const lock = await navigator.wakeLock.request("screen");
        wakeLockRef.current = lock;
        setWakeLockActive(true);
      } else {
        setError("Screen Wake Lock wird von diesem Browser nicht unterstützt.");
      }
    } catch (e) { setError("WakeLock fehlgeschlagen: " + e.message); }
  };

  const fam = session?.familyId;

  useEffect(() => {
    if (!fam) return;
    api(`/families/${fam}/recipes`, {}, session.token)
      .then((d) => setSaved(d.recipes || []))
      .catch(() => {});
  }, [fam, session]);

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true); setError("");
    try {
      const d = await api(`/recipes/search?q=${encodeURIComponent(q.trim())}`);
      setResults(d.recipes || []);
    } catch (e) { setError(e.message); }
    setSearching(false);
  };

  const openDetail = async (recipe) => {
    setError("");
    try {
      const d = await api(`/recipes/detail?url=${encodeURIComponent(recipe.url)}`);
      setDetail({ ...d, url: recipe.url });
    } catch (e) {
      // Detail nicht abrufbar (z.B. abgelaufenes/404-Rezept): trotzdem als Link anbieten
      setDetail({ title: recipe.title, url: recipe.url, ingredients: [], servings: 4, fallback: true });
      setError("Rezeptdetails konnten nicht geladen werden – der Link zu Chefkoch steht unten bereit.");
    }
  };

  const saveRecipe = async () => {
    if (!detail || !fam) return;
    try {
      const d = await api(`/families/${fam}/recipes`, {
        method: "POST",
        body: JSON.stringify({ title: detail.title, image: detail.image, url: detail.url, servings: detail.servings, ingredients: detail.ingredients, instructions: detail.instructions })
      }, session.token);
      setSaved((prev) => [d.recipe, ...prev]);
    } catch (e) { setError(e.message); }
  };

  const updateSaved = async (id, patch) => {
    try {
      const d = await api(`/families/${fam}/recipes/${id}`, {
        method: "PATCH", body: JSON.stringify(patch)
      }, session.token);
      setSaved((prev) => prev.map((r) => (r.id === id ? d.recipe : r)));
    } catch (e) { setError(e.message); }
  };

  const deleteSaved = async (id) => {
    try {
      await api(`/families/${fam}/recipes/${id}`, { method: "DELETE" }, session.token);
      setSaved((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { setError(e.message); }
  };

  const renameRecipe = (r) => {
    const name = prompt("Neuen Namen eingeben:", r.title);
    if (name && name.trim()) updateSaved(r.id, { title: name.trim() });
  };

  const addIngredient = (r) => {
    const name = prompt("Zutat hinzufügen:", "");
    if (name && name.trim()) updateSaved(r.id, { ingredients: [...r.ingredients, name.trim()] });
  };

  const removeIngredient = (r, idx) => {
    updateSaved(r.id, { ingredients: r.ingredients.filter((_, i) => i !== idx) });
  };

  const setServings = (r, n) => {
    const v = Math.max(1, Number(n) || 1);
    // Zielwert nur im UI-State setzen; die Original-Portionen (Basis) bleiben unverändert.
    setSaved((prev) => prev.map((r2) => (r2.id === r.id ? { ...r2, targetServings: v } : r2)));
  };

  const scaledIngredients = (r, n) => {
    const base = Number(r.servings) || 4;
    const target = Number(n) || Number(r.targetServings) || base;
    const factor = target / base;
    return (r.ingredients || []).map((ing) => ({ original: ing, scaled: scaleAmount(ing, factor) }));
  };

  const addToShopping = async (r, n) => {
    if (!fam) return;
    const base = Number(r.servings) || 4;
    const target = Number(n) || Number(r.targetServings) || base;
    const factor = target / base;
    for (const ing of r.ingredients) {
      const scaled = scaleAmount(ing, factor);
      try {
        await api(`/families/${fam}/items`, { method: "POST", body: JSON.stringify({ name: scaled, quantity: 1 }) }, session.token);
      } catch (e) { setError(e.message); }
    }
  };

  const addToRecurring = async (r) => {
    if (!fam) return;
    for (const ing of r.ingredients) {
      try {
        await api(`/families/${fam}/recurring`, { method: "POST", body: JSON.stringify({ name: ing, quantity: 1, dayOfWeek: 1 }) }, session.token);
      } catch (e) { setError(e.message); }
    }
  };

  return (
    <div className="page-shell">
      <NavBar session={session} onLogout={() => { if (typeof window !== "undefined") { localStorage.removeItem("shopping_session"); window.location.href = "/"; } setSession(null); }} />
      <header className="hero">
        <p className="eyebrow">Chefkoch · Rezepte</p>
        <h1>🍳 {t("nav.recipes")}</h1>
        <p className="muted" style={{ color: "#cde3e3" }}>Rezepte suchen, speichern und in die Einkaufsliste übernehmen.</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="dashboard-grid" style={{ marginTop: "1.4rem" }}>
        <section className="card">
          <h2>🔍 Suche</h2>
          <div className="recipe-form">
            <input type="text" placeholder="Suchbegriff (z.B. Nudeln)" value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()} />
            <button type="button" onClick={search} disabled={searching}>{searching ? "..." : "Suchen"}</button>
          </div>
          {results.length > 0 && (
            <ul className="list" style={{ marginTop: "0.8rem" }}>
              {results.map((r, i) => (
                <li key={i}>
                  <button type="button" className="ghost" style={{ textAlign: "left" }} onClick={() => openDetail(r)}>👁️ {r.title}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {detail && (
          <section className="card">
            <h2>{detail.title}</h2>
            {detail.image && <img src={detail.image} alt={detail.title} style={{ width: "100%", maxHeight: "260px", objectFit: "cover", borderRadius: "10px" }} />}
            <p className="muted">Portionen: {detail.servings} · Zutaten: {detail.ingredients.length}</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={saveRecipe} disabled={detail.fallback}>💾 Speichern</button>
            </div>
            {(detail.ingredients?.length > 0 || detail.instructions?.length > 0) ? (
              <div style={{ marginTop: "0.6rem" }}>
                {detail.ingredients?.length > 0 && (
                  <div>
                    <h3 className="done-title" style={{ marginTop: "0.4rem" }}>📋 Zutaten</h3>
                    <ul className="list">
                      {detail.ingredients.map((ing, i) => <li key={i}><span>{ing}</span></li>)}
                    </ul>
                  </div>
                )}
                {detail.instructions?.length > 0 && (
                  <div>
                    <h3 className="done-title" style={{ marginTop: "0.5rem" }}>👨‍🍳 Anleitung</h3>
                    <ol className="list" style={{ paddingLeft: "1.1rem" }}>
                      {detail.instructions.map((st, i) => <li key={i}>{st}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              !detail.fallback && <p className="muted" style={{ marginTop: "0.4rem" }}>Keine Zutaten/Anleitung extrahierbar.</p>
            )}
            <p style={{ marginTop: "0.7rem" }}>
              <a href={detail.url} target="_blank" rel="noreferrer" className="btn-inline">🔗 Auf Chefkoch öffnen</a>
              <button type="button" className="btn-inline" style={{ marginLeft: "0.4rem", background: wakeLockActive ? "rgba(42,157,143,0.9)" : "rgba(255,255,255,0.2)" }}
                onClick={toggleWakeLock}>
                {wakeLockActive ? "⏳ Display an (aktiv)" : "⏳ Display an lassen"}
              </button>
            </p>
          </section>
        )}
      </div>

      <div className="dashboard-grid" style={{ marginTop: "1.4rem" }}>
        <section className="card" style={{ gridColumn: "1 / -1" }}>
          <h2>📚 Gespeicherte Rezepte</h2>
          {saved.length === 0 && <p className="muted">Noch keine Rezepte gespeichert.</p>}
          <div style={{ display: "grid", gap: "0.7rem" }}>
            {saved.map((r) => {
              const on = displayOn[r.id];
              const target = r.targetServings || r.servings;
              return (
                <div key={r.id} className="list" style={{ padding: "0.9rem", border: "1px solid #d8e3ea", borderRadius: "12px", display: "grid", gap: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem" }}>
                    <strong>{r.title}</strong>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <button type="button" className="ghost" onClick={() => renameRecipe(r)}>✏️</button>
                      <button type="button" className="ghost" onClick={() => addIngredient(r)}>+ Zutat</button>
                      <button type="button" className="danger" onClick={() => deleteSaved(r.id)}>🗑️</button>
                    </div>
                  </div>
                  {r.image && <img src={r.image} alt={r.title} style={{ width: "100%", maxHeight: "180px", objectFit: "cover", borderRadius: "10px" }} />}
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem", flexWrap: "wrap" }}>
                    Portionen:
                    <input type="number" min={1} value={target} style={{ width: "80px" }}
                      onChange={(e) => setServings(r, e.target.value)} />
                    <button type="button" className="ghost" onClick={() => setDisplayOn((p) => ({ ...p, [r.id]: !on }))}>
                      {on ? "Display aus" : "Display an"}
                    </button>
                  </label>
                  {on && (
                    <ul className="list">
                      {scaledIngredients(r, target).map((it, idx) => (
                        <li key={idx} style={{ alignItems: "center", gap: "0.4rem" }}>
                          <span>{it.scaled}</span>
                          <button type="button" className="danger" onClick={() => removeIngredient(r, idx)}>✕</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => addToShopping(r, target)}>🛒 Zur Einkaufsliste</button>
                    <button type="button" className="ghost" onClick={() => addToRecurring(r)}>🔄 Wiederkehrend</button>
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