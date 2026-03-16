'use strict';

const MeasurementService = require('../services/MeasurementService');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

/**
 * MeasurementController
 * Acts as the HTTP Interface (Facade) to the MeasurementService.
 * Handles Request extraction and Response formatting.
 */
class MeasurementController {

    /**
     * Save multiple measurements from TTN
     */
    async saveFromTTN(req, res) {
        const { fecha, dispositivo, payload } = req.body;

        if (!fecha || !dispositivo || !payload) {
            return res.status(400).json({ msg: 'Datos incompletos', code: 400 });
        }

        try {
            const result = await MeasurementService.processTTNPayload(fecha, dispositivo, payload);
            return res.status(200).json({
                msg: 'Mediciones guardadas con éxito',
                code: 200,
                info: result
            });
        } catch (error) {
            console.error(error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    /**
     * Get latest measurements (all variables)
     */
    async getUltimasMediciones(req, res) {
        try {
            const info = await MeasurementService.getLatestMeasurements();
            return res.status(200).json({
                msg: 'Últimas mediciones',
                code: 200,
                info
            });
        } catch (error) {
            console.error(error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    /**
     * Get latest measurements for a specific station
     */
    async getUltimasMedicionesPorEstacion(req, res) {
        const externalId = req.body.externalId;
        if (!externalId) {
            return res.status(400).json({
                msg: 'Datos incompletos para buscar información de la estación',
                code: 400
            });
        }

        try {
            const info = await MeasurementService.getStationLatestMeasurements(externalId);
            return res.status(200).json({
                msg: 'Últimas mediciones de la estación',
                code: 200,
                info
            });
        } catch (error) {
            console.error(error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    /**
     * Get time series stats (AVG, MAX, MIN, SUM) by interval
     */
    async getMedicionesPorTiempo(req, res) {
        const {
            rango,
            estacion = null,
            variable: tipo_medida = null
        } = req.query;

        if (!rango || !['15min', '30min', 'hora', 'diaria'].includes(rango)) {
            return res.status(400).json({ msg: 'Rango inválido', code: 400 });
        }

        try {
            const info = await MeasurementService.getTimeSeries(rango, estacion, tipo_medida);
            return res.json({
                msg: `Series cada ${rango}`,
                code: 200,
                info
            });
        } catch (e) {
            console.error('Error en getMedicionesPorTiempo:', e);
            const sanitized = ErrorSanitizer.sanitize(e);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    /**
     * Worker task: Migrate granular data to daily aggregates
     */
    async migrateToDaily(req, res) {
        try {
            const migratedCount = await MeasurementService.performDailyMigration();
            return res.status(200).json({
                msg: `Migración a daily completada`,
                code: 200,
                migrated: migratedCount
            });
        } catch (error) {
            console.error('[migrateToDaily]', error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    /**
     * Worker task: Clean old granular measurements
     */
    async cleanOldMeasurements(req, res) {
        try {
            const result = await MeasurementService.cleanOldMeasurements();
            return res.status(200).json({
                msg: `Limpieza completada`,
                code: 200,
                ...result
            });
        } catch (error) {
            console.error('[cleanOldMeasurements]', error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

}

module.exports = MeasurementController;
