#!/bin/bash
# Executado no clone /opt/hotspot-source; nunca reimporta o banco inicial.
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
[ "$EUID" -eq 0 ] || { echo "Execute com sudo."; exit 1; }
APP=/var/www/hotspot
STATE="$APP/.deployment.json"
[ -f "$STATE" ] || { echo "Instalacao sem registro GitHub. Migre este servidor antes de atualizar."; exit 1; }
SOURCE=$(node -e 'console.log(require(process.argv[1]).source)' "$STATE")
REF=$(node -e 'console.log(require(process.argv[1]).ref)' "$STATE")
BACKEND_PORT=$(APP="$APP" node -e 'require(process.env.APP+"/backend/node_modules/dotenv").config({path:process.env.APP+"/backend/.env",quiet:true});console.log(process.env.PORT||3001)')
OLD_COMMIT=$(node -e 'console.log(require(process.argv[1]).commit)' "$STATE")
exec 9>/var/lock/hotspot-update.lock
flock -n 9 || { echo "Outra atualizacao esta em andamento"; exit 1; }
for executable in git rsync npm mysqldump pm2; do command -v "$executable" >/dev/null || { echo "Comando ausente: $executable"; exit 1; }; done
git -C "$SOURCE" fetch origin "$REF"
COMMIT=$(git -C "$SOURCE" rev-parse FETCH_HEAD)
[ "$COMMIT" != "$OLD_COMMIT" ] || { echo "Sistema ja esta atualizado: $COMMIT"; exit 0; }
STAGE=$(mktemp -d /var/tmp/hotspot-update.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT
git -C "$SOURCE" archive "$COMMIT" | tar -x -C "$STAGE"
cd "$STAGE/hotspot/frontend"
npm ci
NODE_OPTIONS=--max-old-space-size=4096 npm run build
cd "$STAGE/hotspot/backend"
npm ci --omit=dev
for file in server.js deploy-migrations.js; do node --check "$file"; done
BACKUP="/var/backups/hotspot/$(date +%Y%m%d-%H%M%S)-${OLD_COMMIT:0:12}"
install -d -m 700 "$BACKUP"
cp -a "$APP" "$BACKUP/app"
# The option file is private and credentials never appear on command lines.
APP="$APP" STAGE="$STAGE" node - <<'NODE'
const path=require('path'),fs=require('fs');
require(path.join(process.env.APP,'backend/node_modules/dotenv')).config({path:path.join(process.env.APP,'backend/.env'),quiet:true});
const quote=v=>'"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r')+'"';
fs.writeFileSync(path.join(process.env.STAGE,'mysql.cnf'),'[client]\n'+[['host',process.env.DB_HOST],['user',process.env.DB_USER],['password',process.env.DB_PASSWORD],['port',process.env.DB_PORT||3306]].map(([k,v])=>`${k}=${quote(v)}`).join('\n')+'\n',{mode:0o600});
fs.writeFileSync(path.join(process.env.STAGE,'db-name'),process.env.DB_NAME);
NODE
DB_NAME=$(cat "$STAGE/db-name")
mysqldump --defaults-extra-file="$STAGE/mysql.cnf" --single-transaction --routines --triggers "$DB_NAME" > "$BACKUP/database.sql"
cp "$APP/backend/.env" "$STAGE/hotspot/backend/.env"
chmod 600 "$STAGE/hotspot/backend/.env"
echo "Backup completo: $BACKUP"
pm2 stop hotspot-api
rollback_code() {
  echo "Falha na atualizacao. Restaurando o codigo anterior; backup do banco: $BACKUP/database.sql"
  rsync -a --delete "$BACKUP/app/backend/" "$APP/backend/"
  rsync -a --delete "$BACKUP/app/frontend/" "$APP/frontend/"
  pm2 restart hotspot-api --update-env || true
  echo "Migrations SQL podem fazer auto-commit. Se necessario, restaure o banco do backup antes de liberar producao."
}
trap 'rollback_code; exit 1' ERR
cd "$STAGE/hotspot/backend"
node deploy-migrations.js
node configure-radius-privacy.js "$BACKUP"
rsync -a --delete --exclude=.env --exclude=uploads/ --exclude=certificados/ --exclude=tokens/ "$STAGE/hotspot/backend/" "$APP/backend/"
rsync -a --delete --exclude=public/uploads/ --exclude=dist/uploads/ "$STAGE/hotspot/frontend/" "$APP/frontend/"
pm2 restart hotspot-api --update-env
for attempt in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/planos-publicos" >/dev/null; then break; fi
  [ "$attempt" != 20 ] || { false; }
  sleep 1
done
COMMIT="$COMMIT" STATE="$STATE" node - <<'NODE'
const fs=require('fs');const state=JSON.parse(fs.readFileSync(process.env.STATE));state.commit=process.env.COMMIT;fs.writeFileSync(process.env.STATE,JSON.stringify(state,null,2),{mode:0o600});
NODE
pm2 save
trap - ERR
echo "Atualizacao concluida: $COMMIT. Backup: $BACKUP"
