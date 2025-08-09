#!/usr/bin/env bash
# Genera docs/nai/version.js con una versión basada en fecha UTC + hash corto de commit.
# Uso manual: ./docs/nai/update-version.sh
# Para ejecutarlo automáticamente antes de cada commit: crear un hook pre-commit.
#   echo "#!/usr/bin/env bash" > .git/hooks/pre-commit
#   echo "./docs/nai/update-version.sh" >> .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
# Nota: El hash usado es el del HEAD actual (el commit previo). Si necesitas el hash exacto del commit nuevo,
# tendrías que usar un hook post-commit y aceptar que no quede versionado dentro del propio commit.

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
TARGET="$REPO_ROOT/docs/nai/version.js"
DATE_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)
STAMP=$(date -u +%Y.%m.%d-%H%M%S)
HASH=$(git rev-parse --short HEAD 2>/dev/null || echo nohash)
COUNT=$(git rev-list --count HEAD 2>/dev/null || echo 0)
VERSION="${STAMP}-c${COUNT}-${HASH}"

cat > "$TARGET" <<EOF
// Archivo generado automáticamente - NO editar manualmente
// Fecha de generación (UTC): $DATE_UTC
// Versión compuesta: fecha-horaUTC + contador de commits + hash corto
window.__APP_VERSION__ = '$VERSION';
EOF

echo "Generado $TARGET => $VERSION"
