import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
import { useApp, api } from "./context/AppContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const socketRef = { current: null };
function getSocket() {
  if (!socketRef.current) {
    socketRef.current = io(SOCKET_URL, { autoConnect: false });
  }
  return socketRef.current;
}

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const DEFAULT_CARD_ORDER = ["shopping", "minilists", "recurring", "recipes"];
const CARD_STORAGE_KEY = "shopping_card_order";
const EDITOR_STORAGE_KEY = "shopping_editor_mode";

// ── Karten als stabile Top-Level-Komponenten ─────────────────────────────
// Wichtig: Innerhalb von App() definierte Komponenten bekommen bei jedem
// Re-Render eine NEUE Identität -> React würde sie unmounten/remounten,
// wodurch der Cursor aus Eingabefeldern fliegt. Deshalb leben sie hier
// außerhalb und erhalten ihre Daten über das `p`-Props-Objekt.

function CardShopping(p) {
  return (
    <section className="card" data-card-id="shopping">
      <div className="card-header-row">
        <h2>{p.t ? p.t("list.title") : "Einkaufsliste"}</h2>
        {p.editorMode && <span className="editor-card-badge">Position {p.cardOrder.indexOf("shopping") + 1}</span>}
      </div>
      <div className="family-chip">
        <span className="muted">{p.t ? p.t("list.quantity") : "Menge erhöhen"}: {p.settings.duplicateBehavior === "merge" ? "✅ An" : "❌ Aus"}</span>
        <Link to="/settings">Einstellungen</Link>
      </div>
      {typeof p.updateSettings === "function" && (
        <div className="family-chip" style={{ marginTop: "0.2rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", margin: 0 }}>
            <input type="checkbox" checked={!!p.settings.autoDeleteDone}
              onChange={(e) => p.updateSettings({ autoDeleteDone: e.target.checked })} />
            <span className="muted" style={{ fontSize: "0.85rem" }}>{p.t ? p.t("list.autoDelete") : "Erledigtes automatisch löschen"}</span>
          </label>
        </div>
      )}
      <div className="add-form">
        <textarea
          className="auto-grow"
          rows={1}
          placeholder={p.t ? p.t("list.itemPlaceholder") : "Artikel eingeben"}
          value={p.itemName}
          onChange={(e) => p.setItemName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.addItem(); } }}
          style={{ resize: "none", overflow: "hidden" }}
          ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
        />
        <input type="number" min={1} value={p.itemQty} onChange={(e) => p.setItemQty(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.addItem(); } }} />
        <button type="button" onClick={p.addItem}>{p.t ? p.t("list.add") : "Hinzufügen"}</button>
      </div>
      <ul className="list">
        {p.items.filter((i) => !i.checked).map((item) => (
          <li key={item.id} className={item.checked ? "checked" : ""}>
            <label className="item-row">
              <input type="checkbox" checked={item.checked} onChange={() => p.toggleItem(item.id, item.checked)} />
              <span className="item-name">{item.name}</span>
              <span className="item-qty">{item.quantity}x</span>
            </label>
            <div className="item-actions">
              <button className="ghost" onClick={() => { p.setItemName(item.name); p.setItemQty(String(item.quantity)); p.deleteItem(item.id); }}>Bearbeiten</button>
              <button className="danger" onClick={() => p.deleteItem(item.id)}>Löschen</button>
            </div>
          </li>
        ))}
      </ul>
      {p.items.some((i) => i.checked) && (
        <div className="done-section">
          <h3 className="done-title">✅ {p.t ? p.t("list.done") : "Erledigt"}</h3>
          <ul className="list">
            {p.items.filter((i) => i.checked).map((item) => (
              <li key={item.id} className="checked done-item">
                <label className="item-row">
                  <input type="checkbox" checked={item.checked} onChange={() => p.toggleItem(item.id, item.checked)} />
                  <span className="item-name">{item.name}</span>
                  <span className="item-qty">{item.quantity}x</span>
                </label>
                <div className="item-actions">
                  <button className="danger" onClick={() => p.deleteItem(item.id)}>Löschen</button>
                </div>
              </li>
            ))}
          </ul>
          <button className="ghost" style={{ marginTop: "0.4rem" }} onClick={p.deleteDoneItems}>🗑️ {p.t ? p.t("list.clearDone") : "Erledigte löschen"}</button>
        </div>
      )}
    </section>
  );
}

