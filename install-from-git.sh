#!/bin/bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"
[ "$EUID" -eq 0 ] || { echo "Execute com sudo."; exit 1; }
REPOSITORY=${1:?Informe a URL SSH ou HTTPS do repositorio}
ENVIRONMENT=${2:-production}
case "$ENVIRONMENT" in
  testing) REF=develop ;;
  production) REF=main ;;
  *) echo "Ambiente deve ser testing ou production"; exit 1 ;;
esac
[ ! -f /var/www/hotspot/backend/.env ] || { echo "Sistema ja instalado. Use update.sh."; exit 1; }
SOURCE=/opt/hotspot-source
[ ! -e "$SOURCE" ] || { echo "$SOURCE ja existe. Use um clone novo ou revise a instalacao anterior."; exit 1; }
apt-get update
apt-get install -y git ca-certificates
git clone --branch "$REF" --single-branch "$REPOSITORY" "$SOURCE"
cd "$SOURCE"
bash install.sh
COMMIT=$(git rev-parse HEAD)
ENVIRONMENT="$ENVIRONMENT" REF="$REF" SOURCE="$SOURCE" COMMIT="$COMMIT" node - <<'NODE'
const fs=require('fs');
fs.writeFileSync('/var/www/hotspot/.deployment.json',JSON.stringify({environment:process.env.ENVIRONMENT,ref:process.env.REF,source:process.env.SOURCE,commit:process.env.COMMIT},null,2),{mode:0o600});
NODE
echo "Instalado: $ENVIRONMENT, $REF, $COMMIT"
