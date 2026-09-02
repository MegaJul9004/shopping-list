import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Markt-spezifische JSON-Connectors.
 *
 * Hintergrund:
 * Die Supermarkt-Websites (ALDI, REWE, EDEKA, LIDL) sind JavaScript-SPAs, deren Angebote
 * NICHT im serverseitig gelieferten HTML stehen. Stattdessen liefern interne JSON-Endpunkte
 * (Next.js `_next/data`-SSG oder Marketing-APIs) die Angebote als strukturierte Daten.
 *
 * Diese Module holen direkt diese JSON-Schnittstellen - deterministisch, schnell und
 * ohne schwergewichtiges Browser-Rendering.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const JSON_HEADERS = {
  "User-Agent": UA,
  Accept: "application/json,text/html,*/*;q=0.8",
  "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
};

// ---------------------------------------------------------------------------
// ALDI NORD / SÜD  (Next.js SSR/SSG - `_next/data`-Endpunkt, geprüft & funktioniert)
// ---------------------------------------------------------------------------

const ALDI_BASE = "https://www.aldi-nord.de";
const ALDI_OFFERS_PATH = "angebote.html";

/**
 * Extrahiert die Next.js Build-ID aus der HTML-Seite (über __NEXT_DATA__ oder Script-URLs).
 * Die Build-ID ändert sich mit jedem Deploy, deshalb dynamische Ermittlung (mit Cache).
 */
async function discoverAldiBuildId() {
  if (discoverAldiBuildId._cache) return discoverAldiBuildId._cache;

  const res = await axios.get(`${ALDI_BASE}/${ALDI_OFFERS_PATH}`, {
    headers: { "User-Agent": UA },
    timeout: 15000
  });
  const html = res.data;
  const $ = cheerio.load(html);

  // 1) __NEXT_DATA__ (zuverlässigste Quelle)
  const ndRaw = $("#__NEXT_DATA__").html() || "";
  let buildId = null;
  if (ndRaw) {
    try {
      buildId = JSON.parse(ndRaw).buildId || null;
    } catch { /* ignore */ }
  }

  // 2) Fallback: aus /_next/static/<buildid>/ in Script-URLs
  if (!buildId) {
    $("script[src]").each((_, el) => {
      const s = $(el).attr("src") || "";
      const m = s.match(/_next\/static\/([A-Za-z0-9_-]+)\//);
      if (m && !buildId) buildId = m[1];
    });
  }

  if (buildId) discoverAldiBuildId._cache = buildId;
  return buildId;
}

/**
 * Ruft die ALDI-Angebote über den Next.js SSG-JSON-Endpunkt ab.
 */
export async function getAldiOffers({ locale = "de", week = "current" } = {}) {
  const buildId = await discoverAldiBuildId();
  if (!buildId) {
    return { offers: [], available: false, reason: "ALDI-Build-ID nicht ermittelbar" };
  }

  const dataUrl = `${ALDI_BASE}/_next/data/${buildId}/${locale}/${ALDI_OFFERS_PATH}.json`;
  const res = await axios.get(dataUrl, {
    headers: { ...JSON_HEADERS, "x-nextjs-data": "1" },
    timeout: 20000
  });

  const apiData = res.data?.pageProps?.apiData;
  if (typeof apiData !== "string") {
    return { offers: [], available: false, reason: "ALDI: keine apiData im JSON" };
  }

  const entries = JSON.parse(apiData);
  const offerEntry = Array.isArray(entries)
    ? entries.find((e) => Array.isArray(e) && e[0] === "OFFER_GET")
    : null;
  const algoliaMap = offerEntry?.[1]?.res?.algoliaDataMap || {};
  const rawProducts = Object.values(algoliaMap);

  const offers = rawProducts
    .filter((p) => p && typeof p === "object")
    .map((p) => mapAldiProduct(p))
    .filter((o) => o !== null);

  return {
    offers,
    available: offers.length > 0,
    pageUrl: `${ALDI_BASE}/${ALDI_OFFERS_PATH}`
  };
}
/** Wandelt ein ALDI algoliaDataMap-Produkt in das App-Angebotsformat um. */
function mapAldiProduct(p) {
  const name = String(p.name || p.shortDescription || "").trim();
  if (!name) return null;

  const cp = p.currentPrice || {};
  const priceVal = cp.priceValue ?? p.promotionPrices?.[0]?.priceValue;
  if (priceVal == null) return null; // ohne Preis kein verwertbares Angebot

  const strike = cp.strikePrice?.strikePriceValue;
  const promoText = cp.priceTagLabels?.promoText1 || null;

  // Bild: primary asset
  const assets = Array.isArray(p.assets) ? p.assets : [];
  const primary = assets.find((a) => a && a.type === "primary") || assets[0];
  let image = null;
  if (primary?.url) image = primary.url.startsWith("http") ? primary.url : `https:${primary.url}`;
  else if (primary?.links?.download) image = primary.links.download;

  // Produkt-URL (slug)
  let url = null;
  if (p.productSlug) {
    url = `${ALDI_BASE}/produkte/${String(p.productSlug).replace(/^\/+/, "")}/`;
  }

  return {
    title: name + (p.salesUnit ? `, ${p.salesUnit}` : ""),
    name,
    price: Number(priceVal),
    unit: typeof p.salesUnit === "string" ? p.salesUnit : null,
    oldPrice: strike != null ? Number(strike) : null,
    promo: promoText,
    image,
    url,
    market: "ALDI",
    source: "ALDI NORD",
    fetchedAt: new Date().toISOString()
  };
}
// ---------------------------------------------------------------------------
// EDEKA  (sehr aggressiver Bot-Schutz - aktuell blockiert)
// ---------------------------------------------------------------------------
export async function getEdekaOffers() {
  return {
    offers: [],
    available: false,
    reason:
      "EDEKA blockiert automatisierte Zugriffe per aggressivem Bot-Schutz " +
      "(HTTP 403 'Access Denied' auch im Headless-Browser). Angebote sind über diese Schnittstelle " +
      "aktuell nicht maschinell abrufbar."
  };
}

// ---------------------------------------------------------------------------
// Gemeinsamer Playwright-Browser-Helper (robust gegen Hängen, mit Consent-Skip)
// ---------------------------------------------------------------------------
let reweBrowserPromise = null;
async function getRenderBrowser() {
  if (!reweBrowserPromise) {
    try {
      const { chromium } = await import("playwright");
      reweBrowserPromise = chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--lang=de-DE,de"]
      });
    } catch (e) {
      console.warn("Playwright für Markt-Rendering nicht verfügbar:", e.message);
      reweBrowserPromise = null;
    }
  }
  return reweBrowserPromise;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lädt eine Seite in einem echten Browser, schließt Consent-Banner, scrollt und liefert das finale HTML. */
