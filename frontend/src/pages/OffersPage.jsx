import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, api } from "../context/AppContext";

const MARKETS = ["LIDL", "EDEKA", "ALDI", "REWE"];


function OfferCard({ offer, showWatchTerm }) {
  const im = offer.image || '';
  return (
    <div className='offer-card'>
      {im ? <img src={im} alt={offer.title} className='offer-card-img' /> : <div className='offer-card-img offer-card-img-placeholder'><span>{showWatchTerm ? '🔍' : '📦'}</span></div>}
      <div className='offer-card-body'>
        <span className='offer-market-badge'>{offer.market}</span>
        <h4 className='offer-card-title'>{offer.title}</h4>
        {showWatchTerm && <p className='muted' style={{fontSize:'0.8rem',margin:0}}>🔍 {offer.watchTerm}</p>}
        <div className='offer-card-price'>{Number.isFinite(offer.price) ? offer.price.toFixed(2) + ' €' : (showWatchTerm ? 'n/a' : 'Preis n/a')}</div>
        <a href={offer.url} target='_blank' rel='noreferrer' className='offer-card-link'>{showWatchTerm ? 'öffnen ->' : 'Angebot öffnen ->'}</a>
      </div>
    </div>
  );
}


export default function OffersPage() {
  const { session, theme } = useApp();
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekInfo, setWeekInfo] = useState({ current: null, next: null });
  const [unavailableMarkets, setUnavailableMarkets] = useState(null);
  const [currentWeekRange, setCurrentWeekRange] = useState(null);

  async function loadWeekInfo() {
    try {
      const data = await api("/offers/week-info");
      setWeekInfo(data);
    } catch (e) { console.error(e); }
  }

  async function loadLiveOffers(refresh) {
    setLoadingLiveOffers(true);
    setUnavailableMarkets(null);
    try {
      const offset = refresh ? 0 : liveOffersOffset;
      const refreshParam = refresh ? "&refresh=1" : "";
      const data = await api(`/offers/live?market=${liveMarketView}&offset=${offset}&limit=20${refreshParam}&week=${weekOffset}`);
      if (refresh) setLiveOffers(data.offers);
      else setLiveOffers((prev) => [...prev, ...data.offers]);
      setLiveOffersHasMore(data.hasMore);
      setLiveOffersOffset(offset + data.offers.length);
      setUnavailableMarkets(data.unavailableMarkets || null);
      if (data.week) setCurrentWeekRange(data.week);
    } catch (e) { console.error(e); }
    setLoadingLiveOffers(false);
  }

  useEffect(() => { loadWeekInfo(); }, []);

  useEffect(() => {
    setLiveOffers([]);
    setLiveOffersOffset(0);
    loadLiveOffers(true);
  }, [liveMarketView, weekOffset]);

  const loadComparison = useCallback(async () => {
    if (!session) return;
    setLoadingOffers(true);
    try {
      const data = await api(`/offers/compare?markets=${selectedMarkets.join(",")}&week=${weekOffset}`, {}, session.token);
      setOffersResult(data);
    } catch (e) { console.error(e); }
    setLoadingOffers(false);
  }, [session, selectedMarkets, weekOffset]);

  const toggleMarket = (m) => {
    setSelectedMarkets((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  useEffect(() => {
    if (!session) return;
    api(`/families/${session.familyId}/branches`, {}, session.token)
      .then((data) => {
        const locs = {};
        for (const [market, branch] of Object.entries(data.branches || {})) locs[market] = branch;
        setLocations(locs);
      }).catch(() => {});
  }, [session]);

  const saveLocation = async (market) => {
    const form = locationForms[market] || {};
    if (!form.branchName && !form.locationName) return;
    try {
      const data = await api(`/families/${session.familyId}/branches/${market}`,
        { method: "POST", body: JSON.stringify({
          branchName: form.branchName || form.locationName,
          branchCity: form.branchCity || "",
          branchZip: form.branchZip || "",
          branchId: form.branchId || "",
          locationUrl: form.locationUrl || ""
        }) }, session.token);
      if (data.branch) setLocations((prev) => ({ ...prev, [market]: data.branch }));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!session) return;
    api(`/families/${session.familyId}/offer-watchlist`, {}, session.token)
      .then((data) => setWatchlist(data.watchlist || [])).catch(() => {});
  }, [session]);

  const addWatchItem = async () => {
    if (!watchSearch.trim() || !session) return;
    try {
      await api(`/families/${session.familyId}/offer-watchlist`,
        { method: "POST", body: JSON.stringify({ searchTerm: watchSearch.trim() }) }, session.token);
      setWatchSearch("");
      const data = await api(`/families/${session.familyId}/offer-watchlist`, {}, session.token);
      setWatchlist(data.watchlist || []);
    } catch (e) { console.error(e); }
  };

  const removeWatchItem = async (watchId) => {
    if (!session) return;
    try {
      await api(`/families/${session.familyId}/offer-watchlist/${watchId}`, { method: "DELETE" }, session.token);
      setWatchlist((prev) => prev.filter((w) => w.id !== watchId));
    } catch (e) { console.error(e); }
  };

  const searchWatchlist = async () => {
    if (watchlist.length === 0) return;
    setWatchLoading(true);
    setWatchResults([]);
    try {
      const data = await api(`/offers/live?market=ALL&offset=0&limit=200&refresh=1&week=${weekOffset}`);
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
      const data = await api(`/offers/live?market=ALL&offset=0&limit=200&refresh=1&week=${weekOffset}`);
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
      const data = await api(`/offers/export?markets=${selectedMarkets.join(",")}&format=csv&week=${weekOffset}`, {}, session.token);
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `einkauf-nach-markt-woche${weekOffset}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const weekLabel = currentWeekRange
    ? `${currentWeekRange.label} (${currentWeekRange.startDE} – ${currentWeekRange.endDE})`
    : (weekOffset === 0 ? "Diese Woche" : "Nächste Woche");

  return (
    <div className="page-shell">
      <div className="hero">
        <p className="eyebrow">Angebote · {weekLabel}</p>
        <h1>Markt-Angebote durchsuchen & vergleichen</h1>
        <div className="switch-row" style={{marginTop:"0.8rem"}}>
          <button type="button" className={weekOffset === 0 ? "tab active" : "tab"} onClick={() => setWeekOffset(0)}>
            📅 Diese Woche{weekInfo.current ? ` · ${weekInfo.current.startDE}–${weekInfo.current.endDE}` : ""}
          </button>
          <button type="button" className={weekOffset === 1 ? "tab active" : "tab"} onClick={() => setWeekOffset(1)}>
            ➡️ Nächste Woche{weekInfo.next ? ` · ${weekInfo.next.startDE}–${weekInfo.next.endDE}` : ""}
            {weekInfo.next && !weekInfo.next.available && <span style={{marginLeft:"0.4rem",fontSize:"0.7rem"}}>⏳</span>}
          </button>
        </div>
        <div style={{display:"flex",gap:"0.5rem",marginTop:"0.6rem"}}>
          <Link to="/" className="btn-inline">← Zurück zur Startseite</Link>
          <Link to="/settings" className="btn-inline">⚙ Einstellungen</Link>
        </div>
      </div>

      <div className="dashboard-grid wide" style={{marginTop:"1.4rem"}}>
        <section className="card">
          <h2>📰 Live-Angebote · {weekLabel}</h2>
          {unavailableMarkets && unavailableMarkets.length > 0 && (
            <div className="error-banner" style={{margin:"0.6rem 0",padding:"0.5rem 0.7rem"}}>
              {unavailableMarkets.map((u, i) => (
                <div key={i}><strong>{u.market}:</strong> {u.reason}</div>
              ))}
            </div>
          )}
          <div className="live-controls">
            <label>Ansicht<select value={liveMarketView} onChange={(e) => { setLiveMarketView(e.target.value); setLiveOffersOffset(0); }}>
              <option value="ALL">Alle Märkte</option>
              {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select></label>
<button type="button" className="ghost" onClick={() => loadLiveOffers(true)}>Neu laden</button>
{unavailableMarkets && (
  <p className="muted" style={{ fontSize: "0.8rem", margin: "0.5rem 0" }}>
    {unavailableMarkets.map(u => `${u.market}: ${u.reason}`).join(" · ")}
  </p>
)}
            <button type="button" className="ghost" onClick={() => loadLiveOffers(true)}>Neu laden</button>
          </div>
          <div className="offer-grid">{liveOffers.map((offer, i) => <OfferCard key={offer.url || i} offer={offer} />)}</div>
{liveOffersHasMore && (
            <button type="button" onClick={() => loadLiveOffers(false)} disabled={loadingLiveOffers}>
              {loadingLiveOffers ? "Lädt..." : "Mehr Angebote laden"}
            </button>
          )}
        </section>

        <section className="card">
          <h2>🔍 Angebotssuche</h2>
          <p className="muted">Durchsuche alle Angebote von {weekLabel} nach Stichwort</p>
          <div className="add-form" style={{gridTemplateColumns:"1fr auto"}}>
            <input type="text" placeholder="z. B. Hähnchen, Milch..." value={offerSearch}
              onChange={(e) => setOfferSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchOffers()}
            />
            <button type="button" onClick={searchOffers} disabled={offerSearching}>
              {offerSearching ? "Suche..." : "Suchen"}
            </button>
          </div>
          {offerSearchMeta && (
            <p className="muted" style={{margin:"0.5rem 0"}}>{offerSearchMeta.matches} Treffer in {offerSearchMeta.total} Angeboten</p>
          )}
          {offerSearchResults.length > 0 && (<div className="offer-grid">{offerSearchResults.map((offer, i) => <OfferCard key={offer.url || i} offer={offer} />)}</div>)}</section>

        <section className="card">
          <h2>👀 Angebots-Watchlist</h2>
          <p className="muted">Suchbegriffe festlegen und auf Angebote aus {weekLabel} lauschen</p>
          <div className="add-form" style={{gridTemplateColumns:"1fr auto"}}>
            <input type="text" placeholder="z. B. Hähnchen" value={watchSearch}
              onChange={(e) => setWatchSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWatchItem()}
            />
            <button type="button" onClick={addWatchItem}>+ Hinzufügen</button>
          </div>
          {watchlist.length > 0 && (
            <>
              <ul className="recurring-list">
                {watchlist.map((w) => (
                  <li key={w.id}><span>🔔 {w.searchTerm}</span><button className="danger" onClick={() => removeWatchItem(w.id)}>✕</button></li>
                ))}
              </ul>
              <button type="button" onClick={searchWatchlist} disabled={watchLoading}>
                {watchLoading ? "Suche..." : "Jetzt prüfen"}
              </button>
            </>
          )}
          {watchResults.length > 0 && (<div className="offer-grid">{watchResults.map((offer, i) => <OfferCard key={i} offer={offer} showWatchTerm={true} />)}</div>)}</section>
      </div>

      <div className="dashboard-grid" style={{marginTop:"1rem"}}>
        <section className="card">
          <h2>🏪 Meine Filialen</h2>
          <p className="muted">Gespeicherte Filialen (bearbeiten in den <Link to="/settings">Einstellungen</Link>)</p>
          <div className="locations-grid">
            {MARKETS.map((market) => {
              const loc = locations[market];
              const form = locationForms[market] || {};
              return (
                <div className="location-entry" key={market}>
                  <strong>{market}</strong>
                  <div style={{display:"grid", gap:"0.3rem"}}>
                    {loc ? (
                      <>
                        <p style={{margin:0}}><strong>{loc.branchName}</strong></p>
                        {loc.branchZip && <span className="muted">PLZ {loc.branchZip}, {loc.branchCity || ""}</span>}
                        {loc.locationUrl && <a href={loc.locationUrl} target="_blank" rel="noreferrer">Angebote öffnen</a>}
                      </>
                    ) : (
                      <p className="muted" style={{margin:0}}>Keine Filiale gespeichert</p>
                    )}
                    <input type="text" placeholder="Filialname" style={{fontSize:"0.85rem"}}
                      value={form.branchName ?? loc?.branchName ?? ""}
                      onChange={(e) => setLocationForms((prev) => ({...prev, [market]: {...prev[market], branchName: e.target.value}}))}
                    />
                    <button type="button" className="ghost" onClick={() => saveLocation(market)} style={{fontSize:"0.85rem"}}>
                      {loc ? "Akt." : "Speichern"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>💰 Preisvergleich · {weekLabel}</h2>
          <div className="switch-row">
            {MARKETS.map((m) => (
              <button key={m} type="button" className={selectedMarkets.includes(m) ? "tab active" : "tab"} onClick={() => toggleMarket(m)}>{m}</button>
            ))}
          </div>
          <button type="button" onClick={loadComparison} disabled={loadingOffers}>
            {loadingOffers ? "Vergleiche..." : "Vergleichen"}
          </button>
          <button type="button" className="ghost" onClick={exportCsv} style={{marginLeft:"0.5rem"}}>Export CSV</button>
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
        </section>
      </div>
    </div>
  );
}
