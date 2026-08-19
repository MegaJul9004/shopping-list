import axios from "axios";
import * as cheerio from "cheerio";

const TTL_MS = 15 * 60 * 1000;
const cache = new Map();

const SUPPORTED_MARKETS = ["LIDL", "EDEKA", "ALDI", "REWE"];

const DEFAULT_MARKET_SOURCES = {
  ALDI: {
    label: "ALDI SUD",
    url: "https://www.aldi-sued.de/angebote"
  },
  LIDL: {
    label: "LIDL",
    url: "https://www.lidl.de/angebote"
  },
  EDEKA: {
    label: "EDEKA",
    url: "https://www.edeka.de/angebote"
  },
  REWE: {
    label: "REWE",
    url: "https://www.rewe.de/angebote"
  }
};

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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "text/html"
    },
    timeout: 10000
  });
  return response.data;
}

function parseAldiOffers(html) {
  const $ = cheerio.load(html);
  const offers = [];
  const seen = new Set();

  $("a[href*='/produkt/']").each((_, element) => {
    if (offers.length >= 220) {
      return;
    }

    const href = absoluteUrl("https://www.aldi-sued.de", $(element).attr("href"));
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
      source: "ALDI SUD",
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
      fetchedAt: new Date().toISOString()
    });
  });

  return offers;
}

async function fetchLiveOffersForMarket(market, sourceUrl) {
  const fallback = DEFAULT_MARKET_SOURCES[market]?.url;
  const pageUrl = isValidHttpUrl(sourceUrl) ? sourceUrl : fallback;

  if (!pageUrl) {
    return [];
  }

  const html = await fetchHtml(pageUrl);
  const generic = parseGenericOffers(html, market, pageUrl);

  if (market === "ALDI") {
    const aldiSpecific = parseAldiOffers(html);
    return mergeAndDedupeOffers([...aldiSpecific, ...generic]);
  }

  return generic;
}

export function getSupportedMarkets() {
  return SUPPORTED_MARKETS.slice();
}

export function getDefaultMarketSource(market) {
  return DEFAULT_MARKET_SOURCES[market]?.url || null;
}

export async function getMarketOffers(market, options = {}) {
  const key = String(market || "").toUpperCase();
  if (!SUPPORTED_MARKETS.includes(key)) {
    return [];
  }

  const forceRefresh = Boolean(options.forceRefresh);
  const sourceUrl = isValidHttpUrl(options.sourceUrl) ? options.sourceUrl : "";
  const cacheKey = sourceUrl ? `${key}|${sourceUrl}` : key;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (!forceRefresh && cached && now - cached.timestamp < TTL_MS) {
    return cached.offers;
  }

  try {
    const offers = await fetchLiveOffersForMarket(key, sourceUrl);
    cache.set(cacheKey, { timestamp: now, offers });
    return offers;
  } catch {
    if (cached?.offers) {
      return cached.offers;
    }
    return [];
  }
}

export async function getLiveOffers(options = {}) {
  const market = String(options.market || "ALL").toUpperCase();
  const offset = Math.max(0, Number(options.offset || 0));
  const limit = Math.max(1, Math.min(50, Number(options.limit || 20)));
  const forceRefresh = Boolean(options.forceRefresh);
  const locations = options.locations || {};

  const markets =
    market === "ALL"
      ? SUPPORTED_MARKETS
      : SUPPORTED_MARKETS.filter((entry) => entry === market);

  const marketData = await Promise.all(
    markets.map(async (entry) => {
      const configuredUrl = locations?.[entry]?.url;
      const offers = await getMarketOffers(entry, {
        forceRefresh,
        sourceUrl: configuredUrl
      });
      return offers;
    })
  );

  const allOffers = marketData
    .flat()
    .sort((a, b) => {
      const aTs = new Date(a.fetchedAt || 0).getTime();
      const bTs = new Date(b.fetchedAt || 0).getTime();
      return bTs - aTs;
    });

  const paged = allOffers.slice(offset, offset + limit);

  return {
    market,
    total: allOffers.length,
    offset,
    limit,
    hasMore: offset + limit < allOffers.length,
    offers: paged
  };
}
