#!/bin/bash
# Corre todas las pruebas de Toppers. Uso: bash pruebas/todas.sh   (TP_URL=https://… para t-exportar contra el sitio publicado)
cd "$(dirname "$0")/.." || exit 1
mal=0
for t in pruebas/t-*.mjs; do
  r=$(node "$t" 2>&1 | tail -1); echo "$(basename "$t"): $r"
  case "$r" in *"comprobaciones OK") ;; *) mal=1 ;; esac
done
exit $mal
