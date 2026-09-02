import { NavLink } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function NavBar({ session, onLogout }) {
  const { theme, editorMode, setEditorMode, t } = useApp();

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="btn btn-text" onClick={() => setEditorMode(!editorMode)}>
          {editorMode ? "✅ Editor verlassen" : "✏️ Editor"}
        </button>
      </div>
      <div className="navbar-brand">
        <NavLink to="/">🛒 {t("nav.list")}</NavLink>
      </div>
      <div className="navbar-right">
        <NavLink to="/" className="nav-link" title={t("nav.home")}>🏠 <span className="nav-label">{t("nav.home")}</span></NavLink>
        <NavLink to="/offers" className="nav-link" title={t("nav.offers")}>🏷️ <span className="nav-label">{t("nav.offers")}</span></NavLink>
        <NavLink to="/rezepte" className="nav-link" title={t("nav.recipes")}>🍳 <span className="nav-label">{t("nav.recipes")}</span></NavLink>
        <NavLink to="/settings" className="nav-link" title={t("nav.settings")}>⚙️ <span className="nav-label">{t("nav.settings")}</span></NavLink>
        {session ? (
          <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }}>
            Abmelden ({session.username})
          </a>
        ) : (
          <NavLink to="/login">Anmelden</NavLink>
        )}
        <button className="btn-icon" onClick={theme.toggleDarkMode}>
          {theme.darkMode ? "🌞" : "🌚"}
        </button>
      </div>
    </nav>
  );
}
