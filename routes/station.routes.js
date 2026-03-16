'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { uploadFotoEstacion } = require('../middlewares/upload.middleware');
const multer = require('multer');

const StationController = require('../controllers/StationController');
const stationController = new StationController();

router.post('/guardar/estacion', auth(), uploadFotoEstacion.single('foto'), [
    body('nombre', 'Ingrese el nombre de la estación').exists().not().isEmpty(),
    body('id_dispositivo', 'Ingrese el ID del dispositivo').exists().not().isEmpty(),
    body('latitud', 'Ingrese la latitud').isNumeric(),
    body('longitud', 'Ingrese la longitud').isNumeric(),
    body('tipo', 'Seleccione el tipo de estación').exists().not().isEmpty(),
    body('id_microcuenca', 'Seleccione la cuenca').exists().not().isEmpty()
], validate, stationController.create);

router.put('/modificar/estacion', auth(), uploadFotoEstacion.single('foto'), stationController.update);

router.get('/listar/estacion', auth({ checkAdmin: true }), stationController.list);
router.get('/listar/estacion/operativas', stationController.listActive);
router.get('/listar/estacion/:estado/:external_id', auth(), stationController.listByMicrobasinAndStatus);
router.get('/obtener/estacion/:external', auth(), stationController.getByMicrobasinParam);
router.get('/get/estacion/:external_id', auth(), stationController.getByExternal);
router.post('/estaciones/operativas/microcuenca', auth(), stationController.getByMicrobasinBody);
router.post('/estacion/cambiar_estado', auth(), stationController.changeStatus);
router.post('/estaciones/vincular', auth(), stationController.linkToMicrobasin);
router.post('/estaciones/desvincular', auth(), stationController.unlinkFromMicrobasin);
router.get('/estaciones/disponibles_vincular/:microbasin_external_id', auth(), stationController.listAvailableForLinking);

module.exports = router;
