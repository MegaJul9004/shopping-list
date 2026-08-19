const OFFER_DATA = {
  LIDL: [
    { name: "Milch", price: 1.15 },
    { name: "Brot", price: 1.39 },
    { name: "Eier", price: 2.19 },
    { name: "Nudeln", price: 0.89 },
    { name: "Reis", price: 1.79 },
    { name: "Tomaten", price: 2.29 },
    { name: "Hähnchenbrust", price: 7.49 },
    { name: "Käse", price: 2.39 },
    { name: "Paprika", price: 2.59 },
    { name: "Bananen", price: 1.29 }
  ],
  EDEKA: [
    { name: "Milch", price: 1.19 },
    { name: "Brot", price: 1.59 },
    { name: "Eier", price: 2.39 },
    { name: "Nudeln", price: 0.95 },
    { name: "Reis", price: 1.99 },
    { name: "Tomaten", price: 2.49 },
    { name: "Hähnchenbrust", price: 7.99 },
    { name: "Käse", price: 2.19 },
    { name: "Paprika", price: 2.79 },
    { name: "Äpfel", price: 2.29 }
  ],
  ALDI: [
    { name: "Milch", price: 1.09 },
    { name: "Brot", price: 1.29 },
    { name: "Eier", price: 2.09 },
    { name: "Nudeln", price: 0.79 },
    { name: "Reis", price: 1.69 },
    { name: "Tomaten", price: 2.19 },
    { name: "Hähnchenbrust", price: 7.29 },
    { name: "Käse", price: 2.29 },
    { name: "Paprika", price: 2.49 },
    { name: "Bananen", price: 1.25 }
  ],
  REWE: [
    { name: "Milch", price: 1.25 },
    { name: "Brot", price: 1.69 },
    { name: "Eier", price: 2.49 },
    { name: "Nudeln", price: 0.99 },
    { name: "Reis", price: 2.09 },
    { name: "Tomaten", price: 2.59 },
    { name: "Hähnchenbrust", price: 8.19 },
    { name: "Käse", price: 2.49 },
    { name: "Paprika", price: 2.89 },
    { name: "Äpfel", price: 2.19 }
  ]
};

export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function findOffer(itemName, offers) {
  const target = normalize(itemName);
  return offers.find((offer) => {
    const offerName = normalize(offer.name);
    return target.includes(offerName) || offerName.includes(target);
  });
}

export function getSupportedMarkets() {
  return Object.keys(OFFER_DATA);
}

function toPriceRowsFromLiveOffers(liveOffersByMarket) {
  const result = {};

  for (const [market, offers] of Object.entries(liveOffersByMarket || {})) {
    result[market] = (offers || [])
      .filter((entry) => Number.isFinite(entry.price))
      .map((entry) => ({
        name: entry.title,
        price: Number(entry.price)
      }));
  }

  return result;
}

function getFallbackOffer(market, itemName) {
  const rows = OFFER_DATA[market] || [];
  return findOffer(itemName, rows);
}

export function compareMarkets(shoppingItems, selectedMarkets, liveOffersByMarket = {}) {
  const validMarkets = selectedMarkets.filter((m) => OFFER_DATA[m]);
  const liveRows = toPriceRowsFromLiveOffers(liveOffersByMarket);

  if (validMarkets.length === 0) {
    return {
      selectedMarkets: [],
      bestPerItem: [],
      marketTotals: [],
      recommendation: null
    };
  }

  const bestPerItem = shoppingItems.map((item) => {
    const options = validMarkets
      .map((market) => {
        const liveMatch = findOffer(item.name, liveRows[market] || []);
        const fallbackMatch = getFallbackOffer(market, item.name);
        const match = liveMatch || fallbackMatch;

        if (!match) {
          return null;
        }

        const source = liveMatch ? "live" : "fallback";

        return {
          market,
          unitPrice: match.price,
          totalPrice: Number((match.price * item.quantity).toFixed(2)),
          source
        };
      })
      .filter(Boolean);

    const best = options.sort((a, b) => a.totalPrice - b.totalPrice)[0] || null;

    return {
      itemName: item.name,
      quantity: item.quantity,
      options,
      best
    };
  });

  const marketTotals = validMarkets.map((market) => {
    let total = 0;
    let coveredItems = 0;

    for (const item of shoppingItems) {
      const liveMatch = findOffer(item.name, liveRows[market] || []);
      const fallbackMatch = getFallbackOffer(market, item.name);
      const match = liveMatch || fallbackMatch;

      if (!match) {
        continue;
      }
      coveredItems += 1;
      total += match.price * item.quantity;
    }

    const coverage = shoppingItems.length === 0 ? 1 : coveredItems / shoppingItems.length;

    return {
      market,
      coveredItems,
      totalItems: shoppingItems.length,
      coverage,
      totalPrice: Number(total.toFixed(2))
    };
  });

  const recommendation = marketTotals
    .slice()
    .sort((a, b) => {
      if (b.coverage !== a.coverage) {
        return b.coverage - a.coverage;
      }
      return a.totalPrice - b.totalPrice;
    })[0] || null;

  return {
    selectedMarkets: validMarkets,
    bestPerItem,
    marketTotals,
    recommendation
  };
}

export function buildExportByMarket(comparison) {
  const grouped = {};

  for (const entry of comparison.bestPerItem || []) {
    const market = entry.best?.market || "UNBEKANNT";
    if (!grouped[market]) {
      grouped[market] = [];
    }

    grouped[market].push({
      itemName: entry.itemName,
      quantity: entry.quantity,
      unitPrice: entry.best?.unitPrice ?? null,
      totalPrice: entry.best?.totalPrice ?? null,
      source: entry.best?.source ?? null
    });
  }

  return grouped;
}
