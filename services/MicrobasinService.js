'use strict';

const models = require('../models');
const { Op } = require('sequelize');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models');
const proj4 = require('proj4');
const { log } = require('console');
const utm17s = "+proj=utm +zone=17 +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs";
const wgs84 = "EPSG:4326";

const Microbasin = models.microbasin;
const Station = models.station;
const Entity = models.entity;

const readCoordinates = (filename) => {
    if (!filename || filename === 'default.txt') return [];
    try {
        const filePath = path.join(__dirname, '../public/data/microcuencas', filename);

        if (!fs.existsSync(filePath)) return [];

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const coordinates = [];
        const firstLine = lines[0] || '';
        let delimiter = ',';
        if (firstLine.includes('\t')) {
            delimiter = '\t';
        } else if (firstLine.includes(';')) {
            delimiter = ';';
        }
        const headers = firstLine.trim().split(delimiter).map(h => h.trim());
        const xOptions = ['CordX', 'POINT_X', 'X_coord', 'Puntos_x_m'];
        const yOptions = ['CordY', 'POINT_Y', 'Y_coord', 'Puntos_y_m'];
        const xIndex = headers.findIndex(h => xOptions.includes(h));
        const yIndex = headers.findIndex(h => yOptions.includes(h));

        lines.slice(1).forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            const parts = trimmedLine.split(delimiter);

            if (xIndex !== -1 && yIndex !== -1 && parts[xIndex] !== undefined && parts[yIndex] !== undefined) {
                const xStr = parts[xIndex].toString().replace(',', '.');
                const yStr = parts[yIndex].toString().replace(',', '.');

                let x = parseFloat(xStr);
                let y = parseFloat(yStr);

                if (!isNaN(x) && !isNaN(y)) {
                    if (Math.abs(x) > 180 || Math.abs(y) > 90) {
                        try {
                            const converted = proj4(utm17s, wgs84, [x, y]);
                            x = converted[0];
                            y = converted[1];
                        } catch (e) {
                            console.warn('Error converting coordinates:', e);
                        }
                    }

                    coordinates.push({ lng: x, lat: y });
                }
            }
        });

        return coordinates;
    } catch (error) {
        console.error('Error parsing coordinates:', error);
        return [];
    }
};

class MicrobasinService {

