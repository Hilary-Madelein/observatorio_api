'use strict';

const models = require('../models');
const { Op } = require('sequelize');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models');

const PhenomenonType = models.phenomenon_type;
const Entity = models.entity;

class PhenomenonTypeService {

    async list(status = null, page = 1, limit = 10, searchTerm = '', userId = null) {
        const whereClause = {};
        if (status !== null && status !== undefined && status !== 'all') {
            whereClause.status = status;
        }

        if (searchTerm) {
            whereClause.alias = { [Op.iLike]: `%${searchTerm}%` };
        }

        const offset = (page - 1) * limit;

        const order = [['alias', 'ASC']];
        if (userId) {
            order.unshift([sequelize.literal(`CASE WHEN "phenomenon_type"."investigator_id" = ${userId} THEN 0 ELSE 1 END`), 'ASC']);
        }

        const { count, rows } = await PhenomenonType.findAndCountAll({
            where: whereClause,
            attributes: ['icon', 'unit_measure', 'external_id', 'status', 'name_en', 'alias', 'ttn_keys', 'investigator_id'],
            include: [
                { model: Entity, as: 'investigator', attributes: ['name', 'lastname', 'external_id'] },
                { model: models.type_operation, as: 'type_operations', attributes: ['operation', 'external_id'] }
            ],
            order: order,
            offset: parseInt(offset),
            limit: parseInt(limit),
            distinct: true
        });

        const formattedRows = rows.map(f => ({
            nombre: f.alias,
            icono: f.icon,
            alias_es: f.alias,
            alias_en: f.name_en,
            unidad: f.unit_measure,
            external_id: f.external_id,
            estado: f.status,
            ttn_keys: f.ttn_keys || [],
            operaciones: f.type_operations ? f.type_operations.map(op => op.operation) : [],
            investigator_id: f.investigator_id,
            investigator_external_id: f.investigator ? f.investigator.external_id : null,
            investigador: f.investigator ? `${f.investigator.name} ${f.investigator.lastname}` : null
        }));

        return {
            rows: formattedRows,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        };
    }

    async listFalse(searchTerm = '', userId = null) {
        const whereClause = { status: false };

        if (searchTerm) {
            whereClause.alias = { [Op.iLike]: `%${searchTerm}%` };
        }

        const order = [['alias', 'ASC']];
        if (userId) {
            order.unshift([sequelize.literal(`CASE WHEN "phenomenon_type"."investigator_id" = ${userId} THEN 0 ELSE 1 END`), 'ASC']);
        }

        const results = await PhenomenonType.findAll({
            where: whereClause,
            attributes: ['icon', 'unit_measure', 'external_id', 'status', 'name_en', 'alias', 'ttn_keys', 'investigator_id'],
            include: [
                { model: Entity, as: 'investigator', attributes: ['name', 'lastname', 'external_id'] },
                { model: models.type_operation, as: 'type_operations', attributes: ['operation'] }
            ],
            order: order
        });

        return results.map(f => ({
            nombre: f.alias,
            alias_es: f.alias,
            alias_en: f.name_en,
            icono: f.icon,
            unidad: f.unit_measure,
            external_id: f.external_id,
            estado: f.status,
            ttn_keys: f.ttn_keys || [],
            operaciones: f.type_operations ? f.type_operations.map(op => op.operation) : [],
            investigator_id: f.investigator_id,
            investigador: f.investigator ? `${f.investigator.name} ${f.investigator.lastname}` : null,
            investigator_external_id: f.investigator ? f.investigator.external_id : null
        }));
    }

    async listOperations() {
        return await models.type_operation.findAll({
            where: { status: true },
            attributes: ['operation', 'external_id']
        });
    }

    async getActiveVariables() {
        const results = await PhenomenonType.findAll({
            where: { status: true },
            attributes: ['icon', 'unit_measure', 'external_id', 'status', 'name_en', 'alias'],
            order: [['alias', 'ASC']]
        });

        return results.map(f => ({
            nombre: f.alias,
            alias_es: f.alias,
            alias_en: f.name_en,
            icono: f.icon,
            unidad: f.unit_measure,
            external_id: f.external_id,
        }));
    }

