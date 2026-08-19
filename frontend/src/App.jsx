import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

const socket = io(SOCKET_URL, {
  autoConnect: true
});

// ── Farb-Theme ───────────────────────────────────────────────────────
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

async function api(path, options = {}, token) {
  const extraHeaders = token
    ? {
        Authorization: `Bearer ${token}`
      }
    : {};

  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...extraHeaders },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data;
}

export default function App() {
  const [registerMode, setRegisterMode] = useState("create");
  const [familyName, setFamilyName] = useState("");
  const [registerFamilyId, setRegisterFamilyId] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [loginFamilyId, setLoginFamilyId] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("authSession");
    return raw ? JSON.parse(raw) : null;
  });
  const [items, setItems] = useState([]);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [selectedMarkets, setSelectedMarkets] = useState(["LIDL", "ALDI"]);
  const [offersResult, setOffersResult] = useState(null);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [liveMarketView, setLiveMarketView] = useState("ALL");
  const [liveOffers, setLiveOffers] = useState([]);
  const [liveOffersHasMore, setLiveOffersHasMore] = useState(false);
  const [liveOffersOffset, setLiveOffersOffset] = useState(0);
  const [loadingLiveOffers, setLoadingLiveOffers] = useState(false);
  const [error, setError] = useState("");

  // ── Theme state ──────────────────────────────────────────────────
  const [theme, setTheme] = useState(loadTheme);
  const [showThemePicker, setShowThemePicker] = useState(false);

  // ── Recurring items state ────────────────────────────────────────
  const [recurringItems, setRecurringItems] = useState([]);
  const [recurName, setRecurName] = useState("");
  const [recurQty, setRecurQty] = useState(1);
  const [recurDay, setRecurDay] = useState(1); // default Montag

  // ── Market locations state ───────────────────────────────────────
  const [marketLocations, setMarketLocations] = useState({});
  const [familyLocations, setFamilyLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState({});

  // ── Recipe filter state ──────────────────────────────────────────
  const [recipeDifficulty, setRecipeDifficulty] = useState("");
  const [recipeMaxPrep, setRecipeMaxPrep] = useState("");

  const isLoggedIn = Boolean(session?.token);

  // ── Apply theme to CSS variables ──────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", theme.primary);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--bg-top", theme.bgTop);
    root.style.setProperty("--bg-bottom", theme.bgBottom);
  }, [theme]);

  useEffect(() => {
    const onItemsSnapshot = (nextItems) => setItems(nextItems);
    socket.on("itemsSnapshot", onItemsSnapshot);
    return () => {
      socket.off("itemsSnapshot", onItemsSnapshot);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    socket.emit("joinFamily", { token: session.token });

    api("/auth/me", {}, session.token)
      .then((data) => {
        setSession((prev) => ({ ...prev, user: data.user }));
        return api(`/families/${data.user.familyId}/list`, {}, session.token);
      })
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, [isLoggedIn, session?.token]);

  useEffect(() => {
    if (session) {
      localStorage.setItem("authSession", JSON.stringify(session));
    }
  }, [session]);

  // ── Load recurring items & locations when logged in ──────────────
  useEffect(() => {
    if (!isLoggedIn) return;

    const familyId = session.user.familyId;

    api(`/families/${familyId}/recurring`, {}, session.token)
      .then((data) => setRecurringItems(data.recurringItems || []))
      .catch(() => {});

    api(`/families/${familyId}/locations`, {}, session.token)
      .then((data) => {
        setFamilyLocations(data.locations || []);
        const locMap = {};
        for (const loc of data.locations || []) {
          locMap[loc.market] = loc.locationName;
        }
        setSelectedLocation(locMap);
      })
      .catch(() => {});

    api("/offers/locations")
      .then((data) => setMarketLocations(data.locations || {}))
      .catch(() => {});
  }, [isLoggedIn, session?.token]);

  useEffect(() => {
    api("/offers/markets")
      .then((data) => setAvailableMarkets(data.markets || []))
      .catch(() => setAvailableMarkets(["LIDL", "EDEKA", "ALDI", "REWE"]));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    loadLiveOffers(true);
  }, [isLoggedIn, liveMarketView]);

  const checkedCount = useMemo(
    () => items.filter((item) => item.checked).length,
    [items]
  );

  // ── Theme helpers ─────────────────────────────────────────────────
  const saveTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("shoppingTheme", JSON.stringify(newTheme));
  };

  const register = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const payload = {
        mode: registerMode,
        familyName,
        familyId: registerFamilyId.toUpperCase(),
        username: registerUsername,
        password: registerPassword
      };

      const data = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setSession({
        token: data.token,
        user: data.user
      });

      setLoginFamilyId(data.user.familyId);
      setLoginUsername(data.user.username);
      setLoginPassword("");
    } catch (err) {
      setError(err.message);
    }
  };

  const login = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          familyId: loginFamilyId.toUpperCase(),
          username: loginUsername,
          password: loginPassword
        })
      });
      setSession({
        token: data.token,
        user: data.user
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const addListItem = async (event) => {
    event.preventDefault();
    if (!itemName.trim()) {
      return;
    }

    setError("");
    try {
      await api(
        `/families/${session.user.familyId}/items`,
        {
        method: "POST",
        body: JSON.stringify({
          name: itemName.trim(),
          quantity: Number(itemQty) || 1
        })
        },
        session.token
      );
      setItemName("");
      setItemQty(1);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleChecked = async (item) => {
    try {
      await api(
        `/families/${session.user.familyId}/items/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ checked: !item.checked })
        },
        session.token
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await api(
        `/families/${session.user.familyId}/items/${itemId}`,
        {
          method: "DELETE"
        },
        session.token
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const searchRecipes = async (event) => {
    event.preventDefault();
    const query = recipeQuery.trim();
    if (!query) {
      return;
    }

    setLoadingRecipes(true);
    setError("");
    try {
      let url = `/recipes/search?q=${encodeURIComponent(query)}`;
      if (recipeDifficulty) url += `&difficulty=${recipeDifficulty}`;
      if (recipeMaxPrep) url += `&maxPrepTime=${recipeMaxPrep}`;
      const data = await api(url);
      setRecipes(data.recipes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const toggleIngredient = (name) => {
    const normalized = name.trim().toLowerCase();
    setSelectedIngredients((prev) => {
      const exists = prev.some((entry) => entry.toLowerCase() === normalized);
      if (exists) {
        return prev.filter((entry) => entry.toLowerCase() !== normalized);
      }
      return [...prev, name.trim()];
    });
  };

  const addIngredientFromInput = (event) => {
    event.preventDefault();
    if (!itemName.trim()) {
      return;
    }
    toggleIngredient(itemName.trim());
    setItemName("");
  };

  const suggestRecipesFromIngredients = async () => {
    if (selectedIngredients.length === 0) {
      setError("Bitte mindestens eine Zutat auswählen.");
      return;
    }

    setLoadingRecipes(true);
    setError("");
    try {
      let url = `/recipes/by-ingredients?ingredients=${encodeURIComponent(
        selectedIngredients.join(",")
      )}`;
      if (recipeDifficulty) url += `&difficulty=${recipeDifficulty}`;
      if (recipeMaxPrep) url += `&maxPrepTime=${recipeMaxPrep}`;
      const data = await api(url);
      setRecipes(data.recipes);
      setRecipeQuery(selectedIngredients.join(", "));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const toggleMarket = (market) => {
    setSelectedMarkets((prev) => {
      if (prev.includes(market)) {
        return prev.filter((entry) => entry !== market);
      }
      return [...prev, market];
    });
  };

  const runOffersComparison = async () => {
    if (selectedMarkets.length === 0) {
      setError("Bitte mindestens einen Markt auswählen.");
      return;
    }

    setLoadingOffers(true);
    setError("");
    try {
      const data = await api(
        `/offers/compare?markets=${encodeURIComponent(selectedMarkets.join(","))}`,
        {},
        session.token
      );
      setOffersResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOffers(false);
    }
  };

  const loadLiveOffers = async (reset = false) => {
    const nextOffset = reset ? 0 : liveOffersOffset;
    const market = liveMarketView || "ALL";

    setLoadingLiveOffers(true);
    setError("");
    try {
      const data = await api(
        `/offers/live?market=${encodeURIComponent(market)}&offset=${nextOffset}&limit=18`
      );

      setLiveOffers((prev) =>
        reset ? data.offers : [...prev, ...data.offers]
      );
      setLiveOffersOffset(nextOffset + data.offers.length);
      setLiveOffersHasMore(Boolean(data.hasMore));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingLiveOffers(false);
    }
  };

  const exportShoppingByMarket = async () => {
    if (selectedMarkets.length === 0) {
      setError("Bitte mindestens einen Markt für den Export wählen.");
      return;
    }

    setError("");
    try {
      const data = await api(
        `/offers/export?markets=${encodeURIComponent(selectedMarkets.join(","))}`,
        {},
        session.token
      );

      const csvContent = data.csv || "";
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "einkauf-nach-markt.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Recurring items CRUD ──────────────────────────────────────────
  const addRecurring = async (event) => {
    event.preventDefault();
    if (!recurName.trim()) return;
    setError("");
    try {
      await api(
        `/families/${session.user.familyId}/recurring`,
        {
          method: "POST",
          body: JSON.stringify({
            name: recurName.trim(),
            quantity: Number(recurQty) || 1,
            dayOfWeek: recurDay
          })
        },
        session.token
      );
      setRecurName("");
      setRecurQty(1);
      const data = await api(`/families/${session.user.familyId}/recurring`, {}, session.token);
      setRecurringItems(data.recurringItems || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteRecurring = async (itemId) => {
    setError("");
    try {
      await api(
        `/families/${session.user.familyId}/recurring/${itemId}`,
        { method: "DELETE" },
        session.token
      );
      const data = await api(`/families/${session.user.familyId}/recurring`, {}, session.token);
      setRecurringItems(data.recurringItems || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Location selection ────────────────────────────────────────────
  const selectLocation = async (market, locationName, locationUrl) => {
    setError("");
    try {
      await api(
        `/families/${session.user.familyId}/locations`,
        {
          method: "POST",
          body: JSON.stringify({ market, locationName, locationUrl })
        },
        session.token
      );
      setSelectedLocation((prev) => ({ ...prev, [market]: locationName }));
    } catch (err) {
      setError(err.message);
    }
  };

  const resetSession = () => {
    localStorage.removeItem("authSession");
    setSession(null);
    setItems([]);
    setRecipes([]);
    setOffersResult(null);
    setSelectedIngredients([]);
    setRecurringItems([]);
  };

  return (
    <div className="page-shell">
      <header className="hero">
        <p className="eyebrow">Family Sync</p>
        <h1>Gemeinsame Einkaufsliste in Echtzeit</h1>
        <p>
          Teile einen Familien-Code, hake Produkte live ab und entdecke passende
          Rezepte direkt aus dem Chefkoch-Bereich.
        </p>
        {isLoggedIn && (
          <button
            className="ghost theme-toggle"
            onClick={() => setShowThemePicker(!showThemePicker)}
            style={{ marginTop: "0.8rem" }}
          >
            {showThemePicker ? "Design schließen" : "Design anpassen"}
          </button>
        )}
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Theme Picker ──────────────────────────────────────────── */}
      {isLoggedIn && showThemePicker && (
        <div className="card theme-picker">
          <h2>Farbschema anpassen</h2>
          <div className="theme-grid">
            <label>
              Primärfarbe
              <input
                type="color"
                value={theme.primary}
                onChange={(e) => saveTheme({ ...theme, primary: e.target.value })}
              />
            </label>
            <label>
              Akzentfarbe
              <input
                type="color"
                value={theme.accent}
                onChange={(e) => saveTheme({ ...theme, accent: e.target.value })}
              />
            </label>
            <label>
              Hintergrund oben
              <input
                type="color"
                value={theme.bgTop}
                onChange={(e) => saveTheme({ ...theme, bgTop: e.target.value })}
              />
            </label>
            <label>
              Hintergrund unten
              <input
                type="color"
                value={theme.bgBottom}
                onChange={(e) => saveTheme({ ...theme, bgBottom: e.target.value })}
              />
            </label>
          </div>
          <button
            className="ghost"
            onClick={() => saveTheme(DEFAULT_THEME)}
          >
            Standard zurücksetzen
          </button>
        </div>
      )}

      {!isLoggedIn ? (
        <section className="auth-grid">
          <form className="card" onSubmit={register}>
            <h2>Registrieren</h2>
            <div className="switch-row">
              <button
                type="button"
                className={registerMode === "create" ? "tab active" : "tab"}
                onClick={() => setRegisterMode("create")}
              >
                Neue Familie
              </button>
              <button
                type="button"
                className={registerMode === "join" ? "tab active" : "tab"}
                onClick={() => setRegisterMode("join")}
              >
                Bestehende Familie
              </button>
            </div>

            {registerMode === "create" ? (
              <label>
                Familienname
                <input
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="z. B. Familie Meier"
                  required
                />
              </label>
            ) : (
              <label>
                Familien-Code
                <input
                  value={registerFamilyId}
                  onChange={(e) => setRegisterFamilyId(e.target.value.toUpperCase())}
                  placeholder="z. B. A1B2C3"
                  required
                />
              </label>
            )}

            <label>
              Benutzername
              <input
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
                placeholder="z. B. julia"
                required
              />
            </label>
            <label>
              Passwort
              <input
                type="password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                placeholder="mind. 6 Zeichen"
                required
              />
            </label>
            <button type="submit">Account erstellen</button>
          </form>

          <form className="card" onSubmit={login}>
            <h2>Login</h2>
            <label>
              Familien-Code
              <input
                value={loginFamilyId}
                onChange={(e) => setLoginFamilyId(e.target.value.toUpperCase())}
                placeholder="z. B. A1B2C3"
                required
              />
            </label>
            <label>
              Benutzername
              <input
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="z. B. julia"
                required
              />
            </label>
            <label>
              Passwort
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit">Einloggen</button>
          </form>
        </section>
      ) : (
        <section className="dashboard-grid wide">
          <article className="card list-card">
            <div className="family-chip">
              <strong>{session.user.familyName}</strong>
              <span>Code: {session.user.familyId}</span>
              <span>Account: {session.user.username}</span>
              <button className="ghost" onClick={resetSession}>
                Logout
              </button>
            </div>

            <form className="add-form" onSubmit={addListItem}>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Neues Produkt"
              />
              <input
                type="number"
                min="1"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
              />
              <button type="submit">Hinzufugen</button>
            </form>

            <form className="mini-form" onSubmit={addIngredientFromInput}>
              <button type="submit" className="ghost">
                Als Zutat markieren
              </button>
            </form>

            <p className="counter">
              Erledigt: {checkedCount}/{items.length}
            </p>

            <ul className="shopping-list">
              {items.map((item) => (
                <li key={item.id} className={item.checked ? "done" : ""}>
                  <label className="item-label">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecked(item)}
                    />
                    <span>
                      {item.name} ({item.quantity}x)
                    </span>
                  </label>
                  <button className="ghost" onClick={() => toggleIngredient(item.name)}>
                    Zutat
                  </button>
                  <button className="danger" onClick={() => removeItem(item.id)}>
                    Loschen
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="card recipes-card">
            <h2>Gericht aus Zutaten finden</h2>
            <div className="ingredients-wrap">
              {selectedIngredients.length === 0 ? (
                <p>Noch keine Zutaten ausgewählt.</p>
              ) : (
                selectedIngredients.map((ingredient) => (
                  <button
                    key={ingredient}
                    className="chip"
                    type="button"
                    onClick={() => toggleIngredient(ingredient)}
                  >
                    {ingredient} ×
                  </button>
                ))
              )}
            </div>

            {/* ── Recipe filters ──────────────────────────────────── */}
            <div className="recipe-filters">
              <label>
                Schwierigkeit
                <select
                  value={recipeDifficulty}
                  onChange={(e) => setRecipeDifficulty(e.target.value)}
                >
                  <option value="">Alle</option>
                  <option value="einfach">Einfach</option>
                  <option value="normal">Normal</option>
                  <option value="schwer">Schwer</option>
                </select>
              </label>
              <label>
                Max. Zubereitungszeit (Min.)
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={recipeMaxPrep}
                  onChange={(e) => setRecipeMaxPrep(e.target.value)}
                  placeholder="z. B. 30"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={suggestRecipesFromIngredients}
              disabled={loadingRecipes}
            >
              {loadingRecipes ? "Suche..." : "Gerichte aus Zutaten suchen"}
            </button>

            <h3>Oder freie Chefkoch-Suche</h3>
            <form className="recipe-form" onSubmit={searchRecipes}>
              <input
                value={recipeQuery}
                onChange={(e) => setRecipeQuery(e.target.value)}
                placeholder="z. B. Pasta, Curry, Salat"
              />
              <button type="submit" disabled={loadingRecipes}>
                {loadingRecipes ? "Suche..." : "Rezepte finden"}
              </button>
            </form>

            <ul className="recipe-list">
              {recipes.map((recipe) => (
                <li key={recipe.url}>
                  <a href={recipe.url} target="_blank" rel="noreferrer">
                    {recipe.title}
                  </a>
                </li>
              ))}
            </ul>
          </article>

          {/* ── Wöchentliche Wiederholungen ───────────────────────── */}
          <article className="card recurring-card">
            <h2>Wöchentliche Einkäufe</h2>
            <p>Lege fest, welche Artikel an welchem Wochentag automatisch hinzugefügt werden.</p>

            <form className="recurring-form" onSubmit={addRecurring}>
              <input
                value={recurName}
                onChange={(e) => setRecurName(e.target.value)}
                placeholder="Produktname"
                required
              />
              <input
                type="number"
                min="1"
                value={recurQty}
                onChange={(e) => setRecurQty(e.target.value)}
              />
              <select
                value={recurDay}
                onChange={(e) => setRecurDay(Number(e.target.value))}
              >
                {DAY_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <button type="submit">Hinzufügen</button>
            </form>

            {recurringItems.length === 0 ? (
              <p className="muted">Noch keine wiederkehrenden Einkäufe.</p>
            ) : (
              <ul className="recurring-list">
                {recurringItems.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{item.name}</strong> ({item.quantity}x) — {DAY_NAMES[item.dayOfWeek]}
                    </span>
                    <button className="danger" onClick={() => deleteRecurring(item.id)}>
                      Löschen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* ── Marktstandorte ─────────────────────────────────────── */}
          <article className="card locations-card">
            <h2>Marktstandorte auswählen</h2>
            <p>Wähle für jeden Markt einen Standort in deiner Nähe.</p>
            <div className="locations-grid">
              {availableMarkets.map((market) => (
                <div key={market} className="location-entry">
                  <strong>{market}</strong>
                  <select
                    value={selectedLocation[market] || ""}
                    onChange={(e) => {
                      const locName = e.target.value;
                      if (!locName) {
                        api(
                          `/families/${session.user.familyId}/locations/${market}`,
                          { method: "DELETE" },
                          session.token
                        ).catch(() => {});
                        setSelectedLocation((prev) => {
                          const next = { ...prev };
                          delete next[market];
                          return next;
                        });
                        return;
                      }
                      const loc = (marketLocations[market] || []).find(
                        (l) => l.name === locName
                      );
                      selectLocation(market, locName, loc?.url || "");
                    }}
                  >
                    <option value="">— Nicht ausgewählt —</option>
                    {(marketLocations[market] || []).map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </article>

          <article className="card offers-card">
            <h2>Marktangebote vergleichen</h2>
            <p>
              Waehle die Markte aus und vergleiche mit deiner Einkaufsliste, um den
              guenstigsten Markt zu finden.
            </p>

            <div className="market-grid">
              {availableMarkets.map((market) => (
                <label key={market} className="market-option">
                  <input
                    type="checkbox"
                    checked={selectedMarkets.includes(market)}
                    onChange={() => toggleMarket(market)}
                  />
                  <span>{market}</span>
                </label>
              ))}
            </div>

            <button type="button" onClick={runOffersComparison} disabled={loadingOffers}>
              {loadingOffers ? "Vergleich laeuft..." : "Preise vergleichen"}
            </button>

            <button type="button" className="ghost" onClick={exportShoppingByMarket}>
              Export Einkauf nach Markt
            </button>

            <h3>Live-Angebote durchscrollen</h3>
            <div className="live-controls">
              <label>
                Ansicht
                <select
                  value={liveMarketView}
                  onChange={(event) => {
                    setLiveMarketView(event.target.value);
                    setLiveOffersOffset(0);
                  }}
                >
                  <option value="ALL">Alle Märkte</option>
                  {availableMarkets.map((market) => (
                    <option value={market} key={`view-${market}`}>
                      {market}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="ghost" onClick={() => loadLiveOffers(true)}>
                Neu laden
              </button>
            </div>

            <ul className="live-offers-list">
              {liveOffers.map((offer, index) => (
                <li key={`${offer.url}-${index}`}>
                  <div>
                    <strong>{offer.market}</strong>
                    <p>{offer.title}</p>
                  </div>
                  <div className="offer-meta">
                    <span>{Number.isFinite(offer.price) ? `${offer.price.toFixed(2)} EUR` : "Preis n/a"}</span>
                    <a href={offer.url} target="_blank" rel="noreferrer">
                      Öffnen
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            {liveOffersHasMore && (
              <button type="button" onClick={() => loadLiveOffers(false)} disabled={loadingLiveOffers}>
                {loadingLiveOffers ? "Lädt..." : "Mehr Angebote laden"}
              </button>
            )}

            {offersResult?.recommendation && (
              <div className="recommendation">
                <strong>Empfehlung: {offersResult.recommendation.market}</strong>
                <p>
                  Abdeckung: {offersResult.recommendation.coveredItems}/
                  {offersResult.recommendation.totalItems} Artikel, Gesamtpreis: {" "}
                  {offersResult.recommendation.totalPrice.toFixed(2)} EUR
                </p>
              </div>
            )}

            {offersResult?.marketTotals?.length > 0 && (
              <ul className="offer-summary">
                {offersResult.marketTotals.map((entry) => (
                  <li key={entry.market}>
                    <strong>{entry.market}</strong>: {entry.coveredItems}/{entry.totalItems} |{" "}
                    {entry.totalPrice.toFixed(2)} EUR
                  </li>
                ))}
              </ul>
            )}

            {offersResult?.bestPerItem?.length > 0 && (
              <ul className="offer-summary">
                {offersResult.bestPerItem.map((entry) => (
                  <li key={entry.itemName}>
                    {entry.itemName}: {" "}
                    {entry.best
                      ? `${entry.best.market} (${entry.best.totalPrice.toFixed(2)} EUR)`
                      : "nicht gefunden"}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      )}
    </div>
  );
}
