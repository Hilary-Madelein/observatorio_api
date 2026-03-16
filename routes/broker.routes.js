var express = require('express');
var router = express.Router();
var BrokerController = require('../controllers/BrokerController');
var brokerController = new BrokerController();

/* GET list brokers */
router.get('/listar/brokers', function (req, res, next) {
    brokerController.list(req, res);
});
/* GET get broker */
router.get('/obtener/broker/:external', function (req, res, next) {
    brokerController.get(req, res);
});

/* POST save broker */
router.post('/guardar/broker', function (req, res, next) {
    brokerController.save(req, res);
});

/* POST modify broker */
router.post('/modificar/broker', function (req, res, next) {
    brokerController.modify(req, res);
});

/* GET change status */
router.get('/broker/cambiar_estado/:external_id', function (req, res, next) {
    brokerController.changeStatus(req, res);
});

module.exports = router;
