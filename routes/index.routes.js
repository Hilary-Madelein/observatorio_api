'use strict';
const express = require('express');
const router = express.Router();

/* GET root */
router.get('/', function (req, res, next) {
    res.json({ "version": "1.0", "name": "hidrometeorologica-backend", "status": "running" });
});

// Agrupación de rutas
router.use('/', require('./user.routes'));          // Personas, cuentas, auth
router.use('/', require('./station.routes'));       // Estaciones
router.use('/', require('./microbasin.routes'));    // Microcuencas
router.use('/', require('./phenomenon.routes'));    // Tipos de fenómenos/variables
router.use('/', require('./measurement.routes'));   // Mediciones
router.use('/', require('./migration.routes'));     // Migración
router.use('/', require('./role.routes'));          // Roles
router.use('/', require('./broker.routes'));        // Brokers MQTT

// Ruta de verificación (Privada)
router.get('/privado/:external', async function (req, res) {
    const llave = req.params.external;
    const envKey = process.env.KEY_SQ;
    const models = require('../models');
    const sequelize = models.sequelize;

    if (llave !== envKey) {
        return res.status(401).json({ message: 'Llave incorrecta!' });
    }

    try {
        await sequelize.authenticate();
        console.log('Conectado a PostgreSQL');

        return res.status(200).send('Conexión exitosa a PostgreSQL');
    } catch (err) {
        console.error('Error en conexión a PostgreSQL:', err.message);
        return res.status(500).json({ message: 'Error conectando a PostgreSQL', error: err.message });
    }
});

module.exports = router;
