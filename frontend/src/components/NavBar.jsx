import { NavLink } from "react-router-dom"; import { useApp } from "../context/AppContext";

export default function NavBar({ session, onLogout }) { const { theme, editorMode, setEditorMode } = useApp();

return ( <nav className="navbar"> <div className="navbar-left"> <button className="btn btn-text" onClick={() => setEditorMode(!editorMode)} > {editorMode ? "✅ Editor verlassen" : "✏️ Editor"} </button> </div> <div className="navbar-brand"> <NavLink to="/">🛒 Einkaufsliste</NavLink> </div> <div className="navbar-right"> <NavLink to="/settings">⚙️</NavLink> {session ? ( <a href="#" onClick={onLogout}> Abmelden ({session.username}) </a> ) : ( <NavLink to="/login">Anmelden</NavLink> )} <button className="btn-icon" onClick={theme.toggleDarkMode}> {theme.darkMode ? "🌞" : "🌚"} </button> </div> </nav> ); }
