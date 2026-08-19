import axios from "axios";
import * as cheerio from "cheerio";

function normalizeUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `https://www.chefkoch.de${url}`;
  return null;
}

export async function searchChefkoch(query) {
  const encoded = encodeURIComponent(query.trim());
  const url = `https://www.chefkoch.de/rs/s0/${encoded}/Rezepte.html`;
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "text/html"
    },
    timeout: 8000
  });

  const $ = cheerio.load(response.data);
  const seen = new Set();
  const recipes = [];

  $("a[href*='/rezepte/'][href$='.html']").each((_, el) => {
    if (recipes.length >= 12) {
      return;
    }

    const href = normalizeUrl($(el).attr("href"));
    const title = ($(el).attr("title") || $(el).text() || "").trim();

    if (!href || !title) {
      return;
    }

    if (seen.has(href)) {
      return;
    }

    seen.add(href);
    recipes.push({ title, url: href });
  });

  return recipes;
}
