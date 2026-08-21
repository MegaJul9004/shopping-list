import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { customAlphabet, nanoid } from "nanoid";
import { Server } from "socket.io";
import {
  addItem,
  addMiniList,
  addRecurringItem,
  addToOfferWatchlist,
  createFamily,
  createUser,
  deleteFamilyBranchLocation,
  deleteItem,
  deleteMiniList,
  deleteRecurringItem,
  getFamilyBranchLocations,
  getFamilyById,
  getFamilyLocations,
  getFamilySettings,
  getMiniLists,
  getOfferWatchlist,
  getUserByFamilyAndUsername,
  getUserById,
  getItemsByFamily,
  getRecurringItemsByFamily,
  removeFromOfferWatchlist,
  saveFamilyBranchLocation,
  setFamilySettings,
  smartAddItem,
  updateItem,
  searchBranchesByZip
} from "./db.js";
import { buildExportByMarket, compareMarkets } from "./offers.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});


function emitItems(familyId) {
  const items = getItemsByFamily(familyId);
  io.to(familyId).emit("itemsSnapshot", items);
}

app.get("/api/branches/search", (req, res) => {
  const zip = String(req.query.zip || "").trim();
  if (!zip) return res.json({ branches: [] });
  try {
    const results = searchBranchesByZip(zip);
    return res.json({ branches: results, query: zip });
  } catch(e) {
    return res.json({ branches: [], error: e.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

function issueToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      familyId: user.familyId,
      username: user.username
    },
    jwtSecret,
    { expiresIn: "30d" }
  );
}

function authMiddleware(req, res, next) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Authorization token missing" });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  const mode = String(req.body?.mode || "").toLowerCase();
  const familyName = String(req.body?.familyName || "").trim();
  const familyIdInput = String(req.body?.familyId || "").trim().toUpperCase();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!["create", "join"].includes(mode)) {
    return res.status(400).json({ error: "mode must be create or join" });
  }

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  let family;
  let familyId;

  if (mode === "create") {
    if (!familyName) {
      return res.status(400).json({ error: "familyName is required for create mode" });
    }
    familyId = familyCode();
    createFamily({ id: familyId, name: familyName });
    family = getFamilyById(familyId);
  } else {
    if (!familyIdInput) {
      return res.status(400).json({ error: "familyId is required for join mode" });
    }
    family = getFamilyById(familyIdInput);
    familyId = familyIdInput;
    if (!family) {
      return res.status(404).json({ error: "Family not found" });
    }
  }

  const existing = getUserByFamilyAndUsername(familyId, username);
  if (existing) {
    return res.status(409).json({ error: "Username already exists in this family" });
  }

  const userId = nanoid(12);
  const passwordHash = await bcrypt.hash(password, 10);
  createUser({ id: userId, familyId, username, passwordHash });

  const token = issueToken({ id: userId, familyId, username });
  return res.status(201).json({
    token,
    user: {
      id: userId,
      username,
      familyId,
      familyName: family.name
    }
  });
});

app.post("/api/auth/login", async (req, res) => {
  const familyId = String(req.body?.familyId || "").trim().toUpperCase();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!familyId || !username || !password) {
    return res.status(400).json({ error: "familyId, username and password are required" });
  }

  const family = getFamilyById(familyId);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }

  const user = getUserByFamilyAndUsername(familyId, username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = issueToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      familyId,
      familyName: family.name
    }
  });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = getUserById(req.auth.userId);
  const family = getFamilyById(req.auth.familyId);

  if (!user || !family) {
    return res.status(401).json({ error: "Session no longer valid" });
  }

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      familyId: user.familyId,
      familyName: family.name
    }
  });
});

app.get("/api/families/:familyId/list", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed for this family" });
  }

  if (!getFamilyById(familyId)) {
    return res.status(404).json({ error: "Family not found" });
  }

  return res.json({ items: getItemsByFamily(familyId) });
});

app.post("/api/families/:familyId/items", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const name = String(req.body?.name || "").trim();
  const rawQuantity = Number(req.body?.quantity ?? 1);
  const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed for this family" });
  }

  if (!getFamilyById(familyId)) {
    return res.status(404).json({ error: "Family not found" });
  }

  if (!name) {
    return res.status(400).json({ error: "Item name is required" });
  }

  const settings = getFamilySettings(familyId);
  const result = smartAddItem({
    id: nanoid(10),
    familyId,
    name,
    quantity,
    duplicateBehavior: settings.duplicateBehavior
  });

  emitItems(familyId);

  return res.status(result.merged ? 200 : 201).json({ ok: true, item: result.item, merged: result.merged });
});

