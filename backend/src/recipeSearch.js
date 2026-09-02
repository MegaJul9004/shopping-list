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

// ── Chefkoch-Detailseite parsen ──────────────────────────────────────
export async function getRecipeDetail(url) {
  const target = normalizeUrl(url);
  if (!target) return null;

  const response = await axios.get(target, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      Accept: "text/html"
    },
    timeout: 10000,
    maxRedirects: 5
  });

  const $ = cheerio.load(response.data);

  const title = ($("h1").first().text() || $('meta[property="og:title"]').attr("content") || "").trim();
  const image = (
    $('meta[property="og:image"]').attr("content") ||
    $("img.recipe-image, .recipe-header img").attr("src") ||
    ""
  ).replace(/^\/\//, "https:");

  // Portionen: in der Regel aus Label "Für X Personen"
  let servings = 4;
  const servingText = $(".ingredients td, .sendenbox .ingredient, .rezept-servings, [class*='serv']")
    .map((_, el) => $(el).text())
    .get()
    .join(" ");
  const servingsMatch = servingText.match(/(\d+)\s*(Personen|Portionen|servings|Pers\.)/i);
  if (servingsMatch) servings = Number(servingsMatch[1]);

  // Zutaten: table.ingredients mit zwei <td> (Menge | Name)
  const ingredients = [];
  $("table.ingredients, table[class*='ingredient']").first().find("tr").each((_, tr) => {
    if (ingredients.length >= 40) return;
    const cells = $(tr).find("td").map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get();
    let line;
    if (cells.length >= 2) {
      line = `${cells[0]} ${cells[1]}`.trim();
    } else if (cells.length === 1) {
      line = cells[0];
    } else {
      line = $(tr).text().replace(/\s+/g, " ").trim();
    }
    if (line && /[A-Za-zÀ-ÿß]/.test(line)) ingredients.push(line);
  });
  // Fallback: generische Selektor-Liste
  if (ingredients.length === 0) {
    $(".ingredients tr, .ingredient, .zutaten ul li, ul#ingredients li").each((_, el) => {
      if (ingredients.length >= 40) return;
      const row = $(el).text().replace(/\s+/g, " ").trim();
      if (row && /[A-Za-zÀ-ÿß]/.test(row)) ingredients.push(row);
    });
  }

  // Zubereitung
  const instructions = [];
  $(".recipe-preparation ol li, .preparation ol li, ol[class*='preparation'] li, .instructions li").each((_, el) => {
    const step = $(el).text().replace(/\s+/g, " ").trim();
    if (step && instructions.length < 30) instructions.push(step);
  });

  return {
    title: title || "Rezept",
    image,
    url: target,
    servings: servings || 4,
    ingredients,
    instructions
  };
}
