import axios from "axios";
import * as cheerio from "cheerio";

const TTL_MS = 15 * 60 * 1000;
const cache = new Map();

const SUPPORTED_MARKETS = ["LIDL", "EDEKA", "ALDI", "REWE"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getMondayOf(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getWeekDates(weekOffset = 0) {
  const monday = addDays(getMondayOf(new Date()), weekOffset * 7);
  const sunday = addDays(monday, 6);
  return {
    monday,
    sunday,
    start: `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`,
    end: `${sunday.getFullYear()}-${pad2(sunday.getMonth() + 1)}-${pad2(sunday.getDate())}`,
    startDE: `${pad2(monday.getDate())}.${pad2(monday.getMonth() + 1)}.${monday.getFullYear()}`,
    endDE: `${pad2(sunday.getDate())}.${pad2(sunday.getMonth() + 1)}.${sunday.getFullYear()}`
  };
}

function isNextWeekAvailable() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const hour = today.getHours();
  if (dayOfWeek >= 4 && hour >= 12) return true;
  if (dayOfWeek >= 5) return true;
  return false;
}

const USER_PROVIDED_URLS = {
  LIDL: "https://www.lidl.de/l/prospekte/aktionsprospekt-24-08-2026-29-08-2026-6dfc61/view/flyer/page/1?_ab=1&lf=HHZ",
  EDEKA: "https://www.edeka.de/maerkte/801341/angebote/",
  ALDI: "https://www.aldi-nord.de/angebote.html",
  REWE: "https://www.rewe.de/angebote/burgdorf/540824/rewe-markt-marktstr-27/"
};

const DEFAULT_MARKET_SOURCES = {
  ALDI: {
    label: "ALDI NORD",
    url: USER_PROVIDED_URLS.ALDI
  },
  LIDL: {
    label: "LIDL",
    url: USER_PROVIDED_URLS.LIDL
  },
  EDEKA: {
    label: "EDEKA",
    url: USER_PROVIDED_URLS.EDEKA
  },
  REWE: {
    label: "REWE",
    url: USER_PROVIDED_URLS.REWE
  }
};

function buildWeeklyUrl(market, weekOffset, configuredUrl) {
  const fallback = configuredUrl || DEFAULT_MARKET_SOURCES[market]?.url || "";
  if (weekOffset === 0) return fallback;
  const wk = getWeekDates(weekOffset);
  switch (market) {
    case "LIDL":
      return `https://www.lidl.de/l/prospekte/aktionsprospekt-${wk.start.replace(/-/g, ".")}-${wk.end.replace(/-/g, ".")}/view/flyer/page/1?_ab=1&lf=HHZ`;
    case "EDEKA":
      return USER_PROVIDED_URLS.EDEKA;
    case "ALDI":
      return `https://www.aldi-nord.de/angebote.html?week=${wk.start}`;
    case "REWE":
      return USER_PROVIDED_URLS.REWE;
    default:
      return fallback;
  }
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function extractEuroPrice(text) {
  const match = String(text || "").match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*€/);
  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function absoluteUrl(base, value) {
  if (!value) {
    return null;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("/")) {
    return `${base}${value}`;
  }
  return null;
}

function mergeAndDedupeOffers(entries) {
  const seen = new Set();
  const result = [];

  for (const entry of entries) {
    if (!entry?.url || seen.has(entry.url)) {
      continue;
    }
    seen.add(entry.url);
    result.push(entry);
  }

  return result;
}

function sourceLabelFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "official";
  }
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 FamilyShoppingList/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    timeout: 10000,
    maxRedirects: 5
  });
  return response.data;
}

function extractImgFrom(el, $) {
  let img = $(el).find("img[src]").first();
  if (!img || img.length === 0) {
    img = $(el).find("img[data-src]").first();
  }
  let src = img.attr("src") || img.attr("data-src") || "";
  if (!src) {
    const parentImg = $(el).closest("article, div, li, section").find("img[src]").first();
    src = parentImg.attr("src") || "";
  }
  if (!src) return null;
  if (src.startsWith("http")) return src;
  if (src.startsWith("//")) return "https:" + src;
  return null;
}

function parseAldiOffers(html) {
  const $ = cheerio.load(html);
  const offers = [];
  const seen = new Set();

  $("a[href*='/produkt/'], a[href*='/angebot/'], article a").each((_, element) => {
    if (offers.length >= 220) {
      return;
    }

    const href = absoluteUrl("https://www.aldi-nord.de", $(element).attr("href"));
    if (!href || seen.has(href)) {
      return;
    }

    const text = normalizeWhitespace($(element).text());
    if (!text || !text.includes("€")) {
      return;
    }

    const price = extractEuroPrice(text);
    if (price == null) {
      return;
    }

    seen.add(href);
    offers.push({
      title: text,
      price,
      url: href,
      market: "ALDI",
      source: "ALDI NORD",
      image: extractImgFrom(element, $),
      fetchedAt: new Date().toISOString()
    });
  });

  return offers;
}

function parseGenericOffers(html, market, pageUrl) {
  const $ = cheerio.load(html);
  const offers = [];
  const seen = new Set();
  const base = (() => {
    try {
      const parsed = new URL(pageUrl);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return "";
    }
  })();
  const source = sourceLabelFromUrl(pageUrl);

  $("a[href]").each((_, element) => {
    if (offers.length >= 220) {
      return;
    }

    const href = absoluteUrl(base, $(element).attr("href"));
    if (!href || seen.has(href)) {
      return;
    }

    const title = normalizeWhitespace($(element).text());
    if (!title || title.length < 8 || title.length > 240 || !title.includes("€")) {
      return;
    }

    const context = normalizeWhitespace(
      $(element).closest("article, li, div").text() || title
    );
    const price = extractEuroPrice(`${title} ${context}`);
    if (price == null) {
      return;
    }

    seen.add(href);
    offers.push({
      title,
      price,
      url: href,
      market,
      source,
      image: extractImgFrom(element, $),
      fetchedAt: new Date().toISOString()
    });
  });

  return offers;
}