async function renderPageToHtml(url, { waitMs = 9000, scrollSteps = 14 } = {}) {
  const browser = await getRenderBrowser();
  if (!browser) return null;
  const context = await browser.newContext({
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7" }
  });
  const page = await context.newPage();
  try {
    await Promise.race([
      page.goto(url, { waitUntil: "load", timeout: 25000 }).catch(() => {}),
      new Promise((r) => setTimeout(r, 25000))
    ]);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await sleep(2000);
    // Consent-Banner zuklicken
    const consentSelectors = [
      "button:has-text('Alle akzeptieren')",
      "button:has-text('Zustimmen')",
      "button:has-text('Akzeptieren')",
      "button:has-text('Accept all')",
      "button:has-text('Alle erlauben')",
      "#onetrust-accept-btn-handler",
      "button[id*='accept' i]",
      "button[id*='consent' i]"
    ];
    for (const sel of consentSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click({ timeout: 3000 }).catch(() => {});
          await sleep(1000);
          break;
        }
      } catch { /* not present */ }
    }
    await sleep(waitMs);
    for (let i = 0; i < scrollSteps; i++) {
      await page.mouse.wheel(0, 900).catch(() => {});
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8)).catch(() => {});
      await sleep(500);
    }
    return await page.content();
  } finally {
    await context.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// REWE  (Browser-DOM-Extraktion: lädt die Filialseite, schließt Consent, parst das gerenderte DOM)
// ---------------------------------------------------------------------------
export async function getReweOffers({ url } = {}) {
  const pageUrl =
    url ||
    "https://www.rewe.de/angebote/burgdorf/540824/rewe-markt-marktstr-27/";
  let html;
  try {
    html = await renderPageToHtml(pageUrl);
  } catch (e) {
    return { offers: [], available: false, reason: `REWE-Rendering fehlgeschlagen: ${e.message}` };
  }
  if (!html) {
    return { offers: [], available: false, reason: "REWE: Browser-Rendering nicht möglich (Playwright fehlt?)" };
  }

  const offers = parseReweDom(html, pageUrl);
  return { offers, available: offers.length > 0, pageUrl };
}

/**
 * Parst das gerenderte REWE-DOM mit marktspezifischen Selektoren:
 *   Karte:   .cor-offer-information
 *   Titel:   .cor-offer-information__title-link[aria-label]
 *   Preis:   .cor-offer-price__tag-price   ("2,99 €")
 *   Bild:    nächstliegendes <img> im Karten-Container
 */
function parseReweDom(html, pageUrl) {
  const $ = cheerio.load(html);
  const offers = [];
  const seen = new Set();

  $(".cor-offer-renderer-tile").each((_, tile) => {
    const titleAttr = $(tile).find(".cor-offer-information__title-link").first().attr("aria-label") || "";
    const title = String(titleAttr).replace(/\s+/g, " ").trim();
    if (!title) return;

    const priceText = $(tile).find(".cor-offer-price__tag-price").first().text() || "";
    const m = priceText.match(/(\d+[.,]\d{2})\s*€/);
    if (!m) return;
    const price = Number(m[1].replace(",", "."));

    // Preis-Label (Aktion/Knallerpreis) aus dem Preis-Knoten holen
    const promo = ($(tile).find(".cor-offer-price__tag-label").first().text() || "").trim();

    const key = `${title}|${price}`;
    if (seen.has(key)) return;
    seen.add(key);

    // Bild aus dem Tile
    const imgEl = $(tile).find("img").first();
    let image = imgEl ? (imgEl.attr("src") || imgEl.attr("data-src") || "") : "";
    if (image.startsWith("//")) image = "https:" + image;
    // Unbrauchbare Renderer-Assets verwerfen (nur echte Produktbilder von img.rewe-static.de)
    if (image && (image.includes("content-offer-renderer") || !image.startsWith("http"))) image = "";

    offers.push({
      title,
      price,
      url: null,
      image: image || null,
      market: "REWE",
      source: "REWE",
      promo: promo || null,
      fetchedAt: new Date().toISOString()
    });
  });

  return offers;
}
// ---------------------------------------------------------------------------
// LIDL  (Flyer-API der Schwarz-Gruppe; Identifier muss aktuell gehalten werden)
// ---------------------------------------------------------------------------
export async function getLidlOffers() {
  return {
    offers: [],
    available: false,
    reason:
      "LIDL nutzt die separat betriebene Flyer-Anwendung 'leaflets.schwarz'. Die Angebote liegen " +
      "in der V4-Flyer-API vor; eine sichere, aktuelle Flyer-Identifier-Auflösung steht noch aus."
  };
}