'use strict';
const express = require('express');
const router = express.Router();
const MeasurementController = require('../controllers/MeasurementController');
const measurementController = new MeasurementController();
const DailyMeasurementController = require('../controllers/DailyMeasurementController');
const dailyMeasurementController = new DailyMeasurementController();

/** RUTAS DE MEASUREMENT */
router.get('/listar/ultima/medida', measurementController.getUltimasMediciones);
router.post('/listar/ultima/medida/estacion', measurementController.getUltimasMedicionesPorEstacion);
router.get('/mediciones/por-tiempo', measurementController.getMedicionesPorTiempo);

/** RUTAS DE DAILY MEASUREMENT */
router.get('/mediciones/historicas', dailyMeasurementController.getMedicionesHistoricas);

module.exports = router;
