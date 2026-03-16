'use strict';

const RoleService = require('../services/RoleService');
const ErrorSanitizer = require('../utils/ErrorSanitizer');

class RoleController {

    async list(req, res) {
        try {
            const roles = await RoleService.list();
            res.status(200).json({ msg: "OK", code: 200, info: roles });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            res.status(sanitized.code).json(sanitized);
        }
    }

    async seed(req, res) {
        try {
            const result = await RoleService.createDefaultRoles();
            res.status(200).json({ msg: "Roles verificados/creados", code: 200, info: result });
        } catch (error) {
            const sanitized = ErrorSanitizer.sanitize(error);
            res.status(sanitized.code).json(sanitized);
        }
    }
}

module.exports = new RoleController();
