import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import NavBar from "../components/NavBar";

// Bitte durch deine echte IBAN ersetzen (Beispielwerte):
const IBAN = "DE00 1234 5678 9012 3456 78";
const BIC = "DUMMYDEFFXXX";
const BENEFICIARY = "Einkaufsliste Projekt";
const PURPOSE = "Spende Einkaufsliste";

export default function DonatePage() {
  const { session, setSession } = useApp();
  const [copied, setCopied] = useState(false);

  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText(IBAN.replace(/s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="page-shell">
      <NavBar session={session} onLogout={() => { if (typeof window !== "undefined") { localStorage.removeItem("shopping_session"); window.location.href = "/"; } setSession(null); }} />
      <header className="hero">
        <p className="eyebrow">Unterstützung</p>
        <h1>❤️ Spenden</h1>
        <p>Magst du die Einkaufsliste? Mit einer kleinen Spende unterstützt du die Weiterentwicklung des Projekts.</p>
      </header>

      <div className="donate-card">
        <h2>Banküberweisung</h2>
        <p className="muted">Überweise deinen Spendenbetrag bequem auf das folgende Konto:</p>
        <table className="donate-table">
          <tbody>
            <tr><td>Empfänger</td><td>{BENEFICIARY}</td></tr>
            <tr><td>IBAN</td><td className="donate-iban">{IBAN}</td></tr>
            <tr><td>BIC</td><td>{BIC}</td></tr>
            <tr><td>Verwendungszweck</td><td>{PURPOSE}</td></tr>
          </tbody>
        </table>
        <button type="button" className="ghost" onClick={copyIban} style={{ marginTop: "0.5rem" }}>
          {copied ? "✓ IBAN kopiert" : "📋 IBAN kopieren"}
        </button>
        <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
          Hinweis: Die IBAN ist aktuell ein Platzhalter. Bitte ersetze sie hier durch deine echte IBAN.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
        <Link to="/" className="btn-inline">← Zurück zur Startseite</Link>
      </div>
    </div>
  );
}
