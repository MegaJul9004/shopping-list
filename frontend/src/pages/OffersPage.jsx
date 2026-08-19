import { useCallback, useEffect, useState } from "react";
import { useApp, api } from "../context/AppContext";

const MARKETS = ["LIDL", "EDEKA", "ALDI", "REWE"];

export default function OffersPage({ session, theme }) {
  const { settings } = useApp();
  const [liveMarketView, setLiveMarketView] = useState("ALL");
  const [liveOffers, setLiveOffers] = useState([]);
  const [liveOffersHasMore, setLiveOffersHasMore] = useState(false);
  const [liveOffersOffset, setLiveOffersOffset] = useState(0);
  const [loadingLiveOffers, setLoadingLiveOffers] = useState(false);
  const [selectedMarkets, setSelectedMarkets] = useState(["LIDL", "ALDI"]);
  const [offersResult, setOffersResult] = useState(null);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [locations, setLocations] = useState({});
  const [locationForms, setLocationForms] = useState({});
  const [watchlist, setWatchlist] = useState([]);
  const [watchSearch, setWatchSearch] = useState("");
  const [watchResults, setWatchResults] = useState([]);
  const [watchLoading, setWatchLoading] = useState(false);
  const [offerSearch, setOfferSearch] = useState("");
  const [offerSearchResults, setOfferSearchResults] = useState([]);
  const [offerSearchMeta, setOfferSearchMeta] = useState(null);
  const [offerSearching, setOfferSearching] = useState(false);

  async function loadLiveOffers(refresh) {
    setLoadingLiveOffers(true);
    try {
      const offset = refresh ? 0 : liveOffersOffset;
      const refreshParam = refresh ? "&refresh=1" : "";
      const data = await api(/offers/live?market=&offset=&limit=20);
      if (refresh) setLiveOffers(data.offers);
      else setLiveOffers((prev) => [...prev, ...data.offers]);
      setLiveOffersHasMore(data.hasMore);
      setLiveOffersOffset(offset + data.offers.length);
    } catch (e) { console.error(e); }
    setLoadingLiveOffers(false);
  }

  useEffect(() => {
    setLiveOffers([]);
    setLiveOffersOffset(0);
    loadLiveOffers(true);
  }, [liveMarketView]);

  const loadComparison = useCallback(async () => {
    if (!session) return;
    setLoadingOffers(true);
    try {
      const data = await api(/offers/compare?markets=, {}, session.token);
      setOffersResult(data);
    } catch (e) { console.error(e); }
    setLoadingOffers(false);
  }, [session, selectedMarkets]);

  const toggleMarket = (m) => {
    setSelectedMarkets((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  useEffect(() => {
    if (!session) return;
    api(/families//locations, {}, session.token)
      .then((data) => {
        const locs = {};
        for (const loc of data.locations || []) locs[loc.market] = loc;
        setLocations(locs);
      }).catch(() => {});
  }, [session]);

  const saveLocation = async (market) => {
    const form = locationForms[market] || {};
    if (!form.locationName) return;
    try {
      const data = await api(/families//locations,
        { method: "POST", body: JSON.stringify({ market, ...form }) }, session.token);
      if (data.location) setLocations((prev) => ({ ...prev, [market]: data.location }));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!session) return;
    api(/families//offer-watchlist, {}, session.token)
      .then((data) => setWatchlist(data.watchlist || [])).catch(() => {});
  }, [session]);

  const addWatchItem = async () => {
    if (!watchSearch.trim() || !session) return;
    try {
      await api(/families//offer-watchlist,
        { method: "POST", body: JSON.stringify({ searchTerm: watchSearch.trim() }) }, session.token);
      setWatchSearch("");
      const data = await api(/families//offer-watchlist, {}, session.token);
      setWatchlist(data.watchlist || []);
    } catch (e) { console.error(e); }
  };

  const removeWatchItem = async (watchId) => {
    if (!session) return;
    try {
      await api(/families//offer-watchlist/, { method: "DELETE" }, session.token);
      setWatchlist((prev) => prev.filter((w) => w.id !== watchId));
    } catch (e) { console.error(e); }
  };

  const searchWatchlist = async () => {
    if (watchlist.length === 0) return;
    setWatchLoading(true);
    setWatchResults([]);
    try {
      const data = await api("/offers/live?market=ALL&offset=0&limit=200&refresh=1");
      const allOffers = data.offers || [];
      const results = [];
      for (const watch of watchlist) {
        const term = watch.searchTerm.toLowerCase();
        const matches = allOffers.filter((o) => o.title && o.title.toLowerCase().includes(term));
        for (const m of matches) results.push({ ...m, watchTerm: watch.searchTerm });
      }
      setWatchResults(results);
    } catch (e) { console.error(e); }
    setWatchLoading(false);
  };

  const searchOffers = async () => {
    if (!offerSearch.trim()) return;
    setOfferSearching(true);
    setOfferSearchResults([]);
    setOfferSearchMeta(null);
    try {
      const data = await api("/offers/live?market=ALL&offset=0&limit=200&refresh=1");
      const allOffers = data.offers || [];
      const term = offerSearch.toLowerCase();
      const matches = allOffers.filter((o) => o.title && o.title.toLowerCase().includes(term));
      setOfferSearchResults(matches);
      setOfferSearchMeta({ total: data.total, matches: matches.length });
    } catch (e) { console.error(e); }
    setOfferSearching(false);
  };

  const exportCsv = async () => {
    if (!session) return;
    try {
      const data = await api(/offers/export?markets=&format=csv, {}, session.token);
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "einkauf-nach-markt.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };
  return (
    <div className="page-shell">
      <div className="hero">
        <p className="eyebrow">Angebote</p>
        <h1>Markt-Angebote durchsuchen & vergleichen</h1>
      </div>

      <div className="dashboard-grid wide" style={{marginTop:"1.4rem"}}>
        <section className="card">
          <h2>📰 Live-Angebote</h2>
          <div className="live-controls">
            <label>
              Ansicht
              <select value={liveMarketView} onChange={(e) => { setLiveMarketView(e.target.value); setLiveOffersOffset(0); }}>
                <option value="ALL">Alle M\u00e4rkte</option>
                {MARKETS.map((m) => <option value={m} key={iew-\}>{m}</option>)}
              </select>
            </label>
            <button type="button" className="ghost" onClick={() => loadLiveOffers(true)}>Neu laden</button>
          </div>
          <ul className="live-offers-list">
            {liveOffers.map((offer, i) => (
              <li key={\-\}>
                <div>
                  <strong>{offer.market}</strong>
                  <p>{offer.title}</p>
                </div>
                <div className="offer-meta">
                  <span>{Number.isFinite(offer.price) ? \ EUR : "Preis n/a"}</span>
                  <a href={offer.url} target="_blank" rel="noreferrer">\u00d6ffnen</a>
                </div>
              </li>
            ))}
          </ul>
          {liveOffersHasMore && (
            <button type="button" onClick={() => loadLiveOffers(false)} disabled={loadingLiveOffers}>
              {loadingLiveOffers ? "L\u00e4dt..." : "Mehr Angebote laden"}
            </button>
          )}
        </section>

        <section className="card">
          <h2>🔍 Angebotssuche</h2>
          <p className="muted">Durchsuche alle aktuellen Angebote nach Stichwort</p>
          <div className="add-form" style={{gridTemplateColumns:"1fr auto"}}>
            <input type="text" placeholder="z. B. H\u00e4hnchen, Milch..."
              value={offerSearch}
              onChange={(e) => setOfferSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchOffers()}
            />
            <button type="button" onClick={searchOffers} disabled={offerSearching}>
              {offerSearching ? "Suche..." : "Suchen"}
            </button>
          </div>
          {offerSearchMeta && (
            <p className="muted" style={{margin:"0.5rem 0"}}>
              {offerSearchMeta.matches} Treffer in {offerSearchMeta.total} Angeboten
            </p>
          )}
          <ul className="live-offers-list">
            {offerSearchResults.map((offer, i) => (
              <li key={sr-\-\}>
                <div><strong>{offer.market}</strong><p>{offer.title}</p></div>
                <div className="offer-meta">
                  <span>{Number.isFinite(offer.price) ? \ EUR : "Preis n/a"}</span>
                  <a href={offer.url} target="_blank" rel="noreferrer">\u00d6ffnen</a>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>👀 Angebots-Watchlist</h2>
          <p className="muted">Lege Suchbegriffe fest, auf die du lauschen m\u00f6chtest</p>
          <div className="add-form" style={{gridTemplateColumns:"1fr auto"}}>
            <input type="text" placeholder="z. B. H\u00e4hnchenbrust"
              value={watchSearch}
              onChange={(e) => setWatchSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWatchItem()}
            />
            <button type="button" onClick={addWatchItem}>Hinzuf\u00fcgen</button>
          </div>
          {watchlist.length > 0 && (
            <>
              <ul className="recurring-list">
                {watchlist.map((w) => (
                  <li key={w.id}>
                    <span>🔔 {w.searchTerm}</span>
                    <button type="button" className="danger" onClick={() => removeWatchItem(w.id)}>✕</button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={searchWatchlist} disabled={watchLoading} style={{marginTop:"0.5rem"}}>
                {watchLoading ? "Suche..." : "Jetzt nach Angeboten suchen"}
              </button>
            </>
          )}
          {watchResults.length > 0 && (
            <ul className="live-offers-list" style={{marginTop:"0.5rem"}}>
              {watchResults.map((offer, i) => (
                <li key={wr-\-\}>
                  <div>
                    <strong>{offer.market}</strong>
                    <p>{offer.title}</p>
                    <span className="muted">🔍 {offer.watchTerm}</span>
                  </div>
                  <div className="offer-meta">
                    <span>{Number.isFinite(offer.price) ? \ EUR : "Preis n/a"}</span>
                    <a href={offer.url} target="_blank" rel="noreferrer">\u00d6ffnen</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dashboard-grid" style={{marginTop:"1rem"}}>
        <section className="card">
          <h2>🏪 Filialen ausw\u00e4hlen</h2>
          <p className="muted">W\u00e4hle deine Stamm-Filialen f\u00fcr genauere Angebote</p>
          <div className="locations-grid">
            {MARKETS.map((market) => {
              const loc = locations[market];
              const form = locationForms[market] || {};
              return (
                <div className="location-entry" key={market}>
                  <strong>{market}</strong>
                  <div style={{display:"grid", gap:"0.3rem"}}>
                    <input type="text" placeholder="Filialname"
                      value={form.locationName ?? loc?.locationName ?? ""}
                      onChange={(e) => setLocationForms((prev) => ({...prev, [market]: {...prev[market], locationName: e.target.value}}))}
                    />
                    <input type="text" placeholder="URL (optional)"
                      value={form.locationUrl ?? loc?.locationUrl ?? ""}
                      onChange={(e) => setLocationForms((prev) => ({...prev, [market]: {...prev[market], locationUrl: e.target.value}}))}
                    />
                    <button type="button" className="ghost" onClick={() => saveLocation(market)}>
                      {loc ? "Aktualisieren" : "Speichern"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>💰 Preisvergleich</h2>
          <div className="switch-row">
            {MARKETS.map((m) => (
              <button key={m} type="button"
                className={	ab \}
                onClick={() => toggleMarket(m)}
              >{m}</button>
            ))}
          </div>
          <button type="button" onClick={loadComparison} disabled={loadingOffers}>
            {loadingOffers ? "Vergleiche..." : "Vergleichen"}
          </button>
          <button type="button" className="ghost" onClick={exportCsv} style={{marginLeft:"0.5rem"}}>
            Export CSV
          </button>
          {offersResult?.recommendation && (
            <div className="recommendation" style={{marginTop:"0.8rem"}}>
              <strong>Empfehlung: {offersResult.recommendation.market}</strong>
              <p>Abdeckung: {offersResult.recommendation.coveredItems}/{offersResult.recommendation.totalItems} Artikel, Gesamtpreis: {offersResult.recommendation.totalPrice.toFixed(2)} EUR</p>
            </div>
          )}
          {offersResult?.marketTotals?.length > 0 && (
            <ul className="offer-summary">
              {offersResult.marketTotals.map((entry) => (
                <li key={entry.market}><strong>{entry.market}</strong>: {entry.coveredItems}/{entry.totalItems} | {entry.totalPrice.toFixed(2)} EUR</li>
              ))}
            </ul>
          )}
          {offersResult?.bestPerItem?.length > 0 && (
            <ul className="offer-summary">
              {offersResult.bestPerItem.map((entry) => (
                <li key={entry.itemName}>{entry.itemName}: {entry.best ? ${entry.best.market} ( EUR) : "nicht gefunden"}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
