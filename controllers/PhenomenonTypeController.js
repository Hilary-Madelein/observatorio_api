'use strict';
const { validationResult } = require('express-validator');
const PhenomenonTypeService = require('../services/PhenomenonTypeService');
const fs = require('fs');
const path = require('path');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

class PhenomenonTypeController {

    async list(req, res) {
        try {
            let status = null;
            if (req.query.status === 'true') status = true;
            else if (req.query.status === 'false') status = false;
            else if (req.query.status === 'all') status = 'all';

            const { page, limit, searchTerm } = req.query;
            const info = await PhenomenonTypeService.list(status, page, limit, searchTerm, req.user ? req.user.id : null);
            res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            console.error(error);
            const sanitized = ErrorSanitizer.sanitize(error);
            res.status(sanitized.code).json(sanitized);
        }
    }

    async listFalse(req, res) {
        try {
            const { page, limit, searchTerm } = req.query;
            const info = await PhenomenonTypeService.listFalse(searchTerm, req.user ? req.user.id : null);
            res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            console.error(error);
            const sanitized = ErrorSanitizer.sanitize(error);
            res.status(sanitized.code).json(sanitized);
        }
    }

    async listOperations(req, res) {
        try {
            const info = await PhenomenonTypeService.listOperations();
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            console.error(error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async getActiveVariables(req, res) {
        try {
            const info = await PhenomenonTypeService.getActiveVariables();
            return res.status(200).json({ msg: 'Variables activas', code: 200, info });
        } catch (error) {
            console.error(error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async getVariablesByStation(req, res) {
        const externalId = req.params.external_id;
        if (!externalId) return res.status(400).json({ msg: 'Falta external_id', code: 400 });

        try {
            const info = await PhenomenonTypeService.getVariablesByStation(externalId);
            return res.status(200).json({
                msg: `Variables por estación ${externalId}`,
                code: 200,
                info
            });
        } catch (error) {
            console.error(error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async get(req, res) {
        try {
            const info = await PhenomenonTypeService.get(req.params.external);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            res.status(sanitized.code).json(sanitized);
        }
    }

    async create(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                if (req.file?.path) fs.unlinkSync(path.join(__dirname, '../public/images/icons_estaciones', req.file.filename));
                return res.status(400).json({ msg: "DATOS INCOMPLETOS", code: 400, errors: errors.array() });
            }

            const data = {
                ...req.body,
                iconFilename: req.file.filename,
                investigator_id: req.user ? req.user.id : null
            };

            await PhenomenonTypeService.create(data);
            return res.status(200).json({ msg: "SE HAN REGISTRADO LOS DATOS CON ÉXITO", code: 200 });

        } catch (error) {
            if (req.file?.path) fs.unlinkSync(path.join(__dirname, '../public/images/icons_estaciones', req.file.filename));

            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async update(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                if (req.file?.path) fs.unlinkSync(path.join(__dirname, '../public/images/icons_estaciones', req.file.filename));
                return res.status(400).json({ msg: "DATOS INCOMPLETOS", code: 400, errors: errors.array() });
            }

            const data = {
                ...req.body,
                name_en: req.body.alias_en,
                newIcon: req.file ? req.file.filename : null,
                userId: req.user.id,
                userRoles: req.user.roles
            };

            await PhenomenonTypeService.update(data);
            return res.status(200).json({ msg: "SE HAN MODIFICADO LOS DATOS CON ÉXITO", code: 200 });

        } catch (error) {
            if (req.file?.path) fs.unlinkSync(path.join(__dirname, '../public/images/icons_estaciones', req.file.filename));

            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async changeStatus(req, res) {
        try {
            const info = await PhenomenonTypeService.changeStatus(req.params.external_id, req.user);
            return res.status(200).json({
                msg: `Estado actualizado correctamente`,
                code: 200,
                info
            });
        } catch (error) {
            console.error("Error al cambiar el estado:", error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }
}

module.exports = PhenomenonTypeController;