#!/bin/bash
set -e

PROJECT_DIR="/root/server-setup/julien-box/shopping-list"
cd "$PROJECT_DIR"

# Aktuellen Commit-Hash sichern
PREV_COMMIT=$(git rev-parse HEAD)

# Automatische Rollback-Funktion bei Fehlern
rollback() {
  echo ""
  echo "❌ FEHLER BEIM DEPLOYMENT DETEKTIERT!"
  echo "🔄 Stelle vorherigen Stand ($PREV_COMMIT) wieder her..."
  
  cd "$PROJECT_DIR"
  git reset --hard "$PREV_COMMIT"
  
  echo "📦 Baue altes Backend/Frontend neu auf..."
  cd "$PROJECT_DIR/backend" && npm install && pm2 restart shopping-backend || true
  cd "$PROJECT_DIR/frontend" && npm install && npm run build && pm2 restart shopping-frontend || true
  
  echo "⚠️ Rollback abgeschlossen! Die alte funktionierende Version ist wieder online."
  exit 1
}

# Bei jedem Fehler im Skript (ERR) die Funktion rollback ausführen
trap 'rollback' ERR

echo "🚀 Hole aktuelle Änderungen von GitHub..."
git stash
git pull origin main

echo "📦 Aktualisiere Backend..."
cd "$PROJECT_DIR/backend"
npm install
pm2 restart shopping-backend

echo "🏗️ Baue Frontend..."
cd "$PROJECT_DIR/frontend"
npm install
npm run build
pm2 restart shopping-frontend

echo "✅ Deployment erfolgreich abgeschlossen!"