async function fetchLiveOffersForMarket(market, sourceUrl, weekOffset) {
  const pageUrl = isValidHttpUrl(sourceUrl) ? sourceUrl : buildWeeklyUrl(market, weekOffset);

  if (!pageUrl) {
    return { offers: [], available: false, reason: "Keine URL konfiguriert" };
  }

  if (weekOffset > 0 && !isNextWeekAvailable()) {
    return { offers: [], available: false, reason: "Angebote der nächsten Woche sind noch nicht verfügbar" };
  }

  let html;
  try {
    html = await fetchHtml(pageUrl);
  } catch (e) {
    if (weekOffset > 0) {
      return { offers: [], available: false, reason: "Angebote der nächsten Woche sind noch nicht verfügbar" };
    }
    return { offers: [], available: false, reason: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }

  if (!html || String(html).trim().length < 1000) {
    if (weekOffset > 0) {
      return { offers: [], available: false, reason: "Angebote der nächsten Woche sind noch nicht verfügbar" };
    }
    return { offers: [], available: false, reason: "Leere Seite empfangen" };
  }

  const generic = parseGenericOffers(html, market, pageUrl);

  if (market === "ALDI") {
    const aldiSpecific = parseAldiOffers(html);
    const merged = mergeAndDedupeOffers([...aldiSpecific, ...generic]);
    return { offers: merged, available: true, pageUrl };
  }

  if (generic.length === 0 && weekOffset > 0) {
    return { offers: [], available: false, reason: "Angebote der nächsten Woche sind noch nicht verfügbar" };
  }

  return { offers: generic, available: true, pageUrl };
}

export function getSupportedMarkets() {
  return SUPPORTED_MARKETS.slice();
}

export function getDefaultMarketSource(market) {
  return DEFAULT_MARKET_SOURCES[market]?.url || null;
}

export function getWeekInfo(weekOffset = 0) {
  const wk = getWeekDates(Number(weekOffset) || 0);
  return {
    offset: Number(weekOffset) || 0,
    label: weekOffset === 0 ? "Diese Woche" : `Nächste Woche (+${weekOffset})`,
    start: wk.start,
    end: wk.end,
    startDE: wk.startDE,
    endDE: wk.endDE,
    available: weekOffset === 0 ? true : isNextWeekAvailable()
  };
}

export async function getMarketOffers(market, options = {}) {
  const key = String(market || "").toUpperCase();
  if (!SUPPORTED_MARKETS.includes(key)) {
    return { offers: [], available: false, reason: "Unbekannter Markt" };
  }

  const forceRefresh = Boolean(options.forceRefresh);
  const sourceUrl = isValidHttpUrl(options.sourceUrl) ? options.sourceUrl : "";
  const weekOffset = Math.max(0, Math.min(4, Number(options.weekOffset || 0)));
  const cacheKey = `${key}|${weekOffset}|${sourceUrl ? sourceUrl : "default"}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (!forceRefresh && cached && now - cached.timestamp < TTL_MS) {
    return cached.value;
  }

  try {
    const value = await fetchLiveOffersForMarket(key, sourceUrl, weekOffset);
    cache.set(cacheKey, { timestamp: now, value });
    return value;
  } catch (e) {
    const fallback = cached?.value || { offers: [], available: false, reason: "Fehler beim Abrufen" };
    if (weekOffset > 0 && fallback.offers.length === 0) {
      return { offers: [], available: false, reason: "Angebote der nächsten Woche sind noch nicht verfügbar" };
    }
    return fallback;
  }
}

export async function getLiveOffers(options = {}) {
  const market = String(options.market || "ALL").toUpperCase();
  const offset = Math.max(0, Number(options.offset || 0));
  const limit = Math.max(1, Math.min(50, Number(options.limit || 20)));
  const forceRefresh = Boolean(options.forceRefresh);
  const locations = options.locations || {};
  const weekOffset = Math.max(0, Math.min(4, Number(options.weekOffset || 0)));

  const markets =
    market === "ALL"
      ? SUPPORTED_MARKETS
      : SUPPORTED_MARKETS.filter((entry) => entry === market);

  const marketResults = await Promise.all(
    markets.map(async (entry) => {
      const configuredUrl = locations?.[entry]?.url;
      const result = await getMarketOffers(entry, {
        forceRefresh,
        sourceUrl: configuredUrl,
        weekOffset
      });
      return { market: entry, ...result };
    })
  );

  const allOffers = marketResults
    .flatMap((r) => r.offers || [])
    .sort((a, b) => {
      const aTs = new Date(a.fetchedAt || 0).getTime();
      const bTs = new Date(b.fetchedAt || 0).getTime();
      return bTs - aTs;
    });

  const unavailableMarkets = marketResults
    .filter((r) => r.available === false)
    .map((r) => ({ market: r.market, reason: r.reason }));

  const paged = allOffers.slice(offset, offset + limit);

  return {
    market,
    total: allOffers.length,
    offset,
    limit,
    hasMore: offset + limit < allOffers.length,
    offers: paged,
    week: getWeekInfo(weekOffset),
    unavailableMarkets: unavailableMarkets.length > 0 ? unavailableMarkets : null
  };
}
