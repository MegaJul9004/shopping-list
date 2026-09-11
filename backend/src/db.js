import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "shopping.json");

function defaultStore() {
  return {
    families: [],
    users: [],
    shoppingItems: [],
    recurringItems: [],
    familyLocations: [],
    familySettings: [],
    miniLists: [],
    offerWatchlist: [],
    savedRecipes: [],
    nextUserNumber: 1,
    appConfig: {
      sponsor: {
        iban: "",
        bic: "",
        beneficiary: "",
        purpose: ""
      }
    }
  };
}

function loadStore() {
  if (!fs.existsSync(dbPath)) {
    const initial = defaultStore();
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }

  const raw = fs.readFileSync(dbPath, "utf8");
  if (!raw.trim()) {
    return defaultStore();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      families: Array.isArray(parsed.families) ? parsed.families : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      shoppingItems: Array.isArray(parsed.shoppingItems) ? parsed.shoppingItems : [],
      recurringItems: Array.isArray(parsed.recurringItems) ? parsed.recurringItems : [],
      familyLocations: Array.isArray(parsed.familyLocations) ? parsed.familyLocations : [],
      familySettings: Array.isArray(parsed.familySettings) ? parsed.familySettings : [],
      miniLists: Array.isArray(parsed.miniLists) ? parsed.miniLists : [],
      offerWatchlist: Array.isArray(parsed.offerWatchlist) ? parsed.offerWatchlist : [],
      savedRecipes: Array.isArray(parsed.savedRecipes) ? parsed.savedRecipes : [],
      nextUserNumber: Number.isFinite(Number(parsed.nextUserNumber)) ? Number(parsed.nextUserNumber) : 1,
      appConfig: parsed.appConfig && typeof parsed.appConfig === "object" ? parsed.appConfig : { sponsor: { iban: "", bic: "", beneficiary: "", purpose: "" } }
    };
  } catch {
    return defaultStore();
  }
}

let store = loadStore();

// Migration: Bestehenden Nutzern ohne userNumber eine fortlaufende Nummer geben,
// damit addedBy (username#nutzernummer) und die Rollen-Dateien korrekt funktionieren.
(function migrateUserNumbers() {
  let next = Number(store.nextUserNumber) || 1;
  for (const u of store.users) {
    if (!Number.isFinite(Number(u.userNumber))) {
      u.userNumber = next++;
    }
  }
  store.nextUserNumber = next;
  persist();
})();

function persist() {
  fs.writeFileSync(dbPath, JSON.stringify(store, null, 2), "utf8");
}

export function getFamilyById(familyId) {
  return store.families.find((family) => family.id === familyId) || null;
}

export function createFamily({ id, name }) {
  store.families.push({
    id,
    name,
    createdAt: new Date().toISOString()
  });
  persist();
}

export function createUser({ id, familyId, username, passwordHash, familyRole = "member" }) {
  const userNumber = store.nextUserNumber || 1;
  store.nextUserNumber = userNumber + 1;
  store.users.push({
    id,
    familyId,
    username,
    userNumber,
    passwordHash,
    familyRole,
    prefs: {
      showAddedBy: false
    },
    createdAt: new Date().toISOString()
  });
  persist();
  return { id, familyId, username, userNumber, familyRole };
}

export function getUserByFamilyAndUsername(familyId, username) {
  return (
    store.users.find(
      (user) => user.familyId === familyId && user.username === username
    ) || null
  );
}

export function getUserById(userId) {
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    familyId: user.familyId,
    username: user.username,
    userNumber: user.userNumber,
    familyRole: user.familyRole || "member",
    prefs: user.prefs || { showAddedBy: false },
    createdAt: user.createdAt
  };
}

export function getUserNumbers() {
  return store.users.map((u) => ({ username: u.username, userNumber: u.userNumber }));
}

export function getAllUsers() {
  return store.users.map((u) => ({
    id: u.id,
    familyId: u.familyId,
    username: u.username,
    userNumber: u.userNumber,
    familyRole: u.familyRole || "member"
  }));
}

export function getUsersByFamily(familyId) {
  return store.users
    .filter((u) => u.familyId === familyId)
    .map((u) => ({
      id: u.id,
      username: u.username,
      userNumber: u.userNumber,
      familyRole: u.familyRole || "member",
      createdAt: u.createdAt
    }));
}

export function getUserByNumber(userNumber) {
  return store.users.find((u) => u.userNumber === Number(userNumber)) || null;
}

export function getUserPrefs(userId) {
  const u = store.users.find((e) => e.id === userId);
  if (!u) return null;
  return u.prefs || { showAddedBy: false };
}

export function setUserPrefs(userId, prefs) {
  const u = store.users.find((e) => e.id === userId);
  if (!u) return null;
  u.prefs = {
    showAddedBy: typeof prefs?.showAddedBy === "boolean" ? prefs.showAddedBy : (u.prefs?.showAddedBy || false)
  };
  persist();
  return u.prefs;
}

export function setFamilyRole(userId, role) {
  const idx = store.users.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  store.users[idx].familyRole = role;
  persist();
  return store.users[idx];
}

// Entfernt einen Nutzer samt seiner zugehoerigen Eintraege aus der Familie
export function removeUserFromFamily(userId) {
  const before = store.users.length;
  store.users = store.users.filter((u) => u.id !== userId);
  const changed = store.users.length < before;
  if (changed) persist();
  return changed;
}

export function getItemsByFamily(familyId) {
  return store.shoppingItems
    .filter((item) => item.familyId === familyId)
    .sort((a, b) => {
      if (a.checked !== b.checked) {
        return Number(a.checked) - Number(b.checked);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function addItem({ id, familyId, name, quantity, addedBy }) {
  store.shoppingItems.push({
    id,
    familyId,
    name,
    quantity,
    checked: false,
    addedBy: addedBy || null,
    createdAt: new Date().toISOString()
  });
  persist();
}

export function updateItem({ itemId, familyId, name, quantity, checked }) {
  const index = store.shoppingItems.findIndex(
    (item) => item.id === itemId && item.familyId === familyId
  );

  if (index < 0) {
    return null;
  }

  const item = store.shoppingItems[index];
  const isChecked = typeof checked === "boolean" ? checked : item.checked;
  const next = {
    ...item,
    name: name ?? item.name,
    quantity: quantity ?? item.quantity,
    checked: isChecked,
    checkedAt: isChecked
      ? (item.checked ? item.checkedAt : new Date().toISOString())
      : undefined
  };

  store.shoppingItems[index] = next;
  persist();
  return next;
}

export function deleteItem({ itemId, familyId }) {
  const before = store.shoppingItems.length;
  store.shoppingItems = store.shoppingItems.filter(
    (item) => !(item.id === itemId && item.familyId === familyId)
  );

  const changed = store.shoppingItems.length < before;
  if (changed) {
    persist();
  }

  return changed;
}

export function deleteDoneItems(familyId) {
  const before = store.shoppingItems.length;
  store.shoppingItems = store.shoppingItems.filter(
    (item) => !(item.familyId === familyId && item.checked)
  );
  const changed = store.shoppingItems.length < before;
  if (changed) persist();
  return changed;
}

// Löscht abgehakte Artikel, die länger als autoDeleteAfterHours abgehakt sind.
// Artikel ohne checkedAt (Legacy) werden nie automatisch gelöscht.
export function cleanupExpiredDoneItems(familyId, autoDeleteAfterHours = 0) {
  const hours = Number(autoDeleteAfterHours) || 0;
  if (hours <= 0) return false;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const before = store.shoppingItems.length;
  store.shoppingItems = store.shoppingItems.filter((item) => {
    if (item.familyId !== familyId) return true;
    if (!item.checked) return true;
    const at = item.checkedAt ? new Date(item.checkedAt).getTime() : NaN;
    if (!Number.isFinite(at)) return true;
    return at >= cutoff;
  });
  const changed = store.shoppingItems.length < before;
  if (changed) persist();
  return changed;
}

export function getRecurringItemsByFamily(familyId) {
  return store.recurringItems
    .filter((item) => item.familyId === familyId)
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) {
        return Number(a.dayOfWeek) - Number(b.dayOfWeek);
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

export function addRecurringItem({ id, familyId, name, quantity, dayOfWeek, duplicateBehavior }) {
  // Smart-Merge analog zur Einkaufsliste: bei "merge" identische Artikel am gleichen Tag kombinieren
  const smart = duplicateBehavior === "merge";
  if (smart) {
    const norm = name.toLowerCase().replace(/ß/g, "ss").trim();
    const existing = store.recurringItems.find(
      (r) =>
        r.familyId === familyId &&
        r.dayOfWeek === dayOfWeek &&
        r.name.toLowerCase().replace(/ß/g, "ss").trim() === norm
    );
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (quantity || 1);
      persist();
      return { merged: true, item: existing };
    }
  }
  store.recurringItems.push({
    id,
    familyId,
    name,
    quantity,
    dayOfWeek,
    createdAt: new Date().toISOString()
  });
  persist();
  return { merged: false, item: store.recurringItems[store.recurringItems.length - 1] };
}

export function deleteRecurringItem({ itemId, familyId }) {
  const before = store.recurringItems.length;
  store.recurringItems = store.recurringItems.filter(
    (item) => !(item.id === itemId && item.familyId === familyId)
  );

  const changed = store.recurringItems.length < before;
  if (changed) {
    persist();
  }

  return changed;
}

export function getFamilyLocations(familyId) {
  return store.familyLocations.filter((entry) => entry.familyId === familyId);
}

export function setFamilyLocation({ familyId, market, locationName, locationUrl }) {
  const index = store.familyLocations.findIndex(
    (entry) => entry.familyId === familyId && entry.market === market
  );

  if (index >= 0) {
    store.familyLocations[index] = {
      ...store.familyLocations[index],
      locationName,
      locationUrl
    };
  } else {
    store.familyLocations.push({
      familyId,
      market,
      locationName,
      locationUrl
    });
  }

  persist();
  return store.familyLocations.find(
    (entry) => entry.familyId === familyId && entry.market === market
  );
}
// ── Family Settings ─────────────────────────────────────────────────
// ── Extended Branch Locations (PLZ, Ort, Filial-ID) ────────────────
export function getFamilyBranchLocations(familyId) {
  const entries = store.familyLocations.filter((entry) => entry.familyId === familyId);
  const result = {};
  for (const e of entries) {
    result[e.market] = {
      market: e.market,
      branchName: e.branchName || e.locationName || "",
      branchCity: e.branchCity || "",
      branchZip: e.branchZip || "",
      branchId: e.branchId || "",
      locationUrl: e.locationUrl || ""
    };
  }
  return result;
}

export function saveFamilyBranchLocation({ familyId, market, branchName, branchCity, branchZip, branchId, locationUrl }) {
  const index = store.familyLocations.findIndex(
    (entry) => entry.familyId === familyId && entry.market === market
  );
  const payload = {
    familyId,
    market,
    branchName: String(branchName || "").trim(),
    branchCity: String(branchCity || "").trim(),
    branchZip: String(branchZip || "").trim(),
    branchId: String(branchId || "").trim(),
    locationUrl: String(locationUrl || "").trim()
  };

  if (index >= 0) {
    store.familyLocations[index] = payload;
  } else {
    store.familyLocations.push(payload);
  }
  persist();
  return payload;
}

export function deleteFamilyBranchLocation({ familyId, market }) {
  const before = store.familyLocations.length;
  store.familyLocations = store.familyLocations.filter(
    (e) => !(e.familyId === familyId && e.market === market)
  );
  const changed = store.familyLocations.length < before;
  if (changed) persist();
  return changed;
}
export function getFamilySettings(familyId) {
  const entry = store.familySettings.find((s) => s.familyId === familyId);
  if (entry) {
    return { ...entry, autoDeleteAfterHours: Number(entry.autoDeleteAfterHours) || 0 };
  }
  return { familyId, duplicateBehavior: "merge", autoDeleteAfterHours: 0 };
}

export function setFamilySettings({ familyId, duplicateBehavior, autoDeleteAfterHours }) {
  const index = store.familySettings.findIndex((s) => s.familyId === familyId);
  const existing = index >= 0 ? store.familySettings[index] : {};
  const payload = {
    familyId,
    duplicateBehavior: duplicateBehavior === "separate" ? "separate" : (existing.duplicateBehavior || "merge"),
    autoDeleteAfterHours: Number.isFinite(Number(autoDeleteAfterHours)) && Number(autoDeleteAfterHours) > 0 ? Math.floor(Number(autoDeleteAfterHours)) : 0
  };


  if (index >= 0) {
    store.familySettings[index] = payload;
  } else {
    store.familySettings.push(payload);
  }

  persist();
  return payload;
}

// ── Smart Add Item (mit Duplikat-Erkennung) ─────────────────────────
export function smartAddItem({ id, familyId, name, quantity, duplicateBehavior, addedBy }) {
  const normalized = name.toLowerCase().replace(/ß/g, "ss").trim();

  const existing = store.shoppingItems.find(
    (item) =>
      item.familyId === familyId &&
      !item.checked &&
      item.name.toLowerCase().replace(/ß/g, "ss").trim() === normalized
  );

  if (existing && duplicateBehavior === "merge") {
    existing.quantity += quantity;
    persist();
    return { merged: true, item: existing };
  }

  store.shoppingItems.push({
    id,
    familyId,
    name,
    quantity,
    checked: false,
    addedBy: addedBy || null,
    createdAt: new Date().toISOString()
  });
  persist();
  return { merged: false, item: store.shoppingItems[store.shoppingItems.length - 1] };
}

// ── Mini-Lists / Recipes ────────────────────────────────────────────
export function getMiniLists(familyId) {
  return store.miniLists
    .filter((ml) => ml.familyId === familyId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addMiniList({ id, familyId, name, items }) {
  store.miniLists.push({
    id,
    familyId,
    name,
    items: Array.isArray(items) ? items : [],
    createdAt: new Date().toISOString()
  });
  persist();
}

export function deleteMiniList({ listId, familyId }) {
  const before = store.miniLists.length;
  store.miniLists = store.miniLists.filter(
    (ml) => !(ml.id === listId && ml.familyId === familyId)
  );
  const changed = store.miniLists.length < before;
  if (changed) persist();
  return changed;
}

export function updateMiniList({ listId, familyId, name, items }) {
  const index = store.miniLists.findIndex(
    (ml) => ml.id === listId && ml.familyId === familyId
  );
  if (index < 0) return null;
  const existing = store.miniLists[index];
  store.miniLists[index] = {
    ...existing,
    name: name ?? existing.name,
    items: Array.isArray(items) ? items : existing.items
  };
  persist();
  return store.miniLists[index];
}

// ── Gespeicherte Rezepte ─────────────────────────────────────────────
export function getSavedRecipes(familyId) {
  return store.savedRecipes
    .filter((r) => r.familyId === familyId)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
}

export function getSavedRecipe({ recipeId, familyId }) {
  return store.savedRecipes.find((r) => r.id === recipeId && r.familyId === familyId) || null;
}

export function addSavedRecipe({ id, familyId, title, image, url, servings, ingredients, instructions, source }) {
  const now = new Date().toISOString();
  store.savedRecipes.push({
    id,
    familyId,
    title,
    image: image || null,
    url: url || null,
    servings: Number(servings) || 4,
    ingredients: Array.isArray(ingredients) ? ingredients : [],
    instructions: Array.isArray(instructions) ? instructions : [],
    source: source || "chefkoch",
    createdAt: now,
    updatedAt: now
  });
  persist();
  return store.savedRecipes[store.savedRecipes.length - 1];
}

export function updateSavedRecipe({ recipeId, familyId, title, image, servings, ingredients, instructions }) {
  const index = store.savedRecipes.findIndex((r) => r.id === recipeId && r.familyId === familyId);
  if (index < 0) return null;
  const r = store.savedRecipes[index];
  const next = {
    ...r,
    title: title ?? r.title,
    image: image ?? r.image,
    servings: servings != null ? Number(servings) : r.servings,
    ingredients: Array.isArray(ingredients) ? ingredients : r.ingredients,
    instructions: Array.isArray(instructions) ? instructions : r.instructions,
    updatedAt: new Date().toISOString()
  };
  store.savedRecipes[index] = next;
  persist();
  return next;
}

export function deleteSavedRecipe({ recipeId, familyId }) {
  const before = store.savedRecipes.length;
  store.savedRecipes = store.savedRecipes.filter((r) => !(r.id === recipeId && r.familyId === familyId));
  const changed = store.savedRecipes.length < before;
  if (changed) persist();
  return changed;
}

// ── Offer Watchlist ─────────────────────────────────────────────────
export function getOfferWatchlist(familyId) {
  return store.offerWatchlist.filter((e) => e.familyId === familyId);
}

export function addToOfferWatchlist({ id, familyId, searchTerm }) {
  store.offerWatchlist.push({
    id,
    familyId,
    searchTerm: String(searchTerm || "").trim(),
    createdAt: new Date().toISOString()
  });
  persist();
}

export function removeFromOfferWatchlist({ watchId, familyId }) {
  const before = store.offerWatchlist.length;
  store.offerWatchlist = store.offerWatchlist.filter(
    (e) => !(e.id === watchId && e.familyId === familyId)
  );
  const changed = store.offerWatchlist.length < before;
  if (changed) persist();
  return changed;
}

// -- App Config / Spenden -----------------------------
export function getAppConfig() {
  return store.appConfig || { sponsor: { iban: "", bic: "", beneficiary: "", purpose: "" } };
}

export function setSponsorInfo({ iban, bic, beneficiary, purpose }) {
  const cfg = store.appConfig || { sponsor: {} };
  cfg.sponsor = {
    iban: iban ?? cfg.sponsor?.iban ?? "",
    bic: bic ?? cfg.sponsor?.bic ?? "",
    beneficiary: beneficiary ?? cfg.sponsor?.beneficiary ?? "",
    purpose: purpose ?? cfg.sponsor?.purpose ?? ""
  };
  store.appConfig = cfg;
  persist();
  return cfg.sponsor;
}

// -- Branch search -------------------------------------
import { searchBranchesByZip as _searchBranchesByZip } from "./branchData.js";
export { _searchBranchesByZip as searchBranchesByZip };
