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

  // Zubereitung: bevorzugt aus dem eingebetteten JSON-LD (schema.org Recipe)
  const instructions = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    if (instructions.length > 0) return;
    const raw = $(el).html() || "";
    if (!/recipeInstructions|@type["':\s]*(?:Recipes?)/i.test(raw)) return;
    try {
      const parsed = JSON.parse(raw);
      const graph = Array.isArray(parsed) ? parsed : (parsed["@graph"] ? parsed["@graph"] : [parsed]);
      const collectSteps = (ri) => {
        for (const step of ri) {
          if (instructions.length >= 30) break;
          if (!step || typeof step !== "object") {
            const t = String(step || "").replace(/\s+/g, " ").trim();
            if (t) instructions.push(t);
            continue;
          }
          const type = step["@type"] || "";
          if (String(type).toLowerCase().includes("section")) {
            // HowToSection -> itemListElement enthält die Schritte
            if (Array.isArray(step.itemListElement)) collectSteps(step.itemListElement);
            continue;
          }
          const text = (step.text || step.name || "").replace(/\s+/g, " ").trim();
          if (text) instructions.push(text);
        }
      };
      for (const node of graph) {
        const ri = node.recipeInstructions || (node["@type"] === "Recipe" ? node.recipeInstructions : null);
        if (Array.isArray(ri)) {
          collectSteps(ri);
          if (instructions.length > 0) break;
        }
      }
    } catch { /* malformed JSON-LD */ }
  });

  // Fallback 1: HTML-Selektoren
  if (instructions.length === 0) {
    const primarySelectors = [
      ".recipe-preparation ol li", ".preparation ol li",
      "ol[class*='preparation'] li", ".instructions li",
      "#rezept-zubereitung ol li", "[class*='zubereitung'] li"
    ];
    for (const sel of primarySelectors) {
      if (instructions.length > 0) break;
      $(sel).each((_, el) => {
        const step = $(el).text().replace(/\s+/g, " ").trim();
        if (step && step.length > 10 && instructions.length < 30) instructions.push(step);
      });
    }
  }

  // Fallback 2: jedes <ol> mit ≥2 längeren <li>-Elementen
  if (instructions.length === 0) {
    $("ol").each((_, ol) => {
      if (instructions.length > 0) return;
      const lis = $(ol).find("> li")
        .map((_, li) => $(li).text().replace(/\s+/g, " ").trim())
        .get()
        .filter((t) => t && t.length > 20);
      if (lis.length >= 2) lis.slice(0, 30).forEach((t) => instructions.push(t));
    });
  }

  return {
    title: title || "Rezept",
    image,
    url: target,
    servings: servings || 4,
    ingredients,
    instructions
  };
}
