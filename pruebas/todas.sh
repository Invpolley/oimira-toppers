#!/bin/bash
# Corre las pruebas de Toppers. Uso: bash pruebas/todas.sh [--todo]   (TP_URL=https://… para t-exportar contra el sitio publicado)
# La revisión cruzada (t-matriz: 12 modelos × 5 formas × 5 apoyos) tarda unos 15 minutos: solo corre con --todo.
cd "$(dirname "$0")/.." || exit 1
mal=0
for t in pruebas/t-*.mjs; do
  if [ "$(basename "$t")" = "t-matriz.mjs" ] && [ "$1" != "--todo" ]; then continue; fi
  r=$(node "$t" 2>&1 | tail -1); echo "$(basename "$t"): $r"
  case "$r" in *"comprobaciones OK") ;; *) mal=1 ;; esac
done
exit $mal
