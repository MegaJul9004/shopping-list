import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp, api } from "../context/AppContext";
import NavBar from "../components/NavBar";

const ROLE_LABEL = {
  admin: "Familien-Admin",
  viceadmin: "Vizeadmin",
  member: "Mitglied"
};

export default function FamiliePage() {
  const { session, setSession, t } = useApp();
  const [members, setMembers] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const isAdmin = session?.familyRole === "admin";

  const load = async () => {
    if (!session) return;
    try {
      const data = await api(`/families/${session.familyId}/members`, {}, session.token);
      setMembers(data.members || []);
    } catch (e) { setMsg("Fehler beim Laden: " + e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [session]);

  const makeViceAdmin = async (userId) => {
    setMsg("");
    try {
      await api(`/families/${session.familyId}/members/${userId}/viceadmin`, { method: "POST", body: JSON.stringify({}) }, session.token);
      setMsg("✓ Vizeadmin ernannt");
      load();
    } catch (e) { setMsg("Fehler: " + e.message); }
  };

  const removeMember = async (userId) => {
    setMsg("");
    if (!window.confirm("Dieses Mitglied wirklich aus der Familie entfernen?")) return;
    try {
      await api(`/families/${session.familyId}/members/${userId}`, { method: "DELETE" }, session.token);
      setMsg("✓ Mitglied entfernt");
      load();
    } catch (e) { setMsg("Fehler: " + e.message); }
  };

  return (
    <div className="page-shell">
      <NavBar session={session} onLogout={() => { if (typeof window !== "undefined") { localStorage.removeItem("shopping_session"); window.location.href = "/"; } setSession(null); }} />
      <div className="hero" style={{ background: "linear-gradient(135deg, #264653, #2a9d8f)" }}>
        <p className="eyebrow">Familie</p>
        <h1>👨‍👩‍👧 Familie & Mitglieder</h1>
        <p className="muted" style={{ color: "#cde3e3", marginTop: "0.4rem" }}>Familie: {session?.familyName} · Code: {session?.familyId}</p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
          <Link to="/" className="btn-inline">← Zurück zur Startseite</Link>
          <Link to="/settings" className="btn-inline">⚙️ Einstellungen</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1.4rem", padding: "1.2rem" }}>
        <h2>Mitglieder</h2>
        {loading ? (
          <p className="muted">Lädt...</p>
        ) : members.length === 0 ? (
          <p className="muted">Keine Mitglieder gefunden.</p>
        ) : (
          <ul className="recurring-list">
            {members.map((m) => (
              <li key={m.id}>
                <div style={{ flex: 1 }}>
                  <strong>{m.username}</strong>
                  <span className="muted"> · #{m.userNumber}</span>
                  {m.familyRole === "admin" && <span className="item-qty" style={{ marginLeft: "0.4rem" }}>Admin</span>}
                  {m.familyRole === "viceadmin" && <span className="item-qty" style={{ marginLeft: "0.4rem" }}>Vizeadmin</span>}
                  {m.id === session?.id && <span className="item-qty" style={{ marginLeft: "0.4rem" }}>(Du)</span>}
                </div>
                <div className="muted" style={{ fontSize: "0.8rem" }}>{ROLE_LABEL[m.familyRole] || "Mitglied"}</div>
                {isAdmin && m.familyRole === "member" && m.id !== session?.id && (
                  <div className="item-actions">
                    <button className="ghost" onClick={() => makeViceAdmin(m.id)}>Vizeadmin ernennen</button>
                    <button className="danger" onClick={() => removeMember(m.id)}>Entfernen</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="muted" style={{ color: msg.includes("Fehler") ? "var(--danger)" : "var(--ok)" }}>{msg}</p>}
        {!isAdmin && <p className="muted" style={{ marginTop: "0.6rem" }}>Nur der Familien-Admin kann Mitglieder verwalten.</p>}
      </div>
    </div>
  );
}