    async getActiveVariablesWithOperationalStations() {
        const results = await PhenomenonType.findAll({
            where: { status: true },
            attributes: ['icon', 'unit_measure', 'external_id', 'status', 'name_en', 'alias'],
            include: [
                {
                    model: models.station,
                    as: 'stations',
                    where: { status: 'OPERATIVA' },
                    attributes: []
                }
            ],
            order: [['alias', 'ASC']]
        });

        const uniqueResults = [];
        const seen = new Set();
        for (const f of results) {
            if (!seen.has(f.external_id)) {
                seen.add(f.external_id);
                uniqueResults.push(f);
            }
        }

        return uniqueResults.map(f => ({
            nombre: f.alias,
            alias_es: f.alias,
            alias_en: f.name_en,
            icono: f.icon,
            unidad: f.unit_measure,
            external_id: f.external_id,
        }));
    }

    async getVariablesByStation(externalId) {
        const results = await models.sequelize.query(
            `SELECT DISTINCT
                       p.alias        AS name,
               p.name_en      AS name_en,
               p.alias        AS alias,
               p.icon         AS icon,
               p.unit_measure AS unit_measure,
               p.external_id  AS external_id
             FROM phenomenon_type p
             JOIN station_phenomenon_type sp ON p.id = sp.id_phenomenon_type
             JOIN station st ON sp.id_station = st.id
             WHERE st.external_id = :externalId
             ORDER BY p.alias;`,
            {
                replacements: { externalId },
                type: models.sequelize.QueryTypes.SELECT
            }
        );

        return results.map(f => ({
            nombre: f.name,
            alias_es: f.alias,
            alias_en: f.name_en,
            icono: f.icon,
            unidad: f.unit_measure,
            external_id: f.external_id,
            operaciones: f.operations || []
        }));
    }

    async get(external) {
        const result = await PhenomenonType.findOne({
            where: { external_id: external },
            where: { external_id: external },
            attributes: ['id', 'icon', 'unit_measure', 'external_id', 'status', 'name_en', 'alias', 'ttn_keys'],
            include: [
                { model: models.type_operation, as: 'type_operations', attributes: ['operation', 'external_id'] }
            ]
        });

        if (!result) {
            const error = new Error('NO EXISTE EL REGISTRO');
            error.code = 400;
            throw error;
        }
        const plain = result.get({ plain: true });
        plain.operations = plain.type_operations ? plain.type_operations.map(op => op.external_id) : [];
        return plain;
    }