app.patch("/api/families/:familyId/items/:itemId", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const itemId = String(req.params.itemId || "");

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed for this family" });
  }

  if (!getFamilyById(familyId)) {
    return res.status(404).json({ error: "Family not found" });
  }

  const nextChecked =
    typeof req.body?.checked === "boolean" ? req.body.checked : undefined;
  const nextName =
    typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
  const nextQuantity =
    Number.isFinite(Number(req.body?.quantity)) && Number(req.body?.quantity) > 0
      ? Math.floor(Number(req.body.quantity))
      : undefined;

  const result = updateItem({
    itemId,
    familyId,
    name: nextName,
    quantity: nextQuantity,
    checked: nextChecked
  });

  if (!result) {
    return res.status(404).json({ error: "Item not found" });
  }

  emitItems(familyId);
  return res.json({ ok: true });
});

app.delete("/api/families/:familyId/items/:itemId", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const itemId = String(req.params.itemId || "");

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed for this family" });
  }

  if (!getFamilyById(familyId)) {
    return res.status(404).json({ error: "Family not found" });
  }

  const deleted = deleteItem({ itemId, familyId });
  if (!deleted) {
    return res.status(404).json({ error: "Item not found" });
  }

  emitItems(familyId);
  return res.json({ ok: true });
});

// â”€â”€ Wiederkehrende Artikel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/families/:familyId/recurring", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed for this family" });
  }

  return res.json({ recurringItems: getRecurringItemsByFamily(familyId) });
});

app.post("/api/families/:familyId/recurring", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const name = String(req.body?.name || "").trim();
  const rawQuantity = Number(req.body?.quantity ?? 1);
  const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;
  const dayOfWeek =
    Number.isInteger(Number(req.body?.dayOfWeek)) &&
    Number(req.body?.dayOfWeek) >= 0 &&
    Number(req.body?.dayOfWeek) <= 6
      ? Number(req.body.dayOfWeek)
      : 1;

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed for this family" });
  }

  if (!name) {
    return res.status(400).json({ error: "Item name is required" });
  }

  addRecurringItem({ id: nanoid(10), familyId, name, quantity, dayOfWeek });

  return res.status(201).json({ ok: true });
});

app.delete(
  "/api/families/:familyId/recurring/:itemId",
  authMiddleware,
  (req, res) => {
    const familyId = String(req.params.familyId || "").toUpperCase();
    const itemId = String(req.params.itemId || "");

    if (req.auth.familyId !== familyId) {
      return res.status(403).json({ error: "Not allowed for this family" });
    }

    const deleted = deleteRecurringItem({ itemId, familyId });
    if (!deleted) {
      return res.status(404).json({ error: "Recurring item not found" });
    }

    return res.json({ ok: true });
  }
);

// â”€â”€ Markt-Standorte / Filialen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/families/:familyId/locations", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed for this family" });
  }

  return res.json({ locations: getFamilyLocations(familyId) });
});

app.get("/api/families/:familyId/branches", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  return res.json({ branches: getFamilyBranchLocations(familyId) });
});

app.post("/api/families/:familyId/branches/:market", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const market = String(req.params.market || "").trim().toUpperCase();

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const saved = saveFamilyBranchLocation({
    familyId,
    market,
    branchName: req.body?.branchName,
    branchCity: req.body?.branchCity,
    branchZip: req.body?.branchZip,
    branchId: req.body?.branchId,
    locationUrl: req.body?.locationUrl
  });
  return res.json({ branch: saved });
});

app.delete("/api/families/:familyId/branches/:market", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const market = String(req.params.market || "").trim().toUpperCase();
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  deleteFamilyBranchLocation({ familyId, market });
  return res.json({ ok: true });
});

// â”€â”€ Legacy: einfache Standorte (Weiterleitung an Branches) â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post("/api/families/:familyId/locations", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const market = String(req.body?.market || "").trim().toUpperCase();
  const locationName = String(req.body?.locationName || "").trim();
  const locationUrl = String(req.body?.locationUrl || "").trim();

  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const saved = saveFamilyBranchLocation({ familyId, market, branchName: locationName, locationUrl });
  return res.status(201).json({ location: saved });
});

app.get("/api/offers/locations", (_req, res) => {
  const locations = {};
  for (const market of getSupportedMarkets()) {
    const defaultUrl = getDefaultMarketSource(market);
    if (defaultUrl) {
      locations[market] = [{ name: market, url: defaultUrl }];
    }
  }
  return res.json({ locations });
});

// â”€â”€ Family Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/families/:familyId/settings", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  return res.json({ settings: getFamilySettings(familyId) });
});

app.post("/api/families/:familyId/settings", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const updated = setFamilySettings({
    familyId,
    duplicateBehavior: req.body?.duplicateBehavior
  });
  return res.json({ settings: updated });
});

// â”€â”€ Mini-Lists / Recipes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/families/:familyId/mini-lists", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  return res.json({ miniLists: getMiniLists(familyId) });
});

app.post("/api/families/:familyId/mini-lists", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const name = String(req.body?.name || "").trim();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!name || items.length === 0) {
    return res.status(400).json({ error: "name and items are required" });
  }
  addMiniList({ id: nanoid(10), familyId, name, items });
  return res.status(201).json({ ok: true });
});

