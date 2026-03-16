'use strict';
const MigracionService = require('../services/MigracionService');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

class MigracionController {

  async migrar(req, res) {
    try {
      await MigracionService.migrar();
      return res.status(200).json({ msg: 'Migración completada con éxito', code: 200 });
    } catch (error) {
      console.error('Error durante la migración:', error);
      const sanitized = ErrorSanitizer.sanitize(error);
      return res.status(sanitized.code).json(sanitized);
    }
  }
}

module.exports = MigracionController;
