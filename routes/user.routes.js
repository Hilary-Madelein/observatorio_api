'use strict';
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { uploadFotoPersona } = require('../middlewares/upload.middleware');
const multer = require('multer');

const EntityController = require('../controllers/EntityController');
const entityController = new EntityController();
const AccountController = require('../controllers/AccountController');
const accountController = new AccountController();

/** RUTAS DE PERSONA (ENTITY) */
router.post('/guardar/entidad', auth({ checkAdmin: true }), uploadFotoPersona.single('foto'), [
    body('nombres', 'Ingrese los nombres').exists().not().isEmpty(),
    body('apellidos', 'Ingrese los apellidos').exists().not().isEmpty(),
    body('identificacion', 'Ingrese la identificación').exists().not().isEmpty(),
    body('correo', 'Ingrese un correo válido').exists().isEmail(),
    body('clave', 'Ingrese una clave').exists().not().isEmpty(),
    body('rol', 'Seleccione un rol').exists().not().isEmpty(),
    body('telefono', 'Ingrese un teléfono').optional(),
], validate, entityController.create);

router.put('/modificar/entidad', auth(), uploadFotoPersona.single('foto'), entityController.update);

router.get('/listar/entidad', auth({ checkAdmin: true }), entityController.list);
router.get('/obtener/entidad/:external', auth({ checkAdmin: true }), entityController.get);

/** RUTAS DE CUENTA (ACCOUNT) */
router.post('/sesion', [
    body('email', 'Ingrese un correo valido').exists().not().isEmpty().isEmail(),
    body('password', 'Ingrese una clave valido').exists().not().isEmpty(),
], validate, accountController.login);

router.post('/cambiar-clave/entidad', auth(), accountController.changePassword);
router.post('/cuenta/olvido-clave', [
    body('email', 'Ingrese un correo valido').exists().not().isEmpty().isEmail(),
], validate, accountController.forgotPassword);
router.post('/cuenta/restablecer-clave', [
    body('token', 'Token es requerido').exists().not().isEmpty(),
    body('newPassword', 'Nueva contraseña es requerida').exists().not().isEmpty(),
], validate, accountController.resetPassword);

router.get('/modificar/cuenta-status', auth({ checkAdmin: true }), entityController.changeAccountStatus);
router.get('/buscar/cuenta/:fullname', auth({ checkAdmin: true }), accountController.getAccountsByName);

module.exports = router;
