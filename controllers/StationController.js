'use strict';
const { validationResult } = require('express-validator');
const StationService = require('../services/StationService');
const fs = require('fs');
const path = require('path');
const ErrorSanitizer = require('../utils/ErrorSanitizer');
const topicTemplate = process.env.TTN_TOPIC_TEMPLATE;

class StationController {

    async list(req, res) {
        try {
            const { role, id } = req.user || {};
            const results = await StationService.list(role, id);
            res.json({ msg: 'OK!', code: 200, info: results });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            res.status(sanitized.code).json(sanitized);
        }
    }

    async listActive(req, res) {
        try {
            const { role, id } = req.user || {};
            const info = await StationService.listActive(role, id);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            console.error("Error al listar estaciones operativas:", error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async listActiveMQTT(req, res) {
        try {
            const info = await StationService.listActiveMQTT(req.user);
            return res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async listByMicrobasinAndStatus(req, res) {
        const { external_id, estado } = req.params;
        const { page, limit, searchTerm } = req.query;
        try {
            const info = await StationService.listByMicrobasinAndStatus(external_id, estado, page, limit, searchTerm);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async getByMicrobasinParam(req, res) {
        try {
            const info = await StationService.getByMicrobasin(req.params.external);
            return res.status(200).json({ msg: 'OK!', code: 200, info: info.info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async getByMicrobasinBody(req, res) {
        try {
            const external = req.body.external;
            if (!external) return res.status(400).json({ msg: 'Falta informacion', code: 400 });

            const info = await StationService.getByMicrobasin(external, true);
            return res.status(200).json({ msg: 'OK!', code: 200, ...info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async getByExternal(req, res) {
        try {
            const info = await StationService.getByExternal(req.params.external_id);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async create(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                if (req.file?.filename) fs.unlinkSync(path.join(__dirname, '../public/images/estaciones', req.file.filename));
                return res.status(400).json({ msg: "DATOS INCOMPLETOS", code: 400, errors: errors.array() });
            }

            const data = {
                ...req.body,
                picture: req.file.filename,
                phenomenon_ids: req.body.phenomenon_ids ? JSON.parse(req.body.phenomenon_ids) : [],
                id_microcuenca: req.body.id_microcuenca
            };
            await StationService.create(data, topicTemplate);

            return res.status(200).json({ msg: "SE HAN REGISTRADO LOS DATOS CON ÉXITO", code: 200 });

        } catch (error) {
            if (req.file?.filename) fs.unlinkSync(path.join(__dirname, '../public/images/estaciones', req.file.filename));

            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async update(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ msg: "DATOS INCOMPLETOS", code: 400, errors: errors.array() });
            }

            const data = {
                ...req.body,
                newPicture: req.file ? req.file.filename : null,
                phenomenon_ids: req.body.phenomenon_ids ? JSON.parse(req.body.phenomenon_ids) : [],
                id_microcuenca: req.body.id_microcuenca
            };
            const result = await StationService.update(data, topicTemplate);

            return res.status(200).json({
                msg: "SE HAN MODIFICADO LOS DATOS CON ÉXITO",
                code: 200,
                new_external_id: result.new_external_id
            });

        } catch (error) {
            if (req.file?.filename) fs.unlinkSync(path.join(__dirname, '../public/images/estaciones', req.file.filename));

            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async changeStatus(req, res) {
        try {
            const { external_id, estado } = req.body;
            const result = await StationService.changeStatus(external_id, estado, req.user, topicTemplate);

            return res.status(200).json({
                msg: `Estado actualizado correctamente`,
                code: 200,
                info: result
            });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async linkToMicrobasin(req, res) {
        try {
            const { station_external_id, microbasin_external_id } = req.body;
            await StationService.linkToMicrobasin(station_external_id, microbasin_external_id);
            return res.status(200).json({ msg: 'Estación vinculada con éxito', code: 200 });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async listAvailableForLinking(req, res) {
        try {
            const { microbasin_external_id } = req.params;
            const { searchTerm } = req.query;
            const info = await StationService.listAvailableForLinking(microbasin_external_id, searchTerm);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async unlinkFromMicrobasin(req, res) {
        try {
            const { station_external_id, microbasin_external_id } = req.body;
            await StationService.unlinkFromMicrobasin(station_external_id, microbasin_external_id);
            return res.status(200).json({ msg: 'Estación desvinculada con éxito', code: 200 });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }
}

module.exports = StationController;
