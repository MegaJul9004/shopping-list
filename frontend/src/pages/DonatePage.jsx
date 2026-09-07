import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, api } from "../context/AppContext";
import NavBar from "../components/NavBar";

// Fallback: aus frontend/.env (gitignored) - wird von den Backend-Werten ueberdeckt.
const FB_IBAN = import.meta.env.VITE_IBAN || "DE00 1234 5678 9012 3456 78";
const FB_BIC = import.meta.env.VITE_BIC || "DUMMYDEFFXXX";
const FB_BENEFICIARY = import.meta.env.VITE_BENEFICIARY || "Einkaufsliste Projekt";
const FB_PURPOSE = import.meta.env.VITE_PURPOSE || "Spende Einkaufsliste";

const CAN_EDIT = ["owner", "developer", "admin"];

function cleanIban(v) { return String(v || "").replace(/s+/g, "").toUpperCase(); }

function formatIban(v) {
  const c = cleanIban(v);
  return c ? c.replace(/(.{4})/g, "$1 ").trim() : "";
}

export default function DonatePage() {
  const { session, setSession } = useApp();
  const [copied, setCopied] = useState(false);
  const [sponsor, setSponsor] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ iban: "", bic: "", beneficiary: "", purpose: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const role = session?.role || "user";
  const canEdit = CAN_EDIT.includes(role);

  useEffect(() => {
    let cancelled = false;
    api("/sponsor", {}, session?.token || null)
      .then((data) => {
        if (cancelled) return;
        const s = data.sponsor || {};
        const val = {
          iban: s.iban || FB_IBAN,
          bic: s.bic || FB_BIC,
          beneficiary: s.beneficiary || FB_BENEFICIARY,
          purpose: s.purpose || FB_PURPOSE
        };
        setSponsor(val);
        setForm({ iban: val.iban, bic: val.bic, beneficiary: val.beneficiary, purpose: val.purpose });
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          const val = { iban: FB_IBAN, bic: FB_BIC, beneficiary: FB_BENEFICIARY, purpose: FB_PURPOSE };
          setSponsor(val);
          setForm(val);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText(formatIban(sponsor?.iban || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const save = async () => {
    setMsg("");
    try {
      const data = await api("/admin/sponsor", {
        method: "POST",
        body: JSON.stringify({
          iban: cleanIban(form.iban),
          bic: form.bic.trim(),
          beneficiary: form.beneficiary.trim(),
          purpose: form.purpose.trim()
        })
      }, session.token);
      if (data.sponsor) setSponsor(data.sponsor);
      setEditing(false);
      setMsg("✓ Gespeichert");
    } catch (e) {
      setMsg("Fehler: " + e.message);
    }
  };

  return (
    <div className="page-shell">
      <NavBar session={session} onLogout={() => { if (typeof window !== "undefined") { localStorage.removeItem("shopping_session"); setSession(null); } }} />
      <header className="hero">
        <p className="eyebrow">Unterstützung</p>
        <h1>❤️ Spenden</h1>
        <p>Magst du die Einkaufsliste? Mit einer kleinen Spende unterstützt du die Weiterentwicklung des Projekts.</p>
      </header>

      <div className="donate-card">
        <h2>Banküberweisung</h2>
        <p className="muted">Überweise deinen Spendenbetrag bequem auf das folgende Konto:</p>
        {loading ? (
          <p className="muted">Lädt...</p>
        ) : editing ? (
          <div>
            <label>Empfänger
              <input type="text" value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} />
            </label>
            <label>IBAN
              <input type="text" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
            </label>
            <label>BIC
              <input type="text" value={form.bic} onChange={(e) => setForm({ ...form, bic: e.target.value })} />
            </label>
            <label>Verwendungszweck
              <input type="text" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </label>
            <div className="switch-row">
              <button onClick={save}>Speichern</button>
              <button className="ghost" onClick={() => setEditing(false)}>Abbrechen</button>
            </div>
            {msg && <p className="muted">{msg}</p>}
          </div>
        ) : (
          <>
            <table className="donate-table">
              <tbody>
                <tr><td>Empfänger</td><td>{sponsor?.beneficiary}</td></tr>
                <tr><td>IBAN</td><td className="donate-iban">{formatIban(sponsor?.iban)}</td></tr>
                <tr><td>BIC</td><td>{sponsor?.bic}</td></tr>
                <tr><td>Verwendungszweck</td><td>{sponsor?.purpose}</td></tr>
              </tbody>
            </table>
            <button type="button" className="ghost" onClick={copyIban} style={{ marginTop: "0.5rem" }}>
              {copied ? "✓ IBAN kopiert" : "📋 IBAN kopieren"}
            </button>
            {canEdit && (
              <button type="button" className="ghost" style={{ marginLeft: "0.5rem" }} onClick={() => { setForm({ iban: sponsor?.iban || "", bic: sponsor?.bic || "", beneficiary: sponsor?.beneficiary || "", purpose: sponsor?.purpose || "" }); setMsg(""); setEditing(true); }}>
                ✏️ Spenden-Infos ändern
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
        <Link to="/" className="btn-inline">← Zurück zur Startseite</Link>
      </div>
    </div>
  );
}
