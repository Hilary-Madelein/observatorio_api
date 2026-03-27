'use strict';

const { CronJob } = require('cron');
const http = require('http');
const https = require('https');

let keepAliveJob = null;

function isKeepAliveEnabled() {
  const raw = process.env.ENABLE_KEEPALIVE_CRON;
  if (raw == null) return true;
  return String(raw).toLowerCase() !== 'false';
}

function resolveKeepAliveUrl() {
  const explicit = process.env.KEEPALIVE_URL;
  if (explicit) return explicit;

  // Fallback local: useful for long-running servers.
  // Note: en entornos serverless (p.ej. Vercel) esto no evita el “sleep”, porque el proceso no corre si está apagado.
  const port = process.env.PORT || '5006';
  return `http://127.0.0.1:${port}/api/`;
}

function requestOnce(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let parsed;

    try {
      parsed = new URL(url);
    } catch (e) {
      return reject(new Error(`KEEPALIVE_URL inválida: ${url}`));
    }

    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers: {
          'User-Agent': 'observatorio-api-keepalive/1.0',
          'Accept': 'application/json,text/plain,*/*',
          'Connection': 'close',
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Consumir el body para liberar socket
        res.resume();
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout ${timeoutMs}ms`));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function runKeepAliveOnce() {
  const url = resolveKeepAliveUrl();
  const { statusCode, durationMs } = await requestOnce(url);
  console.log(`[KeepAlive] GET ${url} -> ${statusCode} (${durationMs}ms)`);
}

function startKeepAliveCron(options = {}) {
  if (!isKeepAliveEnabled()) {
    console.log('[KeepAlive] ENABLE_KEEPALIVE_CRON=false → keepalive deshabilitado.');
    return null;
  }

  if (keepAliveJob) {
    return keepAliveJob;
  }

  // Cada 10 minutos (con segundos) por defecto
  const expression = options.expression || process.env.KEEPALIVE_CRON || '0 */10 * * * *';
  const timezone = options.timezone || process.env.CRON_TZ || 'America/Guayaquil';

  keepAliveJob = new CronJob(
    expression,
    async () => {
      try {
        await runKeepAliveOnce();
      } catch (err) {
        console.error('[KeepAlive] Error:', err.message || err);
      }
    },
    null,
    false,
    timezone
  );

  keepAliveJob.start();
  console.log(`[KeepAlive] Programado: ${expression} (${timezone}) -> ${resolveKeepAliveUrl()}`);

  return keepAliveJob;
}

module.exports = {
  startKeepAliveCron,
  runKeepAliveOnce,
};