    async create(data) {
        const transaction = await sequelize.transaction();

        try {
            const exists = await PhenomenonType.findOne({
                where: { alias: data.alias },
                transaction
            });
            if (exists) {
                const error = new Error('Ya existe una variable con ese nombre');
                error.code = 400;
                throw error;
            }

            let operations = data.operaciones;
            if (typeof operations === 'string') {
                operations = [operations];
            }
            if (!Array.isArray(operations) || operations.length === 0) {
                const error = new Error('Debe especificar al menos una operación');
                error.code = 400;
                throw error;
            }

            if (!Array.isArray(data.ttn_keys) || data.ttn_keys.length === 0) {
                const error = new Error('Debe agregar al menos una clave TTN para la variable');
                error.code = 400;
                throw error;
            }

            const phenomenonData = {
                alias: data.alias,
                name_en: data.alias_en,
                icon: data.iconFilename,
                unit_measure: data.unidad_medida,
                external_id: uuid.v4(),
                status: data.estado !== undefined ? data.estado : true,
                investigator_id: data.investigator_id,
                ttn_keys: Array.isArray(data.ttn_keys) ? data.ttn_keys : (data.ttn_keys ? [data.ttn_keys] : [])
            };

            const phenomenon = await PhenomenonType.create(phenomenonData, { transaction });

            if (data.operaciones && Array.isArray(data.operaciones)) {
                const ops = await models.type_operation.findAll({
                    where: { external_id: data.operaciones },
                    transaction
                });
                await phenomenon.setType_operations(ops, { transaction });
            }

            await transaction.commit();
            return true;

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async update(data) {
        const transaction = await sequelize.transaction();
        try {
            const phenomenon = await PhenomenonType.findOne({
                where: { external_id: data.external_id },
                transaction
            });
            if (!phenomenon) {
                const error = new Error("NO EXISTE EL REGISTRO");
                error.code = 400;
                throw error;
            }

            const isAdmin = data.userRoles && data.userRoles.includes('ADMINISTRADOR');
            if (!isAdmin && phenomenon.investigator_id !== data.userId) {
                const error = new Error("No tienes permisos para modificar esta variable");
                error.code = 403;
                throw error;
            }

            if (data.alias) {
                const dup = await PhenomenonType.findOne({
                    where: {
                        alias: data.alias,
                        external_id: { [Op.ne]: data.external_id }
                    },
                    transaction
                });
                if (dup) {
                    const error = new Error("Ya existe una variable con ese nombre");
                    error.code = 400;
                    throw error;
                }
            }

            let newIcon = phenomenon.icon;
            if (data.newIcon) {
                if (phenomenon.icon) {
                    const oldPath = path.join(__dirname, '../public/images/icons_estaciones', phenomenon.icon);
                    fs.unlink(oldPath, err => { if (err) console.warn('No se pudo borrar icono anterior:', err); });
                }
                newIcon = data.newIcon;
            }

            if (data.operaciones && Array.isArray(data.operaciones)) {
                const ops = await models.type_operation.findAll({
                    where: { external_id: data.operaciones },
                    transaction
                });
                await phenomenon.setType_operations(ops, { transaction });
            }

            phenomenon.name_en = data.name_en;
            phenomenon.alias = data.alias;
            phenomenon.icon = newIcon;
            phenomenon.status = data.estado;
            phenomenon.unit_measure = data.unidad_medida;
            phenomenon.external_id = uuid.v4();
            if (data.ttn_keys !== undefined) {
                phenomenon.ttn_keys = Array.isArray(data.ttn_keys)
                    ? data.ttn_keys
                    : (data.ttn_keys ? [data.ttn_keys] : []);
            }

            await phenomenon.save({ transaction });
            await transaction.commit();
            return true;

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async changeStatus(external_id, user) {
        const transaction = await sequelize.transaction();
        try {
            const phenomenon = await PhenomenonType.findOne({
                where: { external_id },
                transaction
            });

            if (!phenomenon) {
                const error = new Error("Tipo de variable no encontrada");
                error.code = 404;
                throw error;
            }

            const isAdmin = user.roles && user.roles.includes('ADMINISTRADOR');
            const isOwner = phenomenon.investigator_id && phenomenon.investigator_id === user.id;

            if (!isAdmin && !isOwner) {
                const error = new Error("No tienes permisos para modificar el estado de esta variable");
                error.code = 403;
                throw error;
            }

            if (phenomenon.status === true) {
                const activeStations = await phenomenon.getStations({
                    where: { 
                        status: {
                            [Op.in]: ['OPERATIVA', 'MANTENIMIENTO']
                        }
                    },
                    include: [
                        {
                            model: models.microbasin,
                            as: 'microbasins',
                            include: [
                                { model: models.entity, as: 'investigator', attributes: ['name', 'lastname'] }
                            ]
                        }
                    ]
                });

                if (activeStations.length > 0) {
                    const details = activeStations.slice(0, 3).map(s => {
                        const investigatorName = s.microbasin && s.microbasin.investigator
                            ? `${s.microbasin.investigator.name} ${s.microbasin.investigator.lastname}`
                            : 'Desconocido';
                        return `• ${s.alias} (Estado: ${s.status})`;
                    }).join('\n');

                    const more = activeStations.length > 3 ? `\n... y ${activeStations.length - 3} más.` : '';

                    const error = new Error(`No se puede desactivar la variable porque está vinculada a estaciones operativas o en mantenimiento:\n${details}${more}`);
                    error.code = 400;
                    throw error;
                }
            }

            phenomenon.status = !phenomenon.status;
            await phenomenon.save({ transaction });
            await transaction.commit();

            return {
                external_id,
                nuevo_estado: phenomenon.status ? 'ACTIVO' : 'INACTIVO'
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

module.exports = new PhenomenonTypeService();
