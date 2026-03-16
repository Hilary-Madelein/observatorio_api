'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { uploadFotoMicrocuenca } = require('../middlewares/upload.middleware');
const multer = require('multer');

const MicrobasinController = require('../controllers/MicrobasinController');
const microbasinController = new MicrobasinController();

router.post('/guardar/microcuenca', auth(), uploadFotoMicrocuenca.fields([{ name: 'foto', maxCount: 1 }, { name: 'coordenadas', maxCount: 1 }]), [
    body('nombre', 'Ingrese el nombre de la cuenca').exists().not().isEmpty(),
    body('descripcion', 'Ingrese una descripción').exists().not().isEmpty()
], validate, microbasinController.create);

router.put('/modificar/microcuenca', auth(), uploadFotoMicrocuenca.fields([{ name: 'foto', maxCount: 1 }, { name: 'coordenadas', maxCount: 1 }]), microbasinController.update);

router.get('/listar/microcuenca/admin', auth({ checkAdmin: true }), microbasinController.list);
router.get('/listar/microcuenca/operativas', microbasinController.listActive); // Public
router.get('/listar/microcuenca/investigador/operativas', auth(), microbasinController.listActiveByInvestigator);
router.get('/listar/microcuenca/desactivas', auth({ checkAdmin: true }), microbasinController.listInactive);
router.get('/listar/microcuenca/investigador/desactivas', auth(), microbasinController.listInactiveByInvestigator);
router.get('/obtener/microcuenca/:external', auth(), microbasinController.get);
router.get('/desactivar/microcuenca/:external_id', auth(), microbasinController.changeStatus);
router.get('/microcuenca/estaciones', microbasinController.getWithStations);

module.exports = router;
