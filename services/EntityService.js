'use strict';

const models = require('../models');
const Entity = models.entity;
const Account = models.account;
const bcrypt = require('bcrypt');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models');
const EmailService = require('./EmailService');

class EntityService {

    async list(estadoCuenta, page = 1, limit = 10, searchTerm = '') {
        const accountWhere = estadoCuenta ? { status: estadoCuenta } : {};
        const entityWhere = {};

        if (searchTerm) {
            entityWhere[models.Sequelize.Op.or] = [
                { name: { [models.Sequelize.Op.iLike]: `%${searchTerm}%` } },
                { lastname: { [models.Sequelize.Op.iLike]: `%${searchTerm}%` } },
                { identification: { [models.Sequelize.Op.iLike]: `%${searchTerm}%` } }
            ];
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await Entity.findAndCountAll({
            where: entityWhere,
            attributes: ['lastname', 'name', 'external_id', 'picture', 'phone', 'status', 'identification'],
            include: [
                {
                    model: Account,
                    as: 'account',
                    attributes: ['email', 'status'],
                    where: accountWhere,
                    required: (typeof estadoCuenta !== 'undefined' && estadoCuenta !== null && estadoCuenta !== '')
                },
            ],
            offset: parseInt(offset),
            limit: parseInt(limit),
            order: [['name', 'ASC']]
        });

        return {
            rows,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        };
    }

    async get(external) {
        const result = await Entity.findOne({
            where: { external_id: external },
            attributes: ['id', 'external_id', 'name', 'lastname', 'phone', 'status', 'picture'],
            include: [
                {
                    model: Account,
                    as: 'account',
                    attributes: ['email', 'status']
                },
                {
                    model: models.role,
                    as: 'roles',
                    attributes: ['external_id', 'name'],
                    through: { attributes: [] }
                }
            ]
        });

        if (!result) {
            throw { message: 'NO EXISTE EL REGISTRO', code: 404 };
        }
        return result;
    }

    async create(data) {
        const transaction = await sequelize.transaction();
        const saltRounds = 10;

        try {
            const existingAccount = await Account.findOne({ where: { email: data.correo }, transaction });
            if (existingAccount) {
                throw { message: "ESTE CORREO YA ESTÁ REGISTRADO", code: 400 };
            }

            const hashPassword = password => {
                const salt = bcrypt.genSaltSync(saltRounds);
                return bcrypt.hashSync(password, salt);
            };

            const pictureFilename = data.pictureFilename || 'USUARIO_ICONO.png';

            const existingEntity = await Entity.findOne({ where: { identification: data.identificacion }, transaction });
            if (existingEntity) {
                throw { message: "ESTA IDENTIFICACIÓN YA ESTÁ REGISTRADA", code: 400 };
            }

            const entityData = {
                name: data.nombres,
                lastname: data.apellidos,
                phone: data.telefono,
                identification: data.identificacion,
                picture: pictureFilename,
                role: data.rol,
                external_id: uuid.v4(),
                account: {
                    email: data.correo,
                    password: hashPassword(data.clave),
                    change_password: true
                }
            };

            const entity = await Entity.create(entityData, {
                include: [{ model: Account, as: 'account' }],
                transaction
            });

            if (data.rol) {
                const roleIds = Array.isArray(data.rol) ? data.rol : [data.rol];

                if (roleIds.length > 0) {
                    const rolesFound = await models.role.findAll({
                        where: { external_id: roleIds },
                        transaction
                    });

                    if (rolesFound.length > 0) {
                        for (const role of rolesFound) {
                            await entity.addRole(role, {
                                through: { status: true, external_id: uuid.v4() },
                                transaction
                            });
                        }
                    }
                }
            }

            await transaction.commit();
            EmailService.sendWelcomeEmail(data.correo, data.nombres, data.clave);

            return true;

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async update(data) {
        const existingEntity = await Entity.findOne({
            where: { external_id: data.external_id }
        });

        if (!existingEntity) {
            throw { message: "NO EXISTE EL REGISTRO", code: 400 };
        }

        const relatedAccount = await Account.findOne({
            where: { id_entity: existingEntity.id }
        });

        if (!relatedAccount) {
            throw { message: "NO SE ENCONTRÓ LA CUENTA ASOCIADA A ESTA ENTIDAD", code: 400 };
        }

        let previousPicture = existingEntity.picture;

        if (data.newPicture) {
            if (previousPicture) {
                const imagePath = path.join(__dirname, '../public/images/users/', previousPicture);
                fs.unlink(imagePath, (err) => {
                    if (err) console.log('Error al eliminar la imagen anterior:', err);
                    else console.log("eliminada: " + previousPicture);
                });
            }
            previousPicture = data.newPicture;
        }

        if (data.identificacion && data.identificacion !== existingEntity.identification) {
            const duplicate = await Entity.findOne({ where: { identification: data.identificacion } });
            if (duplicate) {
                throw { message: "ESTA IDENTIFICACIÓN YA ESTÁ REGISTRADA", code: 400 };
            }
            existingEntity.identification = data.identificacion;
        }

        existingEntity.name = data.nombres;
        existingEntity.lastname = data.apellidos;
        existingEntity.status = data.estado;
        existingEntity.phone = data.telefono;
        relatedAccount.status = data.estado;
        existingEntity.picture = previousPicture;
        existingEntity.external_id = uuid.v4();

        const result = await existingEntity.save();
        await relatedAccount.save();

        // Update Roles if provided
        if (data.rol) {
            const roleIds = Array.isArray(data.rol) ? data.rol : [data.rol];
            if (roleIds.length > 0) {
                const rolesFound = await models.role.findAll({
                    where: { external_id: roleIds }
                });
                await existingEntity.setRoles([]);
                for (const role of rolesFound) {
                    await existingEntity.addRole(role, {
                        through: { status: true, external_id: uuid.v4() }
                    });
                }
            }
        }

        if (!result) {
            throw { message: "NO SE HAN MODIFICADO SUS DATOS, VUELVA A INTENTAR", code: 400 };
        }

        return true;
    }

    async changeAccountStatus(external_id, nuevoEstado) {
        const entidad = await Entity.findOne({ where: { external_id } });
        if (!entidad) {
            throw { message: 'Registro de persona no encontrada', code: 404 };
        }

        const cuenta = await Account.findOne({ where: { id_entity: entidad.id } });
        if (!cuenta) {
            throw { message: 'Cuenta asociada no encontrada', code: 404 };
        }

        const estado = ['true', 'ACEPTADO'].includes(String(nuevoEstado).toUpperCase());
        cuenta.status = estado;
        await cuenta.save();
        return true;
    }

}

module.exports = new EntityService();
