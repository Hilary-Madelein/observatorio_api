'use strict';

const express = require('express');
const router = express.Router();
const RoleController = require('../controllers/RoleController');
const auth = require('../middlewares/auth.middleware');

router.get('/listar/roles', RoleController.list);
router.get('/seed/roles', RoleController.seed); // Endpoint to run manually to fix/create defaults

module.exports = router;