function CardMiniLists(p) {
  return (
    <section className="card" data-card-id="minilists">
      <div className="card-header-row">
        <h2>📋 Mini-Listen</h2>
        {p.editorMode && <span className="editor-card-badge">Position {p.cardOrder.indexOf("minilists") + 1}</span>}
      </div>
      <div className="add-form" style={{ gridTemplateColumns: "1fr auto" }}>
        <input type="text" placeholder="Listenname" value={p.miniListName} onChange={(e) => p.setMiniListName(e.target.value)} />
        <button type="button" onClick={() => { if (p.setEditingMiniListId) p.setEditingMiniListId(null); p.setMiniListName(""); p.setMiniListItems([]); p.setShowMiniListEditor(true); }}>+ Neu</button>
      </div>
      {p.showMiniListEditor && (
        <div className="mini-form">
          {p.editingMiniListId && <p className="muted" style={{ margin: 0 }}>✏️ Bearbeite Mini-Liste …</p>}
          <input type="text" placeholder="Zutat (Enter)" value={p.miniListItemInput} onChange={(e) => p.setMiniListItemInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && p.miniListItemInput.trim()) { p.setMiniListItems([...p.miniListItems, { name: p.miniListItemInput.trim(), quantity: 1 }]); p.setMiniListItemInput(""); } }} />
          <ul className="recurring-list" style={{ margin: "0.4rem 0" }}>
            {p.miniListItems.map((mi, idx) => (
              <li key={idx}><span>{mi.name} ({mi.quantity}x)</span><button className="danger" onClick={() => p.setMiniListItems(p.miniListItems.filter((_, i) => i !== idx))}>✕</button></li>
            ))}
          </ul>
          <div className="switch-row">
            <button onClick={p.saveMiniList}>Speichern</button>
            <button className="ghost" onClick={() => { p.setShowMiniListEditor(false); p.setMiniListItems([]); if (p.setEditingMiniListId) p.setEditingMiniListId(null); }}>Abbrechen</button>
          </div>
        </div>
      )}
      {p.miniLists.length > 0 && (
        <ul className="recurring-list">
          {p.miniLists.map((ml) => (
            <li key={ml.id}>
              <div><strong>{ml.name}</strong><p className="muted">{ml.items.length} Zutaten</p></div>
              <div className="item-actions">
                <button onClick={() => p.addMiniListToShopping(ml)}>+ Zur Liste</button>
                <button className="ghost" onClick={() => p.addMiniListToRecurring(ml)}>🔄 Wiederkehrend</button>
                <button className="ghost" onClick={() => p.startEditMiniList(ml)}>✏️</button>
                <button className="danger" onClick={() => p.deleteMiniList(ml.id)}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CardRecurring(p) {
  return (
    <section className="card" data-card-id="recurring">
      <div className="card-header-row">
        <h2>🔄 Wiederkehrende Artikel</h2>
        {p.editorMode && <span className="editor-card-badge">Position {p.cardOrder.indexOf("recurring") + 1}</span>}
      </div>
      <div className="recurring-form">
        <input type="text" placeholder="Artikel" value={p.recurName} onChange={(e) => p.setRecurName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.addRecurring(); } }} />
        <input type="number" min={1} value={p.recurQty} onChange={(e) => p.setRecurQty(Math.max(1, Number(e.target.value)))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.addRecurring(); } }} />
        <select value={p.recurDay} onChange={(e) => p.setRecurDay(Number(e.target.value))}>
          {DAY_SHORT.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
        </select>
        <button type="button" onClick={p.addRecurring}>+ Hinzufügen</button>
      </div>
      {p.recurringItems.length > 0 && (
        <ul className="recurring-list">
          {p.recurringItems.map((ritem) => (
            <li key={ritem.id}><span>{ritem.name} ({ritem.quantity}x) - <span className="muted">{DAY_SHORT[ritem.dayOfWeek] || DAY_NAMES[ritem.dayOfWeek]}</span></span><button className="danger" onClick={() => p.deleteRecurring(ritem.id)}>✕</button></li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CardRecipes(p) {
  return (
    <section className="card" data-card-id="recipes">
      <div className="card-header-row">
        <h2>🍳 {p.t ? p.t("recipes.title") : "Rezepte finden"}</h2>
        {p.editorMode && <span className="editor-card-badge">Position {p.cardOrder.indexOf("recipes") + 1}</span>}
      </div>
      <div className="recipe-form">
        <input type="text" placeholder={p.t ? p.t("recipes.searchPlaceholder") : "Suchbegriff"} value={p.recipeQuery} onChange={(e) => p.setRecipeQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.searchRecipes(); } }} />
        <button type="button" onClick={p.searchRecipes} disabled={p.loadingRecipes}>{p.loadingRecipes ? "Suche..." : (p.t ? p.t("recipes.search") : "Suchen")}</button>
      </div>
      <div className="recipe-results-panel">
        {p.recipes.length > 0 && (
          <ul className="list">{p.recipes.map((r, i) => <li key={i}><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></li>)}</ul>
        )}
      </div>
      <p className="muted" style={{ marginTop: "0.5rem" }}>Oder nach Zutaten:</p>
      <div className="recipe-filters">
        <input type="text" placeholder="Zutat (Enter)" value={p.ingredientInput} onChange={(e) => p.setIngredientInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && p.ingredientInput.trim()) { p.setSelectedIngredients([...p.selectedIngredients, p.ingredientInput.trim()]); p.setIngredientInput(""); } }} />
        <button type="button" onClick={p.searchByIngredients} disabled={p.selectedIngredients.length === 0 || p.loadingRecipes}>{p.loadingRecipes ? "Suche..." : (p.t ? p.t("recipes.byIngredients") : "Rezepte finden")}</button>
      </div>
      <div className="family-chip">
        {p.selectedIngredients.map((ing, idx) => (
          <span key={idx} className="tag">{ing}<button className="danger" onClick={() => p.setSelectedIngredients(p.selectedIngredients.filter((_, i) => i !== idx))}>✕</button></span>
        ))}
      </div>
    </section>
  );
}

const CARD_COMPONENTS = {
  shopping: CardShopping,
  minilists: CardMiniLists,
  recurring: CardRecurring,
  recipes: CardRecipes
};

export default function App() {
  const { session, setSession, settings, theme, t } = useApp();

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
  // Mengenfeld als String halten, damit man beim Tippen nicht aus dem Feld fliegt;
  // Validierung passiert erst in addItem().
  const [itemQty, setItemQty] = useState("1");
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
  const [editingMiniListId, setEditingMiniListId] = useState(null);
  const [editorMode, setEditorMode] = useState(() => {
    try { return localStorage.getItem(EDITOR_STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [cardOrder, setCardOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(CARD_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch {}
    return DEFAULT_CARD_ORDER.slice();
  });
  const dragSrcIdx = useRef(-1);
  const [dragOverIdx, setDragOverIdx] = useState(-1);

  // ── Free Editor Mode (pixelgenaues Positionieren + Skalieren) ─────────
  const FREE_EDITOR_KEY = "shopping_free_editor";
  const FREE_LAYOUT_KEY = "shopping_free_layout";
  const [freeEditor, setFreeEditor] = useState(() => {
    try { return localStorage.getItem(FREE_EDITOR_KEY) === "1"; } catch { return false; }
  });
  const [freeLayout, setFreeLayout] = useState(() => {
    try {
      const saved = localStorage.getItem(FREE_LAYOUT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const freeDragId = useRef(null);
  const freeDragMode = useRef(null); // "move" | "resize"
  const freeStart = useRef({ x: 0, y: 0, lx: 0, ly: 0 });

  useEffect(() => {
    try { localStorage.setItem(FREE_EDITOR_KEY, freeEditor ? "1" : "0"); } catch {}
  }, [freeEditor]);

  useEffect(() => {
    try { localStorage.setItem(FREE_LAYOUT_KEY, JSON.stringify(freeLayout)); } catch {}
  }, [freeLayout]);

  const freeCanvasRef = useRef(null);
  const freeSetRect = (id, patch) => {
    setFreeLayout((prev) => {
      const base = prev[id] || { x: 0, y: 0, w: 320, h: 260 };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  };

  const freeMoveStart = (e, id) => {
    if (!freeEditor) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const canvas = freeCanvasRef.current?.getBoundingClientRect();
    const base = freeLayout[id] || { x: rect.left - (canvas?.left || 0), y: rect.top - (canvas?.top || 0), w: rect.width, h: rect.height };
    freeDragId.current = id;
    freeDragMode.current = "move";
    freeStart.current = { x: e.clientX, y: e.clientY, lx: base.x, ly: base.y };
    setFreeLayout((prev) => ({ ...prev, [id]: base }));
    window.addEventListener("pointermove", freeMove);
    window.addEventListener("pointerup", freeEnd);
  };

  const freeResizeStart = (e, id) => {
    if (!freeEditor) return;
    e.stopPropagation();
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const base = freeLayout[id] || { x: 0, y: 0, w: rect.width, h: rect.height };
    freeDragId.current = id;
    freeDragMode.current = "resize";
    freeStart.current = { x: e.clientX, y: e.clientY, w: base.w, h: base.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const freeMove = (e) => {
    const id = freeDragId.current;
    if (!id) return;
    const canvas = freeCanvasRef.current?.getBoundingClientRect();
    if (freeDragMode.current === "move") {
      const dx = e.clientX - freeStart.current.x;
      const dy = e.clientY - freeStart.current.y;
      const nx = Math.max(0, Math.round(freeStart.current.lx + dx));
      const ny = Math.max(0, Math.round(freeStart.current.ly + dy));
      freeSetRect(id, { x: nx, y: ny });
    } else if (freeDragMode.current === "resize") {
      const dw = e.clientX - freeStart.current.x;
      const dh = e.clientY - freeStart.current.y;
      freeSetRect(id, { w: Math.max(180, Math.round(freeStart.current.w + dw)), h: Math.max(140, Math.round(freeStart.current.h + dh)) });
    }
  };

  const freeEnd = () => {
    freeDragId.current = null;
    freeDragMode.current = null;
    window.removeEventListener("pointermove", freeMove);
    window.removeEventListener("pointerup", freeEnd);
  };

  const resetFreeLayout = () => {
    setFreeLayout({});
  };

  useEffect(() => {
    try { localStorage.setItem(EDITOR_STORAGE_KEY, editorMode ? "1" : "0"); } catch {}
  }, [editorMode]);

  useEffect(() => {
    try { localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(cardOrder)); } catch {}
  }, [cardOrder]);

  useEffect(() => {
    if (!session) return;
    const socket = getSocket();
    socket.connect();
    socket.emit("joinFamily", { token: session.token });
    const onItemsSnapshot = (nextItems) => setItems(nextItems);
    const onRecurringSnapshot = (next) => setRecurringItems(next);
    const onMiniListsSnapshot = (next) => setMiniLists(next);
    socket.on("itemsSnapshot", onItemsSnapshot);
    socket.on("recurringSnapshot", onRecurringSnapshot);
    socket.on("miniListsSnapshot", onMiniListsSnapshot);
    return () => {
      socket.off("itemsSnapshot", onItemsSnapshot);
      socket.off("recurringSnapshot", onRecurringSnapshot);
      socket.off("miniListsSnapshot", onMiniListsSnapshot);
      socket.disconnect();
    };
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
    if (typeof window !== "undefined" && !window.confirm("Wirklich abmelden?")) return;
    setSession(null);
    setItems([]); setRecipes([]); setSelectedIngredients([]); setRecurringItems([]);
  };

  const addItem = async () => {
    if (!itemName.trim() || !session) return;
    const quantity = Math.max(1, Number(itemQty) || 1);
    try {
      await api(`/families/${session.familyId}/items`, { method: "POST", body: JSON.stringify({ name: itemName.trim(), quantity }) }, session.token);
      setItemName(""); setItemQty("1");
    } catch (e) { setError(e.message); }
  };

  const toggleItem = async (itemId, currentChecked) => {
    if (!session) return;
    const willCheck = !currentChecked;
    // Option "Erledigtes automatisch löschen" an
    if (willCheck && settings.autoDeleteDone) {
      try {
        await api(`/families/${session.familyId}/items/${itemId}`, { method: "DELETE" }, session.token);
      } catch (e) { setError(e.message); }
      return;
    }
    try {
      await api(`/families/${session.familyId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ checked: willCheck }) }, session.token);
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
      await api(`/families/${session.familyId}/recurring`, { method: "POST", body: JSON.stringify({ name: recurName.trim(), quantity: recurQty, dayOfWeek: recurDay, duplicateBehavior: settings.duplicateBehavior }) }, session.token);
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
      if (editingMiniListId) {
        await api(`/families/${session.familyId}/mini-lists/${editingMiniListId}`, { method: "PATCH", body: JSON.stringify({ name: miniListName.trim(), items: miniListItems }) }, session.token);
      } else {
        await api(`/families/${session.familyId}/mini-lists`, { method: "POST", body: JSON.stringify({ name: miniListName.trim(), items: miniListItems }) }, session.token);
      }
      setMiniListName(""); setMiniListItems([]); setShowMiniListEditor(false); setEditingMiniListId(null);
      const data = await api(`/families/${session.familyId}/mini-lists`, {}, session.token);
      setMiniLists(data.miniLists || []);
    } catch (e) { setError(e.message); }
  };

  const startEditMiniList = (ml) => {
    setMiniListName(ml.name);
    setMiniListItems(ml.items.map((it) => (typeof it === "string" ? { name: it, quantity: 1 } : it)));
    setEditingMiniListId(ml.id);
    setShowMiniListEditor(true);
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

  const resetCardOrder = () => {
    setCardOrder(DEFAULT_CARD_ORDER.slice());
  };

  const handleDragStart = (e, idx) => {
    dragSrcIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(idx)); } catch {}
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  };
  const handleDragLeave = () => {
    setDragOverIdx(-1);
  };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    const src = dragSrcIdx.current;
    setDragOverIdx(-1);
    dragSrcIdx.current = -1;
    if (src < 0 || src === idx) return;
    setCardOrder((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(src, 1);
      next.splice(idx, 0, moved);
      return next;
    });
  };
  const handleDragEnd = () => {
    dragSrcIdx.current = -1;
    setDragOverIdx(-1);
  };

  // Props für die (Top-Level) Karten-Komponenten
  const cardProps = {
    editorMode,
    cardOrder,
    settings,
    updateSettings,
    t,
    itemName, setItemName,
    itemQty, setItemQty,
    items, addItem, toggleItem, deleteItem,
    miniLists, miniListName, setMiniListName,
    showMiniListEditor, setShowMiniListEditor,
    miniListItemInput, setMiniListItemInput,
    miniListItems, setMiniListItems,
    saveMiniList, deleteMiniList, addMiniListToShopping,
    addMiniListToRecurring, deleteDoneItems,
    startEditMiniList, editingMiniListId, setEditingMiniListId,
    recurringItems, recurName, setRecurName,
    recurQty, setRecurQty, recurDay, setRecurDay,
    addRecurring, deleteRecurring,
    recipes, recipeQuery, setRecipeQuery, searchRecipes,
    loadingRecipes, ingredientInput, setIngredientInput,
    selectedIngredients, setSelectedIngredients, searchByIngredients
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

  const CardShopping = () => (
    <section className="card" data-card-id="shopping">
      <div className="card-header-row">
        <h2>Einkaufsliste</h2>
        {editorMode && <span className="editor-card-badge">Position {cardOrder.indexOf("shopping") + 1}</span>}
      </div>
      <div className="family-chip">
        <span className="muted">Menge erhöhen: {settings.duplicateBehavior === "merge" ? "\u2705 An" : "\u274c Aus"}</span>
        <Link to="/settings">Einstellungen</Link>
      </div>
      <div className="add-form">
        <input type="text" placeholder="Artikel eingeben" value={itemName} onChange={(e) => setItemName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
        <input type="number" min={1} value={itemQty} onChange={(e) => setItemQty(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
        <button type="button" onClick={addItem}>Hinzufügen</button>
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
              <button className="ghost" onClick={() => { setItemName(item.name); setItemQty(String(item.quantity)); deleteItem(item.id); }}>Bearbeiten</button>
              <button className="danger" onClick={() => deleteItem(item.id)}>Löschen</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  const CardMiniLists = () => (
    <section className="card" data-card-id="minilists">
      <div className="card-header-row">
        <h2>📋 Mini-Listen</h2>
        {editorMode && <span className="editor-card-badge">Position {cardOrder.indexOf("minilists") + 1}</span>}
      </div>
      <div className="add-form" style={{gridTemplateColumns:"1fr auto"}}>
        <input type="text" placeholder="Listenname" value={miniListName} onChange={(e) => setMiniListName(e.target.value)} />
        <button type="button" onClick={() => setShowMiniListEditor(true)}>+ Neu</button>
      </div>
      {showMiniListEditor && (
        <div className="mini-form">
          <input type="text" placeholder="Zutat (Enter)" value={miniListItemInput} onChange={(e) => setMiniListItemInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && miniListItemInput.trim()) { setMiniListItems([...miniListItems, {name: miniListItemInput.trim(), quantity: 1}]); setMiniListItemInput(""); }}} />
          <ul className="recurring-list" style={{margin:"0.4rem 0"}}>
            {miniListItems.map((mi, idx) => (
              <li key={idx}><span>{mi.name} ({mi.quantity}x)</span><button className="danger" onClick={() => setMiniListItems(miniListItems.filter((_, i) => i !== idx))}>✕</button></li>
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
                <button className="danger" onClick={() => deleteMiniList(ml.id)}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const CardRecurring = () => (
    <section className="card" data-card-id="recurring">
      <div className="card-header-row">
        <h2>🔄 Wiederkehrende Artikel</h2>
        {editorMode && <span className="editor-card-badge">Position {cardOrder.indexOf("recurring") + 1}</span>}
      </div>
      <div className="recurring-form">
        <input type="text" placeholder="Artikel" value={recurName} onChange={(e) => setRecurName(e.target.value)} />
        <input type="number" min={1} value={recurQty} onChange={(e) => setRecurQty(Math.max(1, Number(e.target.value)))} />
        <select value={recurDay} onChange={(e) => setRecurDay(Number(e.target.value))}>
          {DAY_NAMES.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
        </select>
        <button type="button" onClick={addRecurring}>+ Hinzufügen</button>
      </div>
      {recurringItems.length > 0 && (
        <ul className="recurring-list">
          {recurringItems.map((ritem) => (
            <li key={ritem.id}><span>{ritem.name} ({ritem.quantity}x) - <span className="muted">{DAY_NAMES[ritem.dayOfWeek]}</span></span><button className="danger" onClick={() => deleteRecurring(ritem.id)}>✕</button></li>
          ))}
        </ul>
      )}
    </section>
  );

  const CardRecipes = () => (
    <section className="card" data-card-id="recipes">
      <div className="card-header-row">
        <h2>🍳 Rezepte finden</h2>
        {editorMode && <span className="editor-card-badge">Position {cardOrder.indexOf("recipes") + 1}</span>}
      </div>
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
          <span key={idx} className="tag">{ing}<button className="danger" onClick={() => setSelectedIngredients(selectedIngredients.filter((_, i) => i !== idx))}>✕</button></span>
        ))}
      </div>
    </section>
  );

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-brand">
          <Link to="/">🛒 Einkaufsliste</Link>
        </div>
        <div className="navbar-links">
          {session && (
            <>
              <Link to="/settings" className="nav-link">⚙️ Einstellungen</Link>
              <Link to="/offers" className="nav-link">🏷️ Angebote</Link>
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
              <p className="eyebrow">Family Sync{editorMode ? " · Editor-Modus aktiv" : ""}</p>
              <h1>Gemeinsame Einkaufsliste</h1>
              <p className="muted" style={{color:"#cde3e3",marginTop:"0.4rem"}}>Familie: {session.familyName} · Code: {session.familyId}</p>
              <div style={{display:"flex",gap:"0.5rem",marginTop:"0.6rem",flexWrap:"wrap"}}>
                <Link to="/settings" className="btn-inline">⚙️ Einstellungen</Link>
                <Link to="/offers" className="btn-inline">🏷️ Angebote</Link>
                <Link to="/rezepte" className="btn-inline">🍳 Rezepte</Link>
                <button
                  type="button"
                  className="btn-inline"
                  style={{
                    background: editorMode ? "rgba(239,131,84,0.85)" : "rgba(255,255,255,0.2)",
                    border: editorMode ? "2px solid #fff" : "none"
                  }}
                  onClick={() => setEditorMode((v) => !v)}
                  title="Editor-Modus: Karten frei anordnen"
                >
                  {editorMode ? "✅ Editor verlassen" : "✏️ Editor starten"}
                </button>
                {editorMode && (
                  <button type="button" className="btn-inline ghost-btn-inline" onClick={resetCardOrder}>
                    ↺ Reihenfolge zurücksetzen
                  </button>
                )}
                <button
                  type="button"
                  className="btn-inline"
                  style={{
                    background: freeEditor ? "rgba(42,157,143,0.9)" : "rgba(255,255,255,0.2)",
                    border: freeEditor ? "2px solid #fff" : "none"
                  }}
                  onClick={() => setFreeEditor((v) => !v)}
                  title="Free Editor: Karten frei positionieren und skalieren"
                >
                  {freeEditor ? "✅ Free verlassen" : "🎯 Free"}
                </button>
                {freeEditor && (
                  <button type="button" className="btn-inline ghost-btn-inline" onClick={resetFreeLayout}>
                    ↺ Layout zurücksetzen
                  </button>
                )}
              </div>
              {freeEditor && (
                <p style={{marginTop:"0.8rem",padding:"0.6rem 0.9rem",background:"rgba(255,255,255,0.18)",borderRadius:"10px",fontSize:"0.9rem"}}>
                  🎯 Free-Modus: Karten per Ziehen frei platzieren und an der Ecke skalieren (pixelgenau).
                </p>
              )}
            </header>
            {error && <div className="error-banner">{error}</div>}

            <div
              ref={freeCanvasRef}
              className={"dashboard-grid editor-allcards free-canvas" + (freeEditor ? " free-active" : "") + (editorMode ? " editor-active" : "")}
            >
              {cardOrder.map((cardId, idx) => {
                const Comp = CARD_COMPONENTS[cardId];
                if (!Comp) return null;
                const isDragOver = dragOverIdx === idx;
                const fl = freeLayout[cardId];
                const freeStyle = freeEditor && fl ? { position: "absolute", left: fl.x, top: fl.y, width: fl.w, height: fl.h } : {};
                return (
                  <div
                    key={cardId}
                    className={"editor-card-wrap" + (editorMode ? " draggable" : "") + (freeEditor ? " free-draggable" : "") + (isDragOver ? " drag-over" : "")}
                    draggable={editorMode}
                    onDragStart={(e) => editorMode && handleDragStart(e, idx)}
                    onDragOver={(e) => editorMode && handleDragOver(e, idx)}
                    onDragLeave={(e) => editorMode && handleDragLeave(e)}
                    onDrop={(e) => editorMode && handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onPointerDown={(e) => freeEditor && freeMoveStart(e, cardId)}
                    style={freeStyle}
                  >
                    {freeEditor && (
                      <div className="free-resize-handle" onPointerDown={(e) => freeResizeStart(e, cardId)} title="Größe ändern" />
                    )}
                    {editorMode && (
                      <div className="editor-drag-handle" title="Karte verschieben">
                        <span>⋮⋮</span>
                        <span className="editor-pos-label">{idx + 1}</span>
                        <span className="editor-move-label">Verschieben</span>
                      </div>
                    )}
                    <Comp {...cardProps} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
