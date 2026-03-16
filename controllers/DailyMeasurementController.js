'use strict';
const DailyMeasurementService = require('../services/DailyMeasurementService');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

class DailyMeasurementController {

  async getMedicionesHistoricas(req, res) {
    const {
      rango,
      estacion,
      fechaInicio,
      fechaFin,
      variable: tipo_medida
    } = req.query;

    try {
      const info = await DailyMeasurementService.getMedicionesHistoricas(
        rango,
        estacion,
        fechaInicio,
        fechaFin,
        tipo_medida
      );

      return res.status(200).json({
        msg: 'Series históricas de mediciones agregadas (daily + recientes)',
        code: 200,
        info
      });

    } catch (error) {
      console.error('Error en getMedicionesHistoricas:', error);
      const sanitized = ErrorSanitizer.sanitize(error);
      return res.status(sanitized.code).json(sanitized);
    }
  }
}

module.exports = DailyMeasurementController;
