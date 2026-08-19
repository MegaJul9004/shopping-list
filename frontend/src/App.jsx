import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Routes, Route, useNavigate } from "react-router-dom";
import { AppProvider, api, useApp } from "./context/AppContext";
import NavBar from "./components/NavBar";
import SettingsPage from "./pages/SettingsPage";
import OffersPage from "./pages/OffersPage";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

const socket = io(SOCKET_URL, { autoConnect: true });

const DEFAULT_THEME = {
  primary: "#0d6e6e",
  accent: "#ef8354",
  bgTop: "#f9f3e7",
  bgBottom: "#e2f3ff"
};

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function loadTheme() {
  try {
    const raw = localStorage.getItem("shoppingTheme");
    return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

async function apiRequest(path, options = {}, token) {
  const extraHeaders = token ? { Authorization: \Bearer \\ } : {};
  const response = await fetch(\\\D:\VS Code\shopping-list\shopping-list\frontend\src\App.jsx\, {
    headers: { "Content-Type": "application/json", ...extraHeaders },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "API request failed");
  return data;
}

export default function AppShell() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

function AppContent() {
  const { session, setSession, settings } = useApp();
  const navigate = useNavigate();
  const [registerMode, setRegisterMode] = useState("create");
  const [familyName, setFamilyName] = useState("");
  const [registerFamilyId, setRegisterFamilyId] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [loginFamilyId, setLoginFamilyId] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [ingredientInput, setIngredientInput] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(loadTheme);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [recurringItems, setRecurringItems] = useState([]);
  const [recurName, setRecurName] = useState("");
  const [recurQty, setRecurQty] = useState(1);
  const [recurDay, setRecurDay] = useState(1);
  const [miniLists, setMiniLists] = useState([]);
  const [miniListName, setMiniListName] = useState("");
  const [showMiniListEditor, setShowMiniListEditor] = useState(false);
  const [miniListItemInput, setMiniListItemInput] = useState("");
  const [miniListItems, setMiniListItems] = useState([]);
  // Socket.IO items sync
  useEffect(() => {
    if (!session) return;
    socket.emit("joinFamily", { token: session.token });
    const onItemsSnapshot = (nextItems) => setItems(nextItems);
    socket.on("itemsSnapshot", onItemsSnapshot);
    return () => { socket.off("itemsSnapshot", onItemsSnapshot); };
  }, [session]);

  // Load items from REST
  useEffect(() => {
    if (!session) return;
    apiRequest(\/families/\/list\, {}, session.token)
      .then((data) => setItems(data.items))
      .catch(() => {});
  }, [session]);

  // Load recurring items
  useEffect(() => {
    if (!session) return;
    apiRequest(\/families/\/recurring\, {}, session.token)
      .then((data) => setRecurringItems(data.recurringItems || []))
      .catch(() => {});
  }, [session]);

  // Load mini lists
  useEffect(() => {
    if (!session) return;
    apiRequest(\/families/\/mini-lists\, {}, session.token)
      .then((data) => setMiniLists(data.miniLists || []))
      .catch(() => {});
  }, [session]);

  // Theme CSS
  useEffect(() => {
    document.documentElement.style.setProperty("--brand", theme.primary);
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty("--bg-top", theme.bgTop);
    document.documentElement.style.setProperty("--bg-bottom", theme.bgBottom);
  }, [theme]);

  const updateThemeField = (field, value) => {
    const next = { ...theme, [field]: value };
    setTheme(next);
    localStorage.setItem("shoppingTheme", JSON.stringify(next));
  };

  const resetTheme = () => {
    setTheme({ ...DEFAULT_THEME });
    localStorage.setItem("shoppingTheme", JSON.stringify(DEFAULT_THEME));
  };
  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const body = {
        mode: registerMode,
        familyName: registerMode === "create" ? familyName : undefined,
        familyId: registerMode === "join" ? registerFamilyId : undefined,
        username: registerUsername,
        password: registerPassword
      };
      const data = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(body)
      });
      setSession({ token: data.token, ...data.user });
    } catch (e) { setError(e.message); }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          familyId: loginFamilyId,
          username: loginUsername,
          password: loginPassword
        })
      });
      setSession({ token: data.token, ...data.user });
    } catch (e) { setError(e.message); }
  };

  const handleLogout = () => {
    setSession(null);
    setItems([]);
    setRecipes([]);
    setSelectedIngredients([]);
    setRecurringItems([]);
  };

  const addItem = async () => {
    if (!itemName.trim() || !session) return;
    try {
      await apiRequest(\/families/\/items\, {
        method: "POST",
        body: JSON.stringify({ name: itemName.trim(), quantity: itemQty })
      }, session.token);
      setItemName("");
      setItemQty(1);
    } catch (e) { setError(e.message); }
  };

  const toggleItem = async (itemId, currentChecked) => {
    if (!session) return;
    try {
      await apiRequest(\/families/\/items/\\, {
        method: "PATCH",
        body: JSON.stringify({ checked: !currentChecked })
      }, session.token);
    } catch (e) { setError(e.message); }
  };

  const deleteItem = async (itemId) => {
    if (!session) return;
    try {
      await apiRequest(\/families/\/items/\\, {
        method: "DELETE"
      }, session.token);
    } catch (e) { setError(e.message); }
  };

  const searchRecipes = async () => {
    if (!recipeQuery.trim()) return;
    setLoadingRecipes(true);
    try {
      const data = await apiRequest(\/recipes/search?q=\\);
      setRecipes(data.recipes || []);
    } catch (e) { setError(e.message); }
    setLoadingRecipes(false);
  };

  const searchByIngredients = async () => {
    if (selectedIngredients.length === 0) return;
    setLoadingRecipes(true);
    try {
      const data = await apiRequest(\/recipes/by-ingredients?ingredients=\\);
      setRecipes(data.recipes || []);
    } catch (e) { setError(e.message); }
    setLoadingRecipes(false);
  };

  const addRecurring = async () => {
    if (!recurName.trim() || !session) return;
    try {
      await apiRequest(\/families/\/recurring\, {
        method: "POST",
        body: JSON.stringify({ name: recurName.trim(), quantity: recurQty, dayOfWeek: recurDay })
      }, session.token);
      setRecurName("");
      setRecurQty(1);
      const data = await apiRequest(\/families/\/recurring\, {}, session.token);
      setRecurringItems(data.recurringItems || []);
    } catch (e) { setError(e.message); }
  };

  const deleteRecurring = async (itemId) => {
    if (!session) return;
    try {
      await apiRequest(\/families/\/recurring/\\, { method: "DELETE" }, session.token);
      setRecurringItems((prev) => prev.filter((r) => r.id !== itemId));
    } catch (e) { setError(e.message); }
  };
  const saveMiniList = async () => {
    if (!miniListName.trim() || miniListItems.length === 0 || !session) return;
    try {
      await apiRequest(\/families/\/mini-lists\, {
        method: "POST",
        body: JSON.stringify({ name: miniListName.trim(), items: miniListItems })
      }, session.token);
      setMiniListName("");
      setMiniListItems([]);
      setShowMiniListEditor(false);
      const data = await apiRequest(\/families/\/mini-lists\, {}, session.token);
      setMiniLists(data.miniLists || []);
    } catch (e) { setError(e.message); }
  };

  const deleteMiniList = async (listId) => {
    if (!session) return;
    try {
      await apiRequest(\/families/\/mini-lists/\\, { method: "DELETE" }, session.token);
      setMiniLists((prev) => prev.filter((ml) => ml.id !== listId));
    } catch (e) { setError(e.message); }
  };

  const addMiniListToShopping = async (miniList) => {
    if (!session) return;
    for (const item of miniList.items) {
      try {
        await apiRequest(\/families/\/items\, {
          method: "POST",
          body: JSON.stringify({ name: item.name, quantity: item.quantity })
        }, session.token);
      } catch (e) { setError(e.message); }
    }
  };

  const renderAuth = () => (
    <section className="card">
      <h2>{registerMode === "create" ? "Neue Familie erstellen" : "Familie beitreten"}</h2>
      <div className="switch-row">
        <button type="button" className={registerMode === "create" ? "tab active" : "tab"} onClick={() => { setRegisterMode("create"); setError(""); }}>Erstellen</button>
        <button type="button" className={registerMode === "join" ? "tab active" : "tab"} onClick={() => { setRegisterMode("join"); setError(""); }}>Beitreten</button>
      </div>
      <form onSubmit={handleRegister}>
        {registerMode === "create" && (
          <label>Familienname <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required /></label>
        )}
        {registerMode === "join" && (
          <label>Familien-Code <input type="text" value={registerFamilyId} onChange={(e) => setRegisterFamilyId(e.target.value)} required /></label>
        )}
        <label>Benutzername <input type="text" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} required /></label>
        <label>Passwort <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required minLength={6} /></label>
        <button type="submit">Registrieren</button>
      </form>

      <hr style={{ margin: "1rem 0" }} />

      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <label>Familien-Code <input type="text" value={loginFamilyId} onChange={(e) => setLoginFamilyId(e.target.value)} required /></label>
        <label>Benutzername <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required /></label>
        <label>Passwort <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required /></label>
        <button type="submit">Anmelden</button>
      </form>
    </section>
  );
  return (
    <div>
      <NavBar
        theme={theme}
        onThemeToggle={() => setShowThemePicker(!showThemePicker)}
        session={session}
        onLogout={handleLogout}
      />
      <Routes>
        <Route path="/" element={
          <div className="page-shell">
            {!session ? (
              <>
                <header className="hero">
                  <p className="eyebrow">Family Sync</p>
                  <h1>Gemeinsame Einkaufsliste in Echtzeit</h1>
                  <p>Teile einen Familien-Code, hake Produkte live ab und entdecke passende Rezepte direkt aus dem Chefkoch-Bereich.</p>
                </header>
                {error && <div className="error-banner">{error}</div>}
                <div className="auth-grid">{renderAuth()}</div>
              </>
            ) : (
              <>
                <header className="hero">
                  <p className="eyebrow">Family Sync</p>
                  <h1>Gemeinsame Einkaufsliste</h1>
                  <p className="muted" style={{color:"#cde3e3",marginTop:"0.4rem"}}>Familie: {session.familyName} · Code: {session.familyId}</p>
                </header>
                {error && <div className="error-banner">{error}</div>}

                {showThemePicker && (
                  <div className="card theme-picker">
                    <h2>Farbschema anpassen</h2>
                    <div className="theme-grid">
                      <label>Prim\u00e4rfarbe <input type="color" value={theme.primary} onChange={(e) => updateThemeField("primary", e.target.value)} /></label>
                      <label>Akzentfarbe <input type="color" value={theme.accent} onChange={(e) => updateThemeField("accent", e.target.value)} /></label>
                      <label>Hintergrund oben <input type="color" value={theme.bgTop} onChange={(e) => updateThemeField("bgTop", e.target.value)} /></label>
                      <label>Hintergrund unten <input type="color" value={theme.bgBottom} onChange={(e) => updateThemeField("bgBottom", e.target.value)} /></label>
                    </div>
                    <button className="ghost" onClick={resetTheme}>Zur\u00fccksetzen</button>
                  </div>
                )}

                <div className="dashboard-grid">
                  <section className="card">
                    <h2>Einkaufsliste</h2>
                    <div className="family-chip">
                      <span className="muted">Menge erh\u00f6hen: {settings.duplicateBehavior === "merge" ? "\u2705 An" : "\u274c Aus"}</span>
                      <button className="ghost" onClick={() => navigate("/settings")}>Einstellungen</button>
                      <button className="ghost" onClick={() => navigate("/offers")}>Angebote</button>
                    </div>
                    <div className="add-form">
                      <input type="text" placeholder="Artikel eingeben" value={itemName} onChange={(e) => setItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
                      <input type="number" min={1} value={itemQty} onChange={(e) => setItemQty(Math.max(1, Number(e.target.value)))} />
                      <button type="button" onClick={addItem}>Hinzuf\u00fcgen</button>
                    </div>
                    <ul className="list">
                      {items.map((item) => (
                        <li key={item.id} className={item.checked ? "checked" : ""}>
                          <label className="item-row">
                            <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.id, item.checked)} />
                            <span className="item-name">{item.name}</span>
                            <span className="item-qty">{item.quantity}x</span>
                          </label>
                          <div className="item-actions">
                            <button className="ghost" onClick={() => { setItemName(item.name); setItemQty(item.quantity); deleteItem(item.id); }}>Bearbeiten</button>
                            <button className="danger" onClick={() => deleteItem(item.id)}>L\u00f6schen</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="card">
                    <h2>\ud83d\udccb Mini-Listen / Rezepte</h2>
                    <div className="add-form" style={{gridTemplateColumns:"1fr auto"}}>
                      <input type="text" placeholder="Listenname" value={miniListName} onChange={(e) => setMiniListName(e.target.value)} />
                      <button type="button" onClick={() => setShowMiniListEditor(true)}>+ Neu</button>
                    </div>
                    {showMiniListEditor && (
                      <div className="mini-form">
                        <input type="text" placeholder="Zutat eingeben (Enter)" value={miniListItemInput} onChange={(e) => setMiniListItemInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && miniListItemInput.trim()) { setMiniListItems([...miniListItems, {name: miniListItemInput.trim(), quantity: 1}]); setMiniListItemInput(""); }}} />
                        <ul className="recurring-list" style={{margin:"0.4rem 0"}}>
                          {miniListItems.map((mi, idx) => (
                            <li key={idx}><span>{mi.name} ({mi.quantity}x)</span><button className="danger" onClick={() => setMiniListItems(miniListItems.filter((_, i) => i !== idx))}>\u2715</button></li>
                          ))}
                        </ul>
                        <div className="switch-row">
                          <button onClick={saveMiniList}>Speichern</button>
                          <button className="ghost" onClick={() => { setShowMiniListEditor(false); setMiniListItems([]); }}>Abbrechen</button>
                        </div>
                      </div>
                    )}
                    {miniLists.length > 0 && (
                      <ul className="recurring-list">
                        {miniLists.map((ml) => (
                          <li key={ml.id}>
                            <div><strong>{ml.name}</strong><p className="muted">{ml.items.length} Zutaten</p></div>
                            <div className="item-actions">
                              <button onClick={() => addMiniListToShopping(ml)}>+ Zur Liste</button>
                              <button className="danger" onClick={() => deleteMiniList(ml.id)}>\u2715</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                <div className="dashboard-grid wide" style={{marginTop:"1rem"}}>
                  <section className="card">
                    <h2>\ud83d\udd04 Wiederkehrende Artikel</h2>
                    <div className="recurring-form">
                      <input type="text" placeholder="Artikel" value={recurName} onChange={(e) => setRecurName(e.target.value)} />
                      <input type="number" min={1} value={recurQty} onChange={(e) => setRecurQty(Math.max(1, Number(e.target.value)))} />
                      <select value={recurDay} onChange={(e) => setRecurDay(Number(e.target.value))}>
                        {DAY_NAMES.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
                      </select>
                      <button type="button" onClick={addRecurring}>+ Hinzuf\u00fcgen</button>
                    </div>
                    {recurringItems.length > 0 && (
                      <ul className="recurring-list">
                        {recurringItems.map((ritem) => (
                          <li key={ritem.id}><span>{ritem.name} ({ritem.quantity}x) - <span className="muted">{DAY_NAMES[ritem.dayOfWeek]}</span></span><button className="danger" onClick={() => deleteRecurring(ritem.id)}>\u2715</button></li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="card">
                    <h2>\ud83c\udf73 Rezepte finden</h2>
                    <div className="recipe-form">
                      <input type="text" placeholder="Suchbegriff (z. B. H\u00e4hnchen)" value={recipeQuery} onChange={(e) => setRecipeQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchRecipes()} />
                      <button type="button" onClick={searchRecipes} disabled={loadingRecipes}>{loadingRecipes ? "Suche..." : "Suchen"}</button>
                    </div>
                    {recipes.length > 0 && (
                      <ul className="list">{recipes.map((r, i) => <li key={i}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></li>)}</ul>
                    )}
                    <p className="muted" style={{marginTop:"0.5rem"}}>Oder suche nach Zutaten:</p>
                    <div className="recipe-filters">
                      <input type="text" placeholder="Zutat (Enter)" value={ingredientInput} onChange={(e) => setIngredientInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ingredientInput.trim()) { setSelectedIngredients([...selectedIngredients, ingredientInput.trim()]); setIngredientInput(""); }}} />
                      <button type="button" onClick={searchByIngredients} disabled={selectedIngredients.length === 0 || loadingRecipes}>{loadingRecipes ? "Suche..." : "Rezepte finden"}</button>
                    </div>
                    <div className="family-chip">
                      {selectedIngredients.map((ing, idx) => (
                        <span key={idx} className="tag">{ing}<button className="danger" onClick={() => setSelectedIngredients(selectedIngredients.filter((_, i) => i !== idx))}>\u2715</button></span>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        } />
        <Route path="/settings" element={<SettingsPage theme={theme} setTheme={setTheme} session={session} />} />
        <Route path="/offers" element={<OffersPage session={session} theme={theme} />} />
      </Routes>
    </div>
  );
}
