'use strict';
const { validationResult } = require('express-validator');
const AccountService = require('../services/AccountService');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

class AccountController {

    async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ msg: "FALTAN DATOS", code: 400, errors: errors.array() });
            }

            const response = await AccountService.login(req.body.email, req.body.password);
            return res.status(200).json(response);

        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async changePassword(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ msg: "FALTAN DATOS", code: 400, errors: errors.array() });
        }

        const { currentPassword, newPassword, email } = req.body;

        try {
            const response = await AccountService.changePassword(email, currentPassword, newPassword);
            return res.status(200).json(response);
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async forgotPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ msg: "FALTAN DATOS", code: 400, errors: errors.array() });
            }

            const { email } = req.body;
            const response = await AccountService.forgotPassword(email);
            return res.status(200).json(response);

        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async resetPassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ msg: "FALTAN DATOS", code: 400, errors: errors.array() });
            }

            const { token, newPassword } = req.body;
            const response = await AccountService.resetPassword(token, newPassword);
            return res.status(200).json(response);

        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }

    async getAccountsByName(req, res) {
        try {
            if (!req.params.fullname) {
                return res.status(400).json({ msg: "FALTA EL NOMBRE COMPLETO O PARCIAL EN LA SOLICITUD", code: 400 });
            }

            const fullname = req.params.fullname.trim();
            const response = await AccountService.getAccountsByName(fullname);
            return res.status(200).json(response);

        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            return res.status(sanitized.code).json(sanitized);
        }
    }
}

module.exports = AccountController;
