import axios from "axios";
import * as cheerio from "cheerio";
import { getAldiOffers, getEdekaOffers, getReweOffers, getLidlOffers } from "./marketApis.js";

// Lazy Playwright-Import (wird erst beim ersten Browser-Rendering geladen)
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    try {
      const { chromium } = await import("playwright");
      // headless: true nutzt Chromium Headless Shell; headless: false = voller Chrome für Bot-Schutz-Websites
      browserPromise = chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--lang=de-DE,de"
        ]
      });
    } catch (e) {
      console.warn("Playwright nicht verfügbar, Fallback auf statisches Fetch:", e.message);
      browserPromise = null;
    }
  }
  return browserPromise;
}

function looksLikeRenderedPage(html) {
  const h = String(html || "");
  if (h.trim().length < 1000) return false;
  // Wenn keine Preise/Cent-Werte enthalten -> Verdacht auf SPA / nicht gerendert
  const hasPriceHint = /€|EUR|\d[.,]\d{2}/.test(h);
  const hasBotPage = /just a moment|cf-browser-verification|access denied|captcha/i.test(h);
  return hasPriceHint && !hasBotPage;
}

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
  // Erlaubt auch Varianten wie "12,99EUR", "1,09 € /100g", "(2.49)"
  const match = String(text || "").match(/(?:€|EUR|euro)\s*(\d{1,3}(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|EUR|euro)/i);
  const rawValue = match ? (match[1] || match[2]) : null;
  if (rawValue == null) {
    return null;
  }
  const value = Number(rawValue.replace(",", "."));
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

async function renderWithBrowser(url) {
  const browser = await getBrowser();
  if (!browser) return null;

  // Neuer isolierter Browser-Context mit realistischem Fingerprint (bessere SPA-/Bot-Umgehung)
  let context;
  try {
    context = await browser.newContext({
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: {
        "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    // Optional: nutzerähnliche Stealth-Extras
    await context.addInitScript(() => {
      // navigator.webdriver verbergen (reduziert Bot-Erkennung)
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();

    // Einzelner goto mit 'load' + hartem Timeout via Promise.race (verhindert Hängen)
    await Promise.race([
      page.goto(url, { waitUntil: "load", timeout: 25000 }).catch(() => {}),
      new Promise((r) => setTimeout(r, 25000))
    ]);

    // Warten, bis SPA-Inhalte nachgeladen sind (Netzwerk ruht für 1,2s)
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await sleep(2000);

    // Cookie- / Consent-Banner aktiv schließen (verdeckt oft die eigentlichen Angebote)
    await dismissConsentBanner(page);

    // Scrollen simuliert echte Nutzer-Interaktion und triggert Lazy-Loading
    await autoScroll(page, 14);

    const html = await page.content();
    return html;
  } catch (e) {
    console.warn(`Browser-Rendering fehlgeschlagen für ${url}:`, e.message);
    return null;
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

async function autoScroll(page, steps = 8) {
  try {
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, 900).catch(() => {});
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8)).catch(() => {});
      await sleep(600);
    }
  } catch { /* ignore scroll errors */ }
}

// Schließt typische Cookie-/Consent-Banner der deutschen Markt-Websites
async function dismissConsentBanner(page) {
  const selectors = [
    // ALDI (Usercentrics), REWE (OneTrust), EDEKA, LIDL gängige Labels/Schaltflächen
    "button:has-text('Alle akzeptieren')",
    "button:has-text('Zustimmen')",
    "button:has-text('Akzeptieren')",
    "button:has-text('Accept all')",
    "button:has-text('Alle erlauben')",
    "button:has-text('Einverstanden')",
    "#onetrust-accept-btn-handler",
    "button[id*='accept' i]",
    "button[id*='consent' i]",
    "[data-testid*='accept' i]",
    "[class*='accept-all']"
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click({ timeout: 3000 }).catch(() => {});
        await sleep(1200);
        break; // Ein Consent reicht meist
      }
    } catch { /* selector nicht vorhanden */ }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  let html = null;

  // 1) Schneller statischer Fetch (axios)
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 FamilyShoppingList/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
      },
      timeout: 12000,
      maxRedirects: 5
    });
    html = response.data;
  } catch (e) {
    // axios schlug fehl (Bot-Schutz/403) -> Browser versuchen
    console.warn(`Statisches Fetch fehlgeschlagen für ${url}:`, e.message);
    html = null;
  }

  // 2) Wenn statisch kein brauchbares Rendering mit Preisen liefert -> echtes Browser-Rendering
  if (!html || !looksLikeRenderedPage(html)) {
    const rendered = await renderWithBrowser(url);
    if (rendered) html = rendered;
  }

  return html;
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