    async list(activeOnly = false, role = null, userId = null, page = 1, limit = 10, searchTerm = '') {
        console.log('MicrobasinService.list params:', { activeOnly, role, userId, page, limit, searchTerm });
        const where = {};
        if (activeOnly !== null) {
            where.status = activeOnly;
        }

        if (role && role.includes('INVESTIGADOR') && !role.includes('ADMINISTRADOR') && userId) {
            where.investigator_id = userId;
        }

        if (searchTerm) {
            where.name = { [Op.iLike]: `%${searchTerm}%` };
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await Microbasin.findAndCountAll({
            where: Object.keys(where).length > 0 ? where : undefined,
            attributes: ['external_id', 'status', 'picture', 'name', 'description', 'name_en', 'description_en', 'coordinate_file'],
            include: {
                model: Entity,
                as: 'investigator',
                attributes: ['name', 'lastname', 'external_id']
            },
            offset: parseInt(offset),
            limit: parseInt(limit),
            order: [['name', 'ASC']]
        });

        const results = rows.map(mb => {
            const plain = mb.get({ plain: true });
            plain.coordinates = readCoordinates(plain.coordinate_file);
            return plain;
        });

        return {
            rows: results,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        };

    }

    async findAll(role = null, userId = null, page = 1, limit = 10, searchTerm = '') {
        const where = {};

        if (role && role.includes('INVESTIGADOR') && !role.includes('ADMINISTRADOR') && userId) {
            where.investigator_id = userId;
        }

        if (searchTerm) {
            where.name = { [Op.iLike]: `%${searchTerm}%` };
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await Microbasin.findAndCountAll({
            where: Object.keys(where).length > 0 ? where : undefined,
            where: Object.keys(where).length > 0 ? where : undefined,
            attributes: ['external_id', 'status', 'picture', 'name', 'description', 'name_en', 'description_en', 'coordinate_file'],
            include: {
                model: Entity,
                as: 'investigator',
                attributes: ['name', 'lastname', 'external_id']
            },
            offset: parseInt(offset),
            limit: parseInt(limit),
            order: [['name', 'ASC']]
        });

        const results = rows.map(mb => {
            const plain = mb.get({ plain: true });
            plain.coordinates = readCoordinates(plain.coordinate_file);
            return plain;
        });

        return {
            rows: results,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        };
    }

    async get(external) {
        const result = await Microbasin.findOne({
            where: { external_id: external },
            attributes: ['id', 'name', 'name_en', 'external_id', 'picture', 'status', 'description', 'description_en', 'coordinate_file'],
        });

        if (!result) {
            const error = new Error('NO EXISTE EL REGISTRO');
            error.code = 400;
            throw error;
        }
        return result;
    }

    async getWithStations(detailStations = false) {
        const include = [{
            model: Station,
            as: 'stations',
            attributes: ['name', 'external_id', 'picture', 'longitude', 'latitude', 'altitude', 'status', 'type', 'id_device', 'description', 'name_en', 'description_en', 'alias']
        }];

        const attributes = detailStations
            ? ['name', 'description', 'name_en', 'description_en', 'picture', 'status']
            : undefined;

        const results = await Microbasin.findAll({
            attributes,
            include,
            order: [['name', 'ASC']]
        });

        if (!results) {
            const error = new Error('NO EXISTE LA CUENCA');
            error.code = 400;
            throw error;
        }
        return results;
    }

    async create(data) {
        const transaction = await sequelize.transaction();

        try {
            const existing = await Microbasin.findOne({
                where: { name: data.nombre },
                transaction
            });
            if (existing) {
                const error = new Error('Ya existe una cuenca con ese nombre');
                error.code = 400;
                throw error;
            }

            const microbasinData = {
                name: data.nombre,
                name_en: data.nombre_en,
                picture: data.pictureFilename,
                coordinate_file: data.coordinateFilename,
                description: data.descripcion,
                description_en: data.descripcion_en,
                external_id: uuid.v4(),
                investigator_id: data.investigator_id
            };

            await Microbasin.create(microbasinData, { transaction });
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
            const existing = await Microbasin.findOne({
                where: { external_id: data.external_id },
                transaction
            });
            if (!existing) {
                const error = new Error('NO EXISTE EL REGISTRO');
                error.code = 400;
                throw error;
            }

            if (data.nombre && data.nombre !== existing.name) {
                const dup = await Microbasin.findOne({
                    where: {
                        name: data.nombre,
                        external_id: { [Op.ne]: data.external_id }
                    },
                    transaction
                });
                if (dup) {
                    const error = new Error('Ya existe una cuenca con ese nombre');
                    error.code = 400;
                    throw error;
                }
            }

            let newPicture = existing.picture;
            if (data.newPicture) {
                if (existing.picture) {
                    const oldPath = path.join(__dirname, '../public/images/microcuencas', existing.picture);
                    fs.unlink(oldPath, err => { if (err) console.warn('No se pudo borrar imagen antigua:', err); });
                }
                newPicture = data.newPicture;
            }

            let newCoordinateFile = existing.coordinate_file;
            if (data.newCoordinateFile) {
                if (existing.coordinate_file && existing.coordinate_file !== 'default.txt') {
                    const oldPath = path.join(__dirname, '../public/data/microcuencas', existing.coordinate_file);
                    fs.unlink(oldPath, err => { if (err) console.warn('No se pudo borrar archivo de coordenadas antiguo:', err); });
                }
                newCoordinateFile = data.newCoordinateFile;
            }

            console.log('Coordenadas:', { coordinates: newCoordinateFile });

            existing.name = data.nombre;
            existing.name_en = data.nombre_en;
            existing.status = data.estado;
            existing.picture = newPicture;
            existing.coordinate_file = newCoordinateFile;
            existing.description = data.descripcion;
            existing.description_en = data.descripcion_en;
            existing.external_id = uuid.v4();

            const updated = await existing.save({ transaction });
            if (!updated) {
                throw new Error('No se aplicaron los cambios');
            }

            await transaction.commit();
            return true;

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async changeStatus(external_id, user) {
        const microbasin = await Microbasin.findOne({ where: { external_id } });

        if (!microbasin) {
            const error = new Error("Cuenca no encontrada");
            error.code = 404;
            throw error;
        }

        const isAdmin = user.roles && user.roles.includes('ADMINISTRADOR');
        const isOwner = microbasin.investigator_id === user.id;

        if (!isAdmin && !isOwner) {
            const error = new Error("No tienes permisos para modificar el estado de esta cuenca");
            error.code = 403;
            throw error;
        }

        if (microbasin.status === true) {
            const estacionesActivas = await Station.findAll({
                include: [{
                    model: Microbasin,
                    as: 'microbasins',
                    where: { id: microbasin.id }
                }],
                where: {
                    status: 'OPERATIVA'
                }
            });

            if (estacionesActivas.length > 0) {
                const error = new Error("No se puede desactivar la cuenca porque tiene estaciones activas asociadas. Desactive primero las estaciones.");
                error.code = 400;
                error.info = { estaciones_activas: estacionesActivas.length };
                throw error;
            }
        }

        microbasin.status = !microbasin.status;
        await microbasin.save();

        return {
            external_id,
            nuevo_estado: microbasin.status ? 'ACTIVO' : 'INACTIVO'
        };
    }

    async listActiveByInvestigator(userId, page = 1, limit = 10, searchTerm = '', roles = []) {
        const where = {
            status: true
        };

        const isAdmin = roles.includes('ADMINISTRADOR');

        if (!isAdmin) {
            where.investigator_id = userId;
        }

        if (searchTerm) {
            where.name = { [Op.iLike]: `%${searchTerm}%` };
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await Microbasin.findAndCountAll({
            where,
            attributes: ['external_id', 'status', 'picture', 'name', 'description', 'name_en', 'description_en', 'coordinate_file'],
            include: {
                model: Entity,
                as: 'investigator',
                attributes: ['name', 'lastname', 'external_id']
            },
            offset: parseInt(offset),
            limit: parseInt(limit),

            order: [
                [sequelize.literal(`CASE WHEN "microbasin"."investigator_id" = ${userId} THEN 0 ELSE 1 END`), 'ASC'],
                ['name', 'ASC']
            ]
        });

        const results = rows.map(mb => {
            const plain = mb.get({ plain: true });
            plain.coordinates = readCoordinates(plain.coordinate_file);
            return plain;
        });

        return {
            rows: results,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        };
    }

    async listInactiveByInvestigator(userId, page = 1, limit = 10, searchTerm = '', roles = []) {
        const where = {
            status: false
        };

        const isAdmin = roles.includes('ADMINISTRADOR');

        if (!isAdmin) {
            where.investigator_id = userId;
        }

        if (searchTerm) {
            where.name = { [Op.iLike]: `%${searchTerm}%` };
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await Microbasin.findAndCountAll({
            where,
            attributes: ['external_id', 'status', 'picture', 'name', 'description', 'name_en', 'description_en', 'coordinate_file'],
            include: {
                model: Entity,
                as: 'investigator',
                attributes: ['name', 'lastname', 'external_id']
            },
            offset: parseInt(offset),
            limit: parseInt(limit),
            order: [
                [sequelize.literal(`CASE WHEN "microbasin"."investigator_id" = ${userId} THEN 0 ELSE 1 END`), 'ASC'],
                ['name', 'ASC']
            ]
        });

        const results = rows.map(mb => {
            const plain = mb.get({ plain: true });
            plain.coordinates = readCoordinates(plain.coordinate_file);
            return plain;
        });

        return {
            rows: results,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        };
    }
}

module.exports = new MicrobasinService();
