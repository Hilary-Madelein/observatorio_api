'use strict';
const express = require('express');
const router = express.Router();
const MigracionController = require('../controllers/MigracionController');
const migracionController = new MigracionController();

router.get('/migracion/manual', migracionController.migrar);

module.exports = router;
