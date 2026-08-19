import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
import { useApp, api } from "./context/AppContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const socket = io(SOCKET_URL, { autoConnect: true });

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export default function App() {
  const { session, setSession, settings, theme } = useApp();

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

  useEffect(() => {
    if (!session) return;
    socket.emit("joinFamily", { token: session.token });
    const onItemsSnapshot = (nextItems) => setItems(nextItems);
    socket.on("itemsSnapshot", onItemsSnapshot);
    return () => { socket.off("itemsSnapshot", onItemsSnapshot); };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    api(`/families/${session.familyId}/list`, {}, session.token)
      .then((data) => setItems(data.items)).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session) return;
    api(`/families/${session.familyId}/recurring`, {}, session.token)
      .then((data) => setRecurringItems(data.recurringItems || [])).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session) return;
    api(`/families/${session.familyId}/mini-lists`, {}, session.token)
      .then((data) => setMiniLists(data.miniLists || [])).catch(() => {});
  }, [session]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { mode: registerMode, username: registerUsername, password: registerPassword };
      if (registerMode === "create") body.familyName = familyName;
      if (registerMode === "join") body.familyId = registerFamilyId;
      const data = await api("/auth/register", { method: "POST", body: JSON.stringify(body) });
      setSession({ token: data.token, ...data.user });
    } catch (e) { setError(e.message); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ familyId: loginFamilyId, username: loginUsername, password: loginPassword })
      });
      setSession({ token: data.token, ...data.user });
    } catch (e) { setError(e.message); }
  };

  const handleLogout = () => {
    setSession(null);
    setItems([]); setRecipes([]); setSelectedIngredients([]); setRecurringItems([]);
  };

  const addItem = async () => {
    if (!itemName.trim() || !session) return;
    try {
      await api(`/families/${session.familyId}/items`, { method: "POST", body: JSON.stringify({ name: itemName.trim(), quantity: itemQty }) }, session.token);
      setItemName(""); setItemQty(1);
    } catch (e) { setError(e.message); }
  };

  const toggleItem = async (itemId, currentChecked) => {
    if (!session) return;
    try {
      await api(`/families/${session.familyId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ checked: !currentChecked }) }, session.token);
    } catch (e) { setError(e.message); }
  };

  const deleteItem = async (itemId) => {
    if (!session) return;
    try {
      await api(`/families/${session.familyId}/items/${itemId}`, { method: "DELETE" }, session.token);
    } catch (e) { setError(e.message); }
  };

  const searchRecipes = async () => {
    if (!recipeQuery.trim()) return;
    setLoadingRecipes(true);
    try {
      const data = await api(`/recipes/search?q=${encodeURIComponent(recipeQuery)}`);
      setRecipes(data.recipes || []);
    } catch (e) { setError(e.message); }
    setLoadingRecipes(false);
  };

  const searchByIngredients = async () => {
    if (selectedIngredients.length === 0) return;
    setLoadingRecipes(true);
    try {
      const data = await api(`/recipes/by-ingredients?ingredients=${selectedIngredients.join(",")}`);
      setRecipes(data.recipes || []);
    } catch (e) { setError(e.message); }
    setLoadingRecipes(false);
  };

  const addRecurring = async () => {
    if (!recurName.trim() || !session) return;
    try {
      await api(`/families/${session.familyId}/recurring`, { method: "POST", body: JSON.stringify({ name: recurName.trim(), quantity: recurQty, dayOfWeek: recurDay }) }, session.token);
      setRecurName(""); setRecurQty(1);
      const data = await api(`/families/${session.familyId}/recurring`, {}, session.token);
      setRecurringItems(data.recurringItems || []);
    } catch (e) { setError(e.message); }
  };

  const deleteRecurring = async (itemId) => {
    if (!session) return;
    try {
      await api(`/families/${session.familyId}/recurring/${itemId}`, { method: "DELETE" }, session.token);
      setRecurringItems((prev) => prev.filter((r) => r.id !== itemId));
    } catch (e) { setError(e.message); }
  };

  const saveMiniList = async () => {
    if (!miniListName.trim() || miniListItems.length === 0 || !session) return;
    try {
      await api(`/families/${session.familyId}/mini-lists`, { method: "POST", body: JSON.stringify({ name: miniListName.trim(), items: miniListItems }) }, session.token);
      setMiniListName(""); setMiniListItems([]); setShowMiniListEditor(false);
      const data = await api(`/families/${session.familyId}/mini-lists`, {}, session.token);
      setMiniLists(data.miniLists || []);
    } catch (e) { setError(e.message); }
  };

  const deleteMiniList = async (listId) => {
    if (!session) return;
    try {
      await api(`/families/${session.familyId}/mini-lists/${listId}`, { method: "DELETE" }, session.token);
      setMiniLists((prev) => prev.filter((ml) => ml.id !== listId));
    } catch (e) { setError(e.message); }
  };

  const addMiniListToShopping = async (miniList) => {
    if (!session) return;
    for (const item of miniList.items) {
      try {
        await api(`/families/${session.familyId}/items`, { method: "POST", body: JSON.stringify({ name: item.name, quantity: item.quantity }) }, session.token);
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
        {registerMode === "create" && <label>Familienname <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required /></label>}
        {registerMode === "join" && <label>Familien-Code <input type="text" value={registerFamilyId} onChange={(e) => setRegisterFamilyId(e.target.value)} required /></label>}
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
      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/">\ud83d\uded2 Einkaufsliste</Link>
        </div>
        <div className="navbar-links">
          {session && (
            <>
              <Link to="/settings" className="nav-link">\u2699\ufe0f Einstellungen</Link>
              <Link to="/offers" className="nav-link">\ud83c\udfea Angebote</Link>
              <button type="button" className="danger nav-btn" onClick={handleLogout}>Abmelden</button>
            </>
          )}
        </div>
      </nav>
      <div className="page-shell">
        {!session ? (
          <>
            <header className="hero">
              <p className="eyebrow">Family Sync</p>
              <h1>Gemeinsame Einkaufsliste in Echtzeit</h1>
              <p>Teile einen Familien-Code, hake Produkte live ab und entdecke passende Rezepte.</p>
            </header>
            {error && <div className="error-banner">{error}</div>}
            <div className="auth-grid">{renderAuth()}</div>
          </>
        ) : (
          <>
            <header className="hero">
              <p className="eyebrow">Family Sync</p>
              <h1>Gemeinsame Einkaufsliste</h1>
              <p className="muted" style={{color:"#cde3e3",marginTop:"0.4rem"}}>Familie: {session.familyName} \u00b7 Code: {session.familyId}</p>
              <div style={{display:"flex",gap:"0.5rem",marginTop:"0.6rem"}}>
                <Link to="/settings" className="btn-inline">\u2699\ufe0f Einstellungen</Link>
                <Link to="/offers" className="btn-inline">\ud83c\udfea Angebote</Link>
              </div>
            </header>
            {error && <div className="error-banner">{error}</div>}

            <div className="dashboard-grid">
              <section className="card">
                <h2>Einkaufsliste</h2>
                <div className="family-chip">
                  <span className="muted">Menge erh\u00f6hen: {settings.duplicateBehavior === "merge" ? "\u2705 An" : "\u274c Aus"}</span>
                  <Link to="/settings">Einstellungen</Link>
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
                <h2>\ud83d\udccb Mini-Listen</h2>
                <div className="add-form" style={{gridTemplateColumns:"1fr auto"}}>
                  <input type="text" placeholder="Listenname" value={miniListName} onChange={(e) => setMiniListName(e.target.value)} />
                  <button type="button" onClick={() => setShowMiniListEditor(true)}>+ Neu</button>
                </div>
                {showMiniListEditor && (
                  <div className="mini-form">
                    <input type="text" placeholder="Zutat (Enter)" value={miniListItemInput} onChange={(e) => setMiniListItemInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && miniListItemInput.trim()) { setMiniListItems([...miniListItems, {name: miniListItemInput.trim(), quantity: 1}]); setMiniListItemInput(""); }}} />
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
                  <input type="text" placeholder="Suchbegriff" value={recipeQuery} onChange={(e) => setRecipeQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchRecipes()} />
                  <button type="button" onClick={searchRecipes} disabled={loadingRecipes}>{loadingRecipes ? "Suche..." : "Suchen"}</button>
                </div>
                {recipes.length > 0 && (
                  <ul className="list">{recipes.map((r, i) => <li key={i}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></li>)}</ul>
                )}
                <p className="muted" style={{marginTop:"0.5rem"}}>Oder nach Zutaten:</p>
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
    </div>
  );
}

