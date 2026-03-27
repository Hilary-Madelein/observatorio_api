'use strict';

const { CronJob } = require('cron');
const MeasurementController = require('../controllers/MeasurementController');

const measurementCtrl = new MeasurementController();

let dailyMaintenanceJob = null;

function isCronEnabled() {
  const raw = process.env.ENABLE_CRON;
  if (raw == null) return true;
  return String(raw).toLowerCase() !== 'false';
}

async function runDailyMaintenance() {
  const fakeReq = {};
  const fakeRes = {
    status: (code) => ({
      json: (body) => console.log('[Cron]', code, body),
    }),
  };

  await measurementCtrl.migrateToDaily(fakeReq, fakeRes);
  console.log('[Cron] Migración a daily completada.');

  await measurementCtrl.cleanOldMeasurements(fakeReq, fakeRes);
  console.log('[Cron] Eliminación de measurements antiguos completa.');
}

function startDailyMaintenanceCron(options = {}) {
  if (!isCronEnabled()) {
    console.log('[Cron] ENABLE_CRON=false → cron deshabilitado.');
    return null;
  }

  if (dailyMaintenanceJob) {
    return dailyMaintenanceJob;
  }

  const expression =
    options.expression || process.env.DAILY_MAINTENANCE_CRON || '0 0 0 * * *';
  const timezone = options.timezone || process.env.CRON_TZ || 'America/Guayaquil';

  dailyMaintenanceJob = new CronJob(
    expression,
    async () => {
      try {
        await runDailyMaintenance();
      } catch (err) {
        console.error('[Cron] Error en tareas programadas:', err);
      }
    },
    null,
    false,
    timezone
  );

  dailyMaintenanceJob.start();
  console.log(`[Cron] Programado: ${expression} (${timezone})`);

  return dailyMaintenanceJob;
}

module.exports = {
  startDailyMaintenanceCron,
  runDailyMaintenance,
};
