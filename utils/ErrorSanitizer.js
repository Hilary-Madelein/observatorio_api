'use strict';

/**
 * Utility to sanitize backend errors and return user-friendly messages.
 */
class ErrorSanitizer {
    /**
     * Maps an error object to a friendly message and status code.
     * @param {Error} error - The caught error object.
     * @returns {Object} - { msg: string, code: number, errors: string[] | undefined }
     */
    static sanitize(error) {
        console.error('Captured Error:', error);

        // DEFAULT
        let result = {
            msg: 'Ha ocurrido un error inesperado en el servidor.',
            code: 500,
            errors: undefined
        };

        // 1. Sequelize Validation Errors
        if (error.name === 'SequelizeValidationError') {
            result.code = 400;
            result.msg = 'Datos inválidos.';
            result.errors = error.errors.map(e => e.message);
            return result;
        }

        // 2. Sequelize Unique Constraint (Duplicate)
        if (error.name === 'SequelizeUniqueConstraintError') {
            result.code = 400;
            const field = Object.keys(error.fields).join(', ');
            result.msg = `Ya existe un registro con el mismo valor en: ${field}.`;
            return result;
        }

        // 3. Database Errors (Postgres Codes)
        if (error.parent) {
            const pgCode = error.parent.code;

            // 22001: Value too long for type character varying
            if (pgCode === '22001') {
                result.code = 400;
                result.msg = 'Uno de los campos excede la longitud permitida.';
                return result;
            }

            // 23503: Foreign key violation
            if (pgCode === '23503') {
                result.code = 400;
                result.msg = 'No se puede realizar esta operación porque el registro está relacionado con otros datos.';
                return result;
            }

            // 23502: Not null violation (if not caught by validation)
            if (pgCode === '23502') {
                result.code = 400;
                result.msg = 'Faltan datos requeridos (campo nulo).';
                return result;
            }
        }

        // 4. Custom App Errors (if manually thrown with code)
        if (error.code && typeof error.code === 'number') {
            result.code = error.code;
            result.msg = error.msg || error.message;
            return result;
        }

        return result;
    }
}

module.exports = ErrorSanitizer;
