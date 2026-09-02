import axios from "axios";

/**
 * offersService.js
 * fetchStoreOffers(storeName, zipCode): Holt Angebote über die inoffizielle
 * LIDL-Recoommendations-API. Reine recommendationItems (nur itemId) werden über
 * die Produktseiten-LD+JSON in Titel/Preis/Bild aufgelöst.
 * Robust: 5s-Timeout, Fehler -> leeres [], 30-Min-In-Memory-Cache je Liste & Produkt.
 */

const RECOMMENDATIONS_URL =
  "https://recommendations.lidl-shop.com/r/api/recommendations/DE/de/web/bestsellers/allproducts";
const DEFAULT_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_DETAIL_IDS = 20;
const DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();
const detailCache = new Map();
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";

function buildUrl(zipCode) {
  const url = new URL(RECOMMENDATIONS_URL);
  url.searchParams.set("limit", String(DEFAULT_LIMIT));
  if (zipCode) url.searchParams.set("plz", String(zipCode).trim());
  return url.toString();
}

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  return undefined;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const n = value.replace("€", "").replace(/\s/g, "").replace(".", "").replace(",", ".").trim();
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

function toImageUrl(value) {
  if (!value) return null;
  let url = String(value);
  if (url.startsWith("//")) url = "https:" + url;
  return /^https?:\/\//.test(url) ? url : null;
}

function findItemsRecursive(node, depth = 0) {
  if (depth > 6 || !node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    if (node.length > 0 && typeof node[0] === "object" && node[0] !== null) {
      const s = JSON.stringify(node[0]).toLowerCase();
      if (/(price|title|name|product|itemid)/.test(s)) return node;
    }
    return null;
  }
  const priority = ["recommendationItems", "items", "products", "results", "data", "recommendations", "content", "entries"];
  for (const key of priority) {
    if (node[key] !== undefined) {
      const f = findItemsRecursive(node[key], depth + 1);
      if (f) return f;
    }
  }
  for (const key of Object.keys(node)) {
    if (priority.includes(key)) continue;
    const f = findItemsRecursive(node[key], depth + 1);
    if (f) return f;
  }
  return null;
}

function mapItem(raw, storeName, index, total) {
  const id = pick(raw, ["id", "itemId", "productId", "ean"]) ?? raw?.product?.id ?? `${storeName}-${total}-${index}`;
  const title = pick(raw, ["title", "name", "productTitle", "productName"]) ?? raw?.product?.title ?? "";
  const priceObj = pick(raw, ["price", "currentPrice", "priceValue", "amount"]) ?? raw?.price ?? raw?.product?.price;
  const priceVal = typeof priceObj === "object" && priceObj !== null ? pick(priceObj, ["value", "price", "amount"]) : priceObj;
  const img = pick(raw, ["image", "imageUrl", "img"]) ?? (raw?.images ? (Array.isArray(raw.images) ? raw.images[0] : raw.images) : null);
  const imgStr = typeof img === "object" && img !== null ? pick(img, ["url", "src", "href"]) : img;
  return {
    id: String(id),
    title: String(title || "").replace(/\s+/g, " ").trim(),
    price: toNumber(priceVal),
    imageUrl: toImageUrl(imgStr),
    store: storeName || "LIDL"
  };
}

async function findProductUrl(itemId) {
  const res = await axios.get("https://www.lidl.de/de/search?q=" + encodeURIComponent(itemId), {
    headers: { "User-Agent": UA, Accept: "application/json" },
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 3
  });
  const m = String(res.data).match(/url=([^"\s>]+)/);
  if (m && m[1]) return m[1].startsWith("http") ? m[1] : "https://www.lidl.de" + m[1];
  return null;
}

async function fetchLidlProduct(itemId) {
  const cached = detailCache.get(itemId);
  if (cached && Date.now() - cached.timestamp < DETAIL_CACHE_TTL_MS) return cached.value;
  let result = null;
  try {
    const productUrl = await findProductUrl(itemId);
    if (!productUrl) return null;
    const res = await axios.get(productUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      timeout: REQUEST_TIMEOUT_MS * 2,
      maxRedirects: 5
    });
    const block = (String(res.data).match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i) || [])[1];
    if (block) {
      const parsed = JSON.parse(block);
      const name = parsed?.name;
      const image = Array.isArray(parsed?.image) ? parsed.image[0] : parsed?.image;
      const offer = Array.isArray(parsed?.offers) ? parsed.offers[0] : parsed?.offers;
      const price = offer ? toNumber(offer.price) : null;
      if (name && price != null) {
        result = {
          id: String(itemId),
          title: String(name).trim(),
          price,
          imageUrl: toImageUrl(image),
          store: "LIDL",
          url: parsed?.url || productUrl
        };
      }
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) console.warn(`[offersService] Detail ${itemId} (${err.response.status})`);
    result = null;
  }
  detailCache.set(itemId, { timestamp: Date.now(), value: result });
  return result;
}

async function resolveProductDetails(ids, storeName) {
  const results = [];
  for (let i = 0; i < ids.length; i += 5) {
    const settled = await Promise.all(ids.slice(i, i + 5).map((id) => fetchLidlProduct(id)));
    for (const p of settled) if (p) results.push({ ...p, store: storeName || "LIDL" });
  }
  return results;
}

export async function fetchStoreOffers(storeName = "LIDL", zipCode = "") {
  const cacheKey = `${String(storeName).toUpperCase()}|${String(zipCode).trim()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.value;

  const headers = {
    "User-Agent": "ShoppingList/1.0 (Android; 14)",
    Accept: "application/json",
    Referer: "https://www.lidl.de/",
    "Accept-Language": "de-DE,de;q=0.9"
  };

  let offers = [];
  try {
    const response = await axios.get(buildUrl(zipCode), { headers, timeout: REQUEST_TIMEOUT_MS });
    const data = response.data;
    const items = findItemsRecursive(data) ?? [];
    const total = pick(data, ["total", "totalCount"]) || items.length;
    const hasOnlyIds = items.length > 0 && items.every((it) => it && it.itemId && !it.title && !it.price);
    if (hasOnlyIds) {
      const ids = items.map((it) => String(it.itemId)).filter(Boolean).slice(0, MAX_DETAIL_IDS);
      offers = await resolveProductDetails(ids, storeName);
    } else {
      offers = items.map((raw, idx) => mapItem(raw, storeName, idx, total)).filter((o) => o && o.title && o.price != null);
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.warn(`[offersService] ${storeName} fehlgeschlagen (${err.response?.status || "network/Timeout"}): ${err.message}`);
    } else {
      console.warn(`[offersService] ${storeName} unerwarteter Fehler: ${err.message}`);
    }
    offers = [];
  }

  cache.set(cacheKey, { timestamp: Date.now(), value: offers });
  return offers;
}