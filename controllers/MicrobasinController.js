'use strict';
const { validationResult } = require('express-validator');
const MicrobasinService = require('../services/MicrobasinService');
const fs = require('fs');
const path = require('path');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

class MicrobasinController {

    async listActive(req, res) {
        try {
            const { roles, id } = req.user || {};
            const { page, limit, searchTerm } = req.query;
            const info = await MicrobasinService.list(true, roles, id, page, limit, searchTerm);
            res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async listInactive(req, res) {
        try {
            const { roles, id } = req.user || {};
            const { page, limit, searchTerm } = req.query;
            const info = await MicrobasinService.list(false, roles, id, page, limit, searchTerm);
            res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async list(req, res) {
        try {
            const { roles, id } = req.user || {};
            const { page, limit, searchTerm } = req.query;
            const info = await MicrobasinService.findAll(roles, id, page, limit, searchTerm);
            res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async get(req, res) {
        try {
            const info = await MicrobasinService.get(req.params.external);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async getStations(req, res) {
        try {
            const info = await MicrobasinService.getWithStations(false);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async getWithStations(req, res) {
        try {
            const info = await MicrobasinService.getWithStations(true);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async create(req, res) {
        try {
            const data = {
                ...req.body,
                pictureFilename: req.files['foto'] ? req.files['foto'][0].filename : null,
                coordinateFilename: req.files['coordenadas'] ? req.files['coordenadas'][0].filename : 'default.txt',
                investigator_id: req.user.id
            };

            await MicrobasinService.create(data);
            return res.status(200).json({ msg: "SE HA REGISTRADO CUENCA CON ÉXITO", code: 200 });

        } catch (error) {
            if (req.file?.path) fs.unlinkSync(path.join(__dirname, '../public/images/microcuencas', req.file.filename));

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
                newPicture: req.files['foto'] ? req.files['foto'][0].filename : null,
                newCoordinateFile: req.files['coordenadas'] ? req.files['coordenadas'][0].filename : null
            };

            await MicrobasinService.update(data);
            return res.status(200).json({ msg: "SE HAN MODIFICADO LOS DATOS CON ÉXITO", code: 200 });

        } catch (error) {
            if (req.file?.path) fs.unlinkSync(path.join(__dirname, '../public/images/microcuencas', req.file.filename));

            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async changeStatus(req, res) {
        try {
            const info = await MicrobasinService.changeStatus(req.params.external_id, req.user);
            return res.status(200).json({
                msg: `Estado actualizado correctamente. Nuevo estado: ${info.nuevo_estado}`,
                code: 200,
                info
            });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async listActiveByInvestigator(req, res) {
        try {
            const { id, roles } = req.user;
            const { page, limit, searchTerm } = req.query;
            const info = await MicrobasinService.listActiveByInvestigator(id, page, limit, searchTerm, roles);
            res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }
    async listInactiveByInvestigator(req, res) {
        try {
            const { id, roles } = req.user;
            const { page, limit, searchTerm } = req.query;
            const info = await MicrobasinService.listInactiveByInvestigator(id, page, limit, searchTerm, roles);
            res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

}

module.exports = MicrobasinController;
