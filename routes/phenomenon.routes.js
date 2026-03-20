'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { uploadIconoEstacion } = require('../middlewares/upload.middleware');
const multer = require('multer');

const PhenomenonTypeController = require('../controllers/PhenomenonTypeController');
const phenomenonTypeController = new PhenomenonTypeController();

router.post('/guardar/tipo_medida', auth(), uploadIconoEstacion.single('foto'), [
    body('unidad_medida', 'Ingrese la unidad de medida').exists().not().isEmpty(),
    body('alias', 'Ingrese el nombre en español').exists().not().isEmpty(),
    body('operaciones', 'Debe especificar al menos una operación').exists().not().isEmpty(),
], validate, phenomenonTypeController.create);

router.put('/modificar/tipo_medida', auth(), uploadIconoEstacion.single('foto'), phenomenonTypeController.update);

router.get('/listar/tipo_medida', auth({ required: false }), phenomenonTypeController.list);
router.get('/listar/operaciones', phenomenonTypeController.listOperations);
router.get('/listar/tipo_medida/activas', phenomenonTypeController.getActiveVariables);
router.get('/listar/tipo_medida/operativas', phenomenonTypeController.getActiveVariablesWithOperationalStations);
router.get('/listar/tipo_medida/estacion/:external_id', phenomenonTypeController.getVariablesByStation);
router.get('/listar/tipo_medida/desactivos', auth(), phenomenonTypeController.listFalse);
router.get('/obtener/tipo_medida/:external', auth(), phenomenonTypeController.get);
router.get('/tipo_fenomeno/cambiar_estado/:external_id', auth(), phenomenonTypeController.changeStatus);

module.exports = router;
