#!/bin/bash
set -e

PROJECT_DIR="/var/www/shopping-list"
BACKUP_DIR="/var/www/shopping-list-backup"
BRANCH="main"
SERVICE_NAME="shopping-list-backend"

cd "$PROJECT_DIR"

# 1. Auf neue Commits prüfen
git fetch origin "$BRANCH"
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/"$BRANCH")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    echo "$(date): Keine neuen Updates vorhanden."
    exit 0
fi

echo "$(date): Neues Update gefunden. Starte Deployment..."

# 2. Backup vom funktionierenden Stand erstellen
rm -rf "$BACKUP_DIR"
cp -r "$PROJECT_DIR" "$BACKUP_DIR"

# 3. Rollback-Funktion definieren
rollback() {
    echo "$(date): FEHLER beim Deployment! Starte Rollback..."
    rm -rf "$PROJECT_DIR"
    cp -r "$BACKUP_DIR" "$PROJECT_DIR"
    systemctl restart "$SERVICE_NAME"
    systemctl reload nginx
    echo "$(date): Rollback erfolgreich! Alter Stand wiederhergestellt."
    exit 1
}

trap rollback ERR

# 4. Code ziehen & bauen
git pull origin "$BRANCH"

cd "$PROJECT_DIR/backend"
npm install --production

cd "$PROJECT_DIR/frontend"
npm install
npm run build

# 5. Dienste neustarten
systemctl restart "$SERVICE_NAME"
systemctl reload nginx

# 6. Healthcheck
sleep 3
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health || true)

if [ "$HEALTH_CHECK" -eq 000 ] || [ "$HEALTH_CHECK" -ge 500 ]; then
    echo "$(date): Healthcheck fehlgeschlagen (HTTP $HEALTH_CHECK)!"
    rollback
fi

echo "$(date): Deployment erfolgreich abgeschlossen!"
