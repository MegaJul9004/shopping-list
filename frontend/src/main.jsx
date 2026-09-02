import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import App from './App';
import SettingsPage from './pages/SettingsPage';
import OffersPage from './pages/OffersPage';
import RecipesPage from './pages/RecipesPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/rezepte" element={<RecipesPage />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
);
