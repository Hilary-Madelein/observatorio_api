'use strict';
const { validationResult } = require('express-validator');
const fs = require('fs');

/**
 * Middleware para validar resultados de express-validator.
 * Si hay errores, responde con 400 y elimina archivos subidos (si existen).
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('Archivo eliminado por fallo de validación:', req.file.path);
            } catch (err) {
                console.error('Error eliminando archivo tras fallo de validación:', err);
            }
        }

        return res.status(400).json({
            msg: "DATOS INCOMPLETOS O INVÁLIDOS",
            code: 400,
            errors: errors.array()
        });
    }
    next();
};

module.exports = validate;
