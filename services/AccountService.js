'use strict';

const models = require('../models');
const Account = models.account;
const Entity = models.entity;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const crypto = require('crypto');
const EmailService = require('./EmailService');
require('dotenv').config();

class AccountService {

    async login(email, password) {
        const login = await Account.findOne({
            where: { email },
            include: [
                {
                    model: Entity,
                    as: 'entity',
                    include: [{ model: models.role, as: 'roles', attributes: ['name', 'external_id'], through: { attributes: [] } }]
                }
            ]
        });

        if (!login) {
            throw { message: "CUENTA NO ENCONTRADA", code: 400 };
        }

        if (!login.status) {
            throw { message: "CUENTA DESACTIVADA", code: 400 };
        }

        const isPasswordValid = bcrypt.compareSync(password, login.password);

        if (isPasswordValid) {
            const tokenPayload = {
                external: login.external_id,
                email: login.email,
                check: true
            };

            const secretKey = process.env.KEY;
            const token = jwt.sign(tokenPayload, secretKey, { expiresIn: '40min' });

            return {
                msg: "Bienvenido " + (login.entity?.name || ''),
                info: {
                    token: token,
                    user: {
                        correo: login.email,
                        nombres: login.entity?.name || '',
                        apellidos: login.entity?.lastname || '',
                        entidad: login.entity,
                        roles: login.entity?.roles || [],
                        mustChangePassword: login.change_password
                    }
                },
                code: 200
            };
        } else {
            throw { message: "CLAVE INCORRECTA", code: 401 };
        }
    }

    async changePassword(email, currentPassword, newPassword) {
        const account = await Account.findOne({ where: { email: email } });
        if (!account) {
            throw { message: "CUENTA NO ENCONTRADA", code: 404 };
        }

        const valid = bcrypt.compareSync(currentPassword, account.password);
        if (!valid) {
            throw { message: "CONTRASEÑA ACTUAL INCORRECTA", code: 401 };
        }

        if (currentPassword === newPassword) {
            throw { message: "LA NUEVA CONTRASEÑA DEBE SER DIFERENTE A LA ACTUAL", code: 400 };
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{9,}$/;
        if (!passwordRegex.test(newPassword)) {
            throw { message: "LA CONTRASEÑA DEBE TENER MÁS DE 8 CARACTERES, 1 MAYÚSCULA, 1 NÚMERO Y 1 CARÁCTER ESPECIAL", code: 400 };
        }

        const salt = bcrypt.genSaltSync(10);
        account.password = bcrypt.hashSync(newPassword, salt);
        account.change_password = false;
        await account.save();

        return { msg: "Contraseña actualizada correctamente", code: 200 };
    }

    async forgotPassword(email) {
        const account = await Account.findOne({ where: { email } });
        if (!account) {
            throw { message: "CUENTA NO ENCONTRADA", code: 404 };
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour

        account.reset_password_token = token;
        account.reset_password_expires = expires;
        await account.save();

        await EmailService.sendResetPasswordEmail(email, token);

        return { msg: "Correo de recuperación enviado", code: 200 };
    }

    async resetPassword(token, newPassword) {
        const account = await Account.findOne({
            where: {
                reset_password_token: token,
                reset_password_expires: { [Op.gt]: Date.now() }
            }
        });

        if (!account) {
            throw { message: "TOKEN INVÁLIDO O EXPIRADO", code: 400 };
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{9,}$/;
        if (!passwordRegex.test(newPassword)) {
            throw { message: "LA CONTRASEÑA DEBE TENER MÁS DE 8 CARACTERES, 1 MAYÚSCULA, 1 NÚMERO Y 1 CARÁCTER ESPECIAL", code: 400 };
        }

        const salt = bcrypt.genSaltSync(10);
        account.password = bcrypt.hashSync(newPassword, salt);
        account.reset_password_token = null;
        account.reset_password_expires = null;
        account.change_password = false;
        await account.save();

        return { msg: "Contraseña restablecida correctamente", code: 200 };
    }

    async getAccountsByName(fullname) {
        const results = await Entity.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${fullname}%` } },
                    { lastname: { [Op.iLike]: `%${fullname}%` } }
                ]
            },
            limit: 10
        });

        if (results.length === 0) {
            throw { message: "NO SE ENCONTRARON USUARIOS", code: 404 };
        }

        const data = results.map(entity => ({
            nombres: entity.name,
            apellidos: entity.lastname,
            id: entity.id,
            foto: entity.picture
        }));

        return {
            msg: "Usuarios Encontrados",
            info: data,
            code: 200
        };
    }

}

module.exports = new AccountService();
