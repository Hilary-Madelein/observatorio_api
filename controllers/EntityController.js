'use strict';
const { validationResult } = require('express-validator');
const EntityService = require('../services/EntityService');
const fs = require('fs');
const { entity } = require('../models');
const path = require('path');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

class EntityController {

    async list(req, res) {
        try {
            const { estadoCuenta, page, limit, searchTerm } = req.query;
            const info = await EntityService.list(estadoCuenta, page, limit, searchTerm);
            res.json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async get(req, res) {
        try {
            const info = await EntityService.get(req.params.external);
            return res.status(200).json({ msg: 'OK!', code: 200, info });
        } catch (error) {
            console.error('Error en get entidad:', error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async create(req, res) {
        try {
            const data = {
                ...req.body,
                pictureFilename: req.file ? req.file.filename : null
            };

            await EntityService.create(data);
            return res.status(200).json({ msg: "SE HAN REGISTRADO LOS DATOS CON ÉXITO", code: 200 });

        } catch (error) {
            if (req.file?.path) fs.unlinkSync(path.join(__dirname, '../public/images/users', req.file.filename));

            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async update(req, res) {
        try {
            if (!req.user.roles.includes('ADMINISTRADOR')) {
                const myEntity = await entity.findByPk(req.user.id);
                if (!myEntity || myEntity.external_id !== req.body.external_id) {
                    return res.status(403).json({ msg: "ACCESO DENEGADO: No puede modificar otro perfil", code: 403 });
                }
            }
            const data = {
                ...req.body,
                newPicture: req.file ? req.file.filename : null
            };

            await EntityService.update(data);
            return res.status(200).json({ msg: "SE HAN MODIFICADO SUS DATOS CON ÉXITO", code: 200 });

        } catch (error) {
            console.error("Error en el servidor:", error);
            if (req.file?.path) fs.unlinkSync(path.join(__dirname, '../public/images/users', req.file.filename));

            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async changeAccountStatus(req, res) {
        const { external_id, nuevoEstado } = req.query;

        if (!external_id || typeof nuevoEstado === 'undefined') {
            return res.status(400).json({ msg: 'FALTAN DATOS', code: 400 });
        }

        try {
            await EntityService.changeAccountStatus(external_id, nuevoEstado);
            return res.status(200).json({ msg: 'Estado de cuenta actualizado', code: 200 });
        } catch (error) {
            console.error('Error en changeAccountStatus:', error);
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

}

module.exports = EntityController;
