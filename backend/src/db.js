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
    offerWatchlist: []
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
      offerWatchlist: Array.isArray(parsed.offerWatchlist) ? parsed.offerWatchlist : []
    };
  } catch {
    return defaultStore();
  }
}

let store = loadStore();

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

export function createUser({ id, familyId, username, passwordHash }) {
  store.users.push({
    id,
    familyId,
    username,
    passwordHash,
    createdAt: new Date().toISOString()
  });
  persist();
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
    createdAt: user.createdAt
  };
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

export function addItem({ id, familyId, name, quantity }) {
  store.shoppingItems.push({
    id,
    familyId,
    name,
    quantity,
    checked: false,
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
  const next = {
    ...item,
    name: name ?? item.name,
    quantity: quantity ?? item.quantity,
    checked: typeof checked === "boolean" ? checked : item.checked
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

export function addRecurringItem({ id, familyId, name, quantity, dayOfWeek }) {
  store.recurringItems.push({
    id,
    familyId,
    name,
    quantity,
    dayOfWeek,
    createdAt: new Date().toISOString()
  });
  persist();
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
export function getFamilySettings(familyId) {
  const entry = store.familySettings.find((s) => s.familyId === familyId);
  return entry || { familyId, duplicateBehavior: "merge" };
}

export function setFamilySettings({ familyId, duplicateBehavior }) {
  const index = store.familySettings.findIndex((s) => s.familyId === familyId);
  const payload = {
    familyId,
    duplicateBehavior: duplicateBehavior === "separate" ? "separate" : "merge"
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
export function smartAddItem({ id, familyId, name, quantity, duplicateBehavior }) {
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
