'use strict';
const { broker } = require('../models');
const EncryptionUtil = require('../utils/EncryptionUtil');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

class BrokerController {
    async list(req, res) {
        try {
            const { page = 1, limit = 10, searchTerm = '' } = req.query;
            const where = {};

            if (searchTerm) {
                const { Op } = require('sequelize');
                where.name = { [Op.iLike]: `%${searchTerm}%` };
            }

            const offset = (page - 1) * limit;

            const { count, rows } = await broker.findAndCountAll({
                where,
                offset: parseInt(offset),
                limit: parseInt(limit)
            });

            const info = {
                rows: rows.map(b => {
                    const plain = b.get({ plain: true });
                    plain.password = EncryptionUtil.decrypt(plain.password);
                    return plain;
                }),
                count,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page)
            };

            res.json({ msg: 'OK', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async save(req, res) {
        try {
            const { name, username, password } = req.body;
            if (!name || !username || !password) {
                return res.status(400).json({ msg: 'Faltan datos requeridos', code: 400 });
            }

            const encryptedPassword = EncryptionUtil.encrypt(password);

            await broker.create({
                name,
                username,
                password: encryptedPassword
            });

            // Trigger MQTT reload
            const MqttService = require('../services/MqttService');
            MqttService.reloadBrokers();

            res.json({ msg: 'Broker registrado correctamente', code: 200 });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async modify(req, res) {
        try {
            const { external_id, name, username, password } = req.body;
            const b = await broker.findOne({ where: { external_id } });
            if (!b) return res.status(404).json({ msg: 'Broker no encontrado', code: 404 });

            if (name) b.name = name;
            if (username) b.username = username;
            if (password) {
                b.password = EncryptionUtil.encrypt(password);
            }
            await b.save();

            const MqttService = require('../services/MqttService');
            MqttService.reloadBrokers();

            res.json({ msg: 'Broker modificado correctamente', code: 200 });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async get(req, res) {
        try {
            const { external } = req.params;
            const b = await broker.findOne({ where: { external_id: external } });
            if (!b) return res.status(404).json({ msg: 'Broker no encontrado', code: 404 });

            const plain = b.get({ plain: true });
            plain.password = EncryptionUtil.decrypt(plain.password);

            res.json({ msg: 'OK', code: 200, info: plain });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async changeStatus(req, res) {
        try {
            const { external_id } = req.params;
            const b = await broker.findOne({ where: { external_id } });
            if (!b) return res.status(404).json({ msg: 'Broker no encontrado', code: 404 });

            b.status = !b.status;
            await b.save();

            const MqttService = require('../services/MqttService');
            MqttService.reloadBrokers();

            res.json({ msg: 'Estado de broker actualizado', code: 200 });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }
}

module.exports = BrokerController;
