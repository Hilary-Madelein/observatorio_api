'use strict';

/**
 * Middleware central de manejo de errores.
 * Captura errores lanzados por 'next(err)' o excepciones no controladas.
 */
const errorHandler = (err, req, res, next) => {
    console.error('[Error Middleware] Error capturado:', err);

    const statusCode = err.status || err.code || 500;
    let message = err.message || 'Error interno del servidor';

    if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'El archivo es demasiado pesado. Por favor, suba una imagen de menos de 2MB.';
        if (statusCode === 500 || statusCode === 'LIMIT_FILE_SIZE') res.status(413);
    }

    const response = {
        msg: message,
        code: statusCode === 'LIMIT_FILE_SIZE' ? 413 : statusCode,
        error: process.env.NODE_ENV === 'development' ? err : undefined
    };

    const finalStatus = (typeof response.code === 'number' && response.code >= 100 && response.code < 600) ? response.code : 500;
    res.status(finalStatus).json(response);
};

module.exports = errorHandler;