function parseGenericOffers(html, market, pageUrl, extraSelectors = []) {
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

  // 1) JSON-LD "Product" / "Offer" Strukturdaten (werden auch im statischen HTML ausgeliefert)
  try {
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).html() || "";
      const blocks = raw.match(/\{[\s\S]*?\}/g) || [];
      for (const block of blocks) {
        try {
          const obj = JSON.parse(block);
          const items = Array.isArray(obj) ? obj : (obj["@graph"] ? obj["@graph"] : [obj]);
          for (const item of items) {
            const name = normalizeWhitespace(item?.name);
            if (!name) continue;
            const price =
              item?.offers?.price ??
              (Array.isArray(item?.offers) ? item.offers[0]?.price : undefined) ??
              item?.price ??
              item?.lowPrice;
            if (price == null) continue;
            const url =
              absoluteUrl(base, item?.url) ||
              (item?.offers?.url ? absoluteUrl(base, item.offers.url) : null);
            const image = item?.image
              ? (Array.isArray(item.image) ? item.image[0] : item.image)
              : null;
            const key = url || `${market}|${name}|${price}`;
            if (seen.has(key)) continue;
            seen.add(key);
            offers.push({
              title: name,
              price: Number(price),
              url,
              market,
              source,
              image: image ? absoluteUrl(base, image) : null,
              fetchedAt: new Date().toISOString()
            });
          }
        } catch { /* JSON-LD malformed, skip block */ }
      }
    });
  } catch (e) { /* ignore JSON-LD errors */ }

  // 2) HTML-Selektoren (vielfältig + locker geprüft)
  const selectors = [
    "a[href]",
    ".product a, .offer a, .teaser a, article a, [data-product] a",
    ...extraSelectors
  ];

  $((extraSelectors && extraSelectors.length ? selectors : "a[href]")).each((_, element) => {
    if (offers.length >= 220) {
      return;
    }

    const href = absoluteUrl(base, $(element).attr("href"));
    if (!href || seen.has(href)) {
      return;
    }

    const title = normalizeWhitespace($(element).text());
    const context = normalizeWhitespace(
      $(element).closest("article, li, div, section").text() || title
    );

    // Preis aus Titel oder Kontext ermitteln
    const price = extractEuroPrice(`${title} ${context}`);

    // Akzeptiere, wenn Preis gefunden UND (Titel nicht zu kurz ODER Preis direkt im Titel)
    const titleHasPrice = extractEuroPrice(title) != null;
    if (price == null) {
      return;
    }
    if (!title || title.length < 3 || title.length > 240) {
      return;
    }
    // Nur sinnvolle Angebote: Titel ohne Preis ok, aber Kontext muss Angebots-Hinweis enthalten
    const looksLikeOffer =
      titleHasPrice ||
      /\b(€|EUR|angebot|preis|rabatt|% reduziert|nur)\b/i.test(context);
    if (!looksLikeOffer) {
      return;
    }

    seen.add(href);
    offers.push({
      title: titleHasPrice ? title : title + ` (${price.toFixed(2)} €)`,
      price,
      url: href,
      market,
      source,
      image: extractImgFrom(element, $),
      fetchedAt: new Date().toISOString()
    });
  });

  return mergeAndDedupeOffers(offers);
}

async function fetchLiveOffersForMarket(market, sourceUrl, weekOffset) {
  const pageUrl = isValidHttpUrl(sourceUrl) ? sourceUrl : buildWeeklyUrl(market, weekOffset, "");

  if (!pageUrl) {
    return { offers: [], available: false, reason: "Keine URL konfiguriert" };
  }

  if (weekOffset > 0 && !isNextWeekAvailable()) {
    return { offers: [], available: false, reason: "Angebote der nächsten Woche sind noch nicht verfügbar" };
  }

  // ---- JSON-first: strukturierte Markt-APIs nutzen, falls verfügbar (schnell & robust) ----
  const jsonConnector = getJsonConnector(market);
  if (jsonConnector && weekOffset === 0) {
    try {
      // Konfigurierte Markt-/Filial-URL an den Connector durchreichen (falls dieser sie nutzt)
      const result = await jsonConnector({ url: pageUrl });
      if (result?.offers && result.offers.length > 0) {
        return { market, ...result };
      }
    } catch (e) {
      console.warn(`JSON-Connector ${market} fehlgeschlagen, Fallback auf HTML-Scraping:`, e.message);
    }
  }

  // Marktspezifische Selektoren, die zusätzlich zum generischen Ansatz geprüft werden
  const EXTRA_SELECTORS = {
    REWE: [".it-gallery-tile a, .sale-header a, .teaser-teaser a, [data-testid='product-tile'] a"],
    EDEKA: [".mf-offer a, .prospekt-teaser a, [class*='offer'] a, [class*='product'] a"],
    ALDI: ["[class*='product'] a, [class*='tile'] a, [class*='offer'] a"],
    LIDL: [".product-group a, [class*='product'] a, [class*='offer'] a, .nuc-offer a"]
  };

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

  const generic = parseGenericOffers(html, market, pageUrl, EXTRA_SELECTORS[market] || []);

  if (market === "ALDI") {
    const aldiSpecific = parseAldiOffers(html);
    const merged = mergeAndDedupeOffers([...aldiSpecific, ...generic]);
    return { offers: merged, available: true, pageUrl };
  }

  if (generic.length === 0 && weekOffset > 0) {
    return { offers: [], available: false, reason: "Angebote der nächsten Woche sind noch nicht verfügbar" };
  }

  // Hinweis, wenn auf einer Seite nichts gefunden wurde: oft SPA / JS-gerendert
  if (generic.length === 0) {
    return {
      offers: [],
      available: true,
      pageUrl,
      warning:
        "Die Seite ist vermutlich JavaScript-gerendert (SPA) und liefert nur den statischen Rahmen. " +
        "Bitte eine direkte Filial-URL unter Einstellungen → Filialen hinterlegen."
    };
  }

  return { offers: generic, available: true, pageUrl };
}

/** Liefert den passenden JSON-Connector für einen Markt (oder null, wenn keiner verfügbar ist). */
function getJsonConnector(market) {
  switch (String(market || "").toUpperCase()) {
    case "ALDI":
      return getAldiOffers;
    case "LIDL":
      return getLidlOffers;
    case "EDEKA":
      return getEdekaOffers;
    case "REWE":
      return getReweOffers;
    default:
      return null;
  }
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
