#!/usr/bin/env bash
set -euo pipefail

revision="${1:?Missing commit SHA}"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || exit 1
cd /opt/projects/ingenio_arrocero

# Do not discard changes made directly on the server.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Deploy detenido: hay cambios versionados pendientes en el servidor.' >&2
  exit 1
fi
if [[ "$(git branch --show-current)" != main ]]; then
  echo 'Deploy detenido: el checkout del servidor debe estar en main.' >&2
  exit 1
fi
if git ls-files --error-unmatch backend/.env >/dev/null 2>&1; then
  echo 'Deploy detenido: retira backend/.env del seguimiento de Git primero.' >&2
  exit 1
fi

git fetch origin main
git merge-base --is-ancestor "$revision" origin/main
git merge --ff-only "$revision"

docker compose config --quiet
# Build before replacing running containers. Keep volumes and nginx untouched.
docker compose build
docker compose up -d --no-build
docker compose ps

ready=false
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:8082/ >/dev/null &&
     docker compose exec -T backend node -e \
       'require("./dist/db/connection").default.authenticate().then(() => process.exit(0)).catch(() => process.exit(1))'; then
    ready=true
    break
  fi
  sleep 2
done
if [[ "$ready" != true ]]; then
  echo 'Deploy aplicado pero la verificacion basica fallo; revisar contenedores. No hay rollback automatico.' >&2
  exit 1
fi
echo "Deploy completado: $revision (frontend HTTP y conexion a base verificados)."
