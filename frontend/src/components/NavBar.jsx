import { NavLink } from "react-router-dom";

export default function NavBar({ theme, onThemeToggle, session, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <NavLink to="/">🛒 Einkaufsliste</NavLink>
      </div>
      <div className="navbar-links">
        {session && (
          <>
            <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} end>
              Dashboard
            </NavLink>
            <NavLink to="/offers" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Angebote
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Einstellungen
            </NavLink>
          </>
        )}
        <button
          type="button"
          className="ghost nav-btn"
          onClick={onThemeToggle}
          title="Farbschema anpassen"
        >
          🎨
        </button>
        {session && (
          <button type="button" className="danger nav-btn" onClick={onLogout}>
            Abmelden
          </button>
        )}
      </div>
    </nav>
  );
}