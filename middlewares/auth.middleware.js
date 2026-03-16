'use strict';
const jwt = require('jsonwebtoken');
require('dotenv').config();
const models = require('../models');
const { account, entity } = models;

const auth = function (options = { checkAdmin: false, required: true }) {
    return async function middleware(req, res, next) {
        const token = req.headers['x-api-token'];
        if (!token) {
            if (options.required === false) return next();
            return res.status(401).json({
                msg: "No existe token",
                code: 401
            });
        }

        const llave = process.env.KEY;
        jwt.verify(token, llave, async (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    msg: "Acceso denegado. Token ha expirado o es inválido",
                    code: 401
                });
            }

            req.decoded = decoded;

            try {
                let aux = await account.findOne({
                    where: { external_id: req.decoded.external },
                    include: [
                        {
                            model: entity,
                            as: 'entity',
                            include: [{ model: models.role, as: 'roles', attributes: ['name', 'external_id'], through: { attributes: [] } }]
                        }
                    ]
                });

                if (!aux) {
                    return res.status(401).json({
                        msg: "Acceso denegado. Usuario no encontrado",
                        code: 401
                    });
                }

                if (!aux.status) {
                    return res.status(401).json({
                        msg: "Acceso denegado. Cuenta desactivada",
                        code: 401
                    });
                }

                if (options.checkAdmin) {
                    const hasAdminRole = aux.entity?.roles?.some(r => r.name === 'ADMINISTRADOR');
                    if (!hasAdminRole) {
                        return res.status(403).json({
                            msg: "Acceso denegado: se requiere rol ADMINISTRADOR",
                            code: 403
                        });
                    }
                }

                req.user = {
                    id: aux.entity?.id, // Correctly map to Entity ID, not Account ID
                    account_id: aux.id,
                    external_id: aux.external_id,
                    email: aux.email,
                    roles: aux.entity?.roles?.map(r => r.name) || [],
                    name: aux.entity?.name,
                    lastname: aux.entity?.lastname
                };

                return next();
            } catch (dbErr) {
                console.error(dbErr);
                return res.status(500).json({
                    msg: "Error interno al validar usuario",
                    code: 500
                });
            }
        });
    };
};

module.exports = auth;
