# Family Shopping List Web App

Eine voll funktionsfahige Web-App mit:

- Authentifizierung mit Benutzername + Passwort (ohne E-Mail)
- Familien-System (Familie erstellen und per Code beitreten)
- Gemeinsamer Einkaufsliste
- Echtzeit-Synchronisierung mit Socket.IO
- Rezeptsuche im Chefkoch-Bereich (Server-seitige Suche)
- Zutaten auswaehlen und Gerichte dazu vorschlagen lassen
- Angebotsvergleich fuer LIDL, EDEKA, ALDI und REWE
- Live-Angebote je Markt oder marktuebergreifend durchscrollen
- Export "Einkauf nach Markt" als CSV

## Projektstruktur

- `backend`: Express API, JSON-Dateispeicher, Socket.IO, Chefkoch-Suche
- `frontend`: React + Vite Benutzeroberflache

## Voraussetzungen

- Node.js 20+ (inkl. npm)

## Setup

1. Node.js installieren (falls `npm` noch nicht verfugbar ist).
2. Backend Dependencies installieren:
   - `cd backend`
   - `npm install`
3. Frontend Dependencies installieren:
   - `cd ../frontend`
   - `npm install`

## Umgebungsvariablen

Backend:

1. `cd backend`
2. `.env.example` nach `.env` kopieren

Frontend:

1. `cd frontend`
2. `.env.example` nach `.env` kopieren

## Starten

Terminal 1 (Backend):

- `cd backend`
- `npm run dev`

Terminal 2 (Frontend):

- `cd frontend`
- `npm run dev`

Danach im Browser offnen:

- `http://localhost:5173`

## API Kurzuberblick

- `POST /api/auth/register` Account erstellen (Modus `create` oder `join`)
- `POST /api/auth/login` Login mit Familien-Code + Username + Passwort
- `GET /api/auth/me` Session pruefen
- `GET /api/families/:familyId/list` Einkaufsliste laden (auth)
- `POST /api/families/:familyId/items` Item anlegen (auth)
- `PATCH /api/families/:familyId/items/:itemId` Item andern/abhaken (auth)
- `DELETE /api/families/:familyId/items/:itemId` Item loeschen (auth)
- `GET /api/recipes/search?q=...` Freie Rezeptsuche
- `GET /api/recipes/by-ingredients?ingredients=a,b,c` Rezeptsuche aus Zutaten
- `GET /api/offers/markets` Verfuegbare Maerkte
- `GET /api/offers/live?market=ALL&offset=0&limit=18` Live-Angebote (scrollbar/paginiert)
- `GET /api/offers/compare?markets=LIDL,ALDI` Preisvergleich mit Einkaufsliste (auth)
- `GET /api/offers/export?markets=LIDL,ALDI&format=csv` Export Einkauf nach Markt (auth)

## Hinweise zur Chefkoch-Suche

Die Rezeptsuche wird im Backend gemacht, damit CORS im Browser kein Problem ist.
Wenn Chefkoch seine Seitenstruktur andert oder Requests blockiert, kann die Suche temporar keine Ergebnisse liefern.

## Hinweise zu Angeboten

Die Live-Angebote werden aus web-basierten Quellen aggregiert und regelmaessig neu geladen.
Fuer den Preisvergleich gibt es einen Fallback-Datensatz, falls eine Live-Quelle temporar nicht erreichbar ist.