app.delete("/api/families/:familyId/mini-lists/:listId", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const listId = String(req.params.listId || "");
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const deleted = deleteMiniList({ listId, familyId });
  if (!deleted) {
    return res.status(404).json({ error: "List not found" });
  }
  return res.json({ ok: true });
});

// â”€â”€ Offer Watchlist â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/families/:familyId/offer-watchlist", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  return res.json({ watchlist: getOfferWatchlist(familyId) });
});

app.post("/api/families/:familyId/offer-watchlist", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const searchTerm = String(req.body?.searchTerm || "").trim();
  if (!searchTerm) {
    return res.status(400).json({ error: "searchTerm is required" });
  }
  addToOfferWatchlist({ id: nanoid(10), familyId, searchTerm });
  return res.status(201).json({ ok: true });
});

app.delete("/api/families/:familyId/offer-watchlist/:watchId", authMiddleware, (req, res) => {
  const familyId = String(req.params.familyId || "").toUpperCase();
  const watchId = String(req.params.watchId || "");
  if (req.auth.familyId !== familyId) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const deleted = removeFromOfferWatchlist({ watchId, familyId });
  if (!deleted) {
    return res.status(404).json({ error: "Watchlist entry not found" });
  }
  return res.json({ ok: true });
});

// â”€â”€ Recipe Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get("/api/recipes/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Query q is required" });
  }

  try {
    const recipes = await searchChefkoch(query);
    return res.json({ recipes });
  } catch (error) {
    return res.status(502).json({
      error: "Chefkoch search is currently unavailable",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/api/recipes/by-ingredients", async (req, res) => {
  const ingredientsRaw = String(req.query.ingredients || "");
  const ingredients = ingredientsRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (ingredients.length === 0) {
    return res.status(400).json({ error: "At least one ingredient is required" });
  }

  const searchQuery = ingredients.slice(0, 5).join(" ");
  try {
    const recipes = await searchChefkoch(searchQuery);
    return res.json({
      ingredients,
      recipes
    });
  } catch (error) {
    return res.status(502).json({
      error: "Chefkoch search is currently unavailable",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("/api/offers/markets", (_req, res) => {
  return res.json({ markets: getSupportedMarkets() });
});

app.get("/api/offers/live", async (req, res) => {
  const market = String(req.query.market || "ALL").toUpperCase();
  const offset = Number(req.query.offset || 0);
  const limit = Number(req.query.limit || 20);
  const forceRefresh = String(req.query.refresh || "0") === "1";

  const payload = await getLiveOffers({
    market,
    offset,
    limit,
    forceRefresh
  });

  return res.json(payload);
});

app.get("/api/offers/compare", authMiddleware, async (req, res) => {
  const markets = String(req.query.markets || "")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);

  const items = getItemsByFamily(req.auth.familyId);
  const livePairs = await Promise.all(
    markets.map(async (market) => {
      const offers = await getMarketOffers(market, { forceRefresh: false });
      return [market, offers];
    })
  );

  const liveOffersByMarket = Object.fromEntries(livePairs);
  const comparison = compareMarkets(items, markets, liveOffersByMarket);
  return res.json(comparison);
});

app.get("/api/offers/export", authMiddleware, async (req, res) => {
  const markets = String(req.query.markets || "")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);

  const items = getItemsByFamily(req.auth.familyId);
  const livePairs = await Promise.all(
    markets.map(async (market) => {
      const offers = await getMarketOffers(market, { forceRefresh: false });
      return [market, offers];
    })
  );
  const liveOffersByMarket = Object.fromEntries(livePairs);
  const comparison = compareMarkets(items, markets, liveOffersByMarket);
  const grouped = buildExportByMarket(comparison);

  const rows = [];
  for (const [market, marketItems] of Object.entries(grouped)) {
    for (const item of marketItems) {
      rows.push({
        market,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        source: item.source
      });
    }
  }

  const csvHeader = "market,item,quantity,unitPrice,totalPrice,source";
  const csvRows = rows.map((entry) => {
    const escapedName = `"${String(entry.itemName).replaceAll('"', '""')}"`;
    return [
      entry.market,
      escapedName,
      entry.quantity,
      entry.unitPrice ?? "",
      entry.totalPrice ?? "",
      entry.source ?? ""
    ].join(",");
  });

  const csv = [csvHeader, ...csvRows].join("\n");
  const format = String(req.query.format || "json").toLowerCase();

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=einkauf-nach-markt.csv"
    );
    return res.send(csv);
  }

  return res.json({
    generatedAt: new Date().toISOString(),
    recommendedMarket: comparison.recommendation?.market || null,
    rows,
    csv
  });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
>>>>>>> e51af1626bfc7b84fa0b1dab8162f4aaa1fb7247
});

