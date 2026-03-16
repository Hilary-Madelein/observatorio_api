#!/bin/sh
set -e

FLAG="/usr/src/app/.initialized"

if [ ! -f "$FLAG" ]; then
  echo "Primera ejecución: esperando a Postgres..."
  until nc -z db 5432; do sleep 1; done
  echo "Postgres listo, arrancando API en segundo plano…"
  npm start &
  APP_PID=$!

  echo "Esperando a que la API HTTP esté disponible en el puerto 3006…"
  until nc -z localhost 3006; do sleep 1; done

  echo "API lista, ejecutando migración inicial vía HTTP…"
  curl -s "http://localhost:3006/api/privado/${KEY_SQ}" \
    || echo "curl falló"

  touch "$FLAG"

  kill $APP_PID
fi

echo "▶️ Ejecutando arranque normal de la API"
exec npm start
