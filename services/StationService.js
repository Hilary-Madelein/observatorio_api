'use strict';

const models = require('../models');
const { Op } = require('sequelize');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models');

const Station = models.station;
const Microbasin = models.microbasin;

class StationService {

    async list(role = null, userId = null) {
        const include = [];
        include.push({
            model: Microbasin,
            as: 'microbasins',
            attributes: ['name'],
            include: [{
                model: models.entity,
                as: 'investigator',
                attributes: ['name', 'lastname', 'external_id']
            }]
        });

        if (role === 'INVESTIGADOR' && userId) {
            const microbasinInclude = include.find(i => i.as === 'microbasins');
            if (microbasinInclude) {
                microbasinInclude.where = { investigator_id: userId };
                microbasinInclude.required = true;
            }
        }

        return await Station.findAll({
            include: include.length > 0 ? include : undefined,
            attributes: ['name', 'external_id', 'picture', 'longitude', 'latitude', 'altitude', 'status', 'type', 'id_device', 'app_user', 'name_en', 'description_en', 'alias'],
        });
    }

    async listActive(role = null, userId = null) {
        return await Station.findAll({
            where: { status: 'OPERATIVA' },
            include: [
                {
                    model: Microbasin,
                    as: 'microbasins',
                    attributes: ['external_id', 'name'],
                    required: true
                },
                ...(role === 'INVESTIGADOR' && userId ? [{
                    model: Microbasin,
                    as: 'microbasins',
                    where: { investigator_id: userId },
                    required: true,
                    attributes: []
                }] : [])
            ],
            attributes: [
                'external_id',
                'name',
                'alias',
                ['name_en', 'alias_en'],
                'picture',
                'longitude',
                'latitude',
                'altitude',
                'type',
                'id_device',
                'app_user',
                ['description_en', 'description_en']
            ],
        });
    }

    async listActiveMQTT(user) {
        const where = {
            status: {
                [Op.in]: ['OPERATIVA', 'MANTENIMIENTO']
            }
        };
        if (user) {
            where.app_user = user;
        }

        return await Station.findAll({
            where,
            attributes: ['external_id', 'status', 'id_device', 'app_user'],
        });
    }

    async listByMicrobasinAndStatus(external_id, estado, page = 1, limit = 10, searchTerm = '') {
        const microbasin = await Microbasin.findOne({ where: { external_id } });

        if (!microbasin) {
            throw new Error('Cuenca no encontrada');
        }

        const linkedStations = await models.station_microbasin.findAll({
            where: { id_microbasin: microbasin.id },
            attributes: ['id_station']
        });
        const stationIds = linkedStations.map(ls => ls.id_station);

        const where = {
            id: { [Op.in]: stationIds }
        };

        if (estado && estado !== 'null' && estado !== 'undefined' && estado !== 'TODAS') {
            where.status = estado.toUpperCase();
        }

        if (searchTerm) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${searchTerm}%` } },
                { alias: { [Op.iLike]: `%${searchTerm}%` } }
            ];
        }

        const offset = (page - 1) * limit;

        const { count, rows } = await Station.findAndCountAll({
            where,
            attributes: [
                'name',
                'external_id',
                'picture',
                'longitude',
                'latitude',
                'altitude',
                'status',
                'type',
                'id_device',
                'description',
                'app_user',
                'name_en',
                'description_en',
                'alias'
            ],
            include: [
                {
                    model: Microbasin,
                    as: 'microbasins',
                    attributes: ['name'],
                    include: [{
                        model: models.entity,
                        as: 'investigator',
                        attributes: ['name', 'lastname', 'external_id']
                    }]
                }
            ],
            offset: parseInt(offset),
            limit: parseInt(limit),
            order: [['name', 'ASC']]
        });

        return {
            microcuenca: microbasin.name,
            estaciones: rows,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        };
    }

    async getByMicrobasin(external, onlyActive = false) {
        const microbasin = await Microbasin.findOne({ where: { external_id: external } });
        if (!microbasin) {
            throw new Error('Cuenca no encontrada');
        }

        const linkedStations = await models.station_microbasin.findAll({
            where: { id_microbasin: microbasin.id },
            attributes: ['id_station']
        });
        const stationIds = linkedStations.map(ls => ls.id_station);

        const where = {
            id: { [Op.in]: stationIds }
        };
        if (onlyActive) {
            where.status = "OPERATIVA";
        }

        const stations = await Station.findAll({
            where,
            attributes: [
                'name', 'external_id', 'picture', 'longitude', 'latitude', 'altitude',
                'status', 'type', 'id_device', 'description', 'app_user',
                'name_en', 'description_en', 'alias'
            ],
        });

        return {
            microcuenca_nombre: microbasin.name,
            info: stations
        };
    }

    async getByExternal(external_id) {
        const station = await Station.findOne({
            where: { external_id },
            attributes: ['name', 'external_id', 'picture', 'longitude', 'latitude', 'altitude', 'status', 'type', 'id_device', 'description', 'app_user', 'name_en', 'description_en', 'alias'],
            include: [
                {
                    model: models.phenomenon_type,
                    as: 'phenomenon_types',
                    attributes: ['external_id', 'name_en', 'alias', 'unit_measure', 'icon'],
                    through: { attributes: [] }
                }
            ]
        });
        if (!station) {
            throw new Error('Estación no encontrada');
        }
        return station;
    }

    async create(data, topicTemplate) {
        const transaction = await sequelize.transaction();
        try {
            const microbasin = await Microbasin.findOne({
                where: { external_id: data.id_microcuenca }
            });
            if (!microbasin) {
                const err = new Error('La cuenca especificada no existe');
                err.code = 400;
                throw err;
            }

            const dup = await Station.findOne({ where: { name: data.nombre } });
            if (dup) {
                const err = new Error('Ya existe una estación con ese nombre');
                err.code = 400;
                throw err;
            }

            const stationData = {
                name: data.nombre,
                name_en: data.alias_en,
                alias: data.alias,
                longitude: data.longitud,
                latitude: data.latitud,
                altitude: data.altitud,
                status: data.estado,
                type: data.tipo,
                id_device: data.id_dispositivo,
                picture: data.picture,
                description: data.descripcion,
                description_en: data.descripcion_en,
                external_id: uuid.v4(),
                app_user: data.app_user
            };

            const station = await Station.create(stationData, { transaction });
            await station.addMicrobasin(microbasin, { transaction });

            if (data.phenomenon_ids) {
                const phenomena = await models.phenomenon_type.findAll({
                    where: { external_id: data.phenomenon_ids },
                    transaction
                });
                await station.setPhenomenon_types(phenomena, { transaction });
            }

            // TRIGGER MQTT RELOAD
            try {
                const MqttService = require('./MqttService');
                MqttService.reloadBrokers();
            } catch (mqttErr) {
                console.warn('Could not reload MQTT service:', mqttErr);
            }

            await transaction.commit();
            return station;

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async update(data, topicTemplate) {
        const transaction = await sequelize.transaction();
        try {
            const station = await Station.findOne({
                where: { external_id: data.external_id },
                transaction
            });
            if (!station) {
                const err = new Error('NO EXISTE EL REGISTRO');
                err.code = 400;
                throw err;
            }

            if (data.alias && data.alias !== station.alias) {
                const dup = await Station.findOne({ where: { name: data.alias }, transaction });
                if (dup) throw { message: 'Ya existe una estación con ese alias', code: 400 };
            }
            if (data.nombre && data.nombre !== station.name) {
                const dup = await Station.findOne({ where: { name: data.nombre }, transaction });
                if (dup) throw { message: 'Ya existe una estación con ese nombre', code: 400 };
            }

            const oldDevice = station.id_device;
            if (data.id_dispositivo && data.id_dispositivo !== oldDevice) {
                const dup = await Station.findOne({ where: { id_device: data.id_dispositivo }, transaction });
                if (dup) throw { message: 'Ya existe una estación con ese dispositivo', code: 400 };
            }

            let newPicture = station.picture;
            if (data.newPicture) {
                if (station.picture) {
                    const oldPath = path.join(__dirname, '../public/images/estaciones/', station.picture);
                    fs.unlink(oldPath, err => { if (err) console.warn('No se pudo borrar imagen antigua:', err); });
                }
                newPicture = data.newPicture;
            }

            station.name = data.nombre;
            station.alias = data.alias;
            station.name_en = data.alias_en;
            station.longitude = data.longitud;
            station.latitude = data.latitud;
            station.altitude = data.altitud;
            station.type = data.tipo;
            station.description = data.descripcion;
            station.description_en = data.descripcion_en;
            station.id_device = data.id_dispositivo;
            station.app_user = data.app_user;
            station.picture = newPicture;
            station.external_id = uuid.v4();
            
            await station.save({ transaction });

            if (data.phenomenon_ids) {
                const phenomena = await models.phenomenon_type.findAll({
                    where: { external_id: data.phenomenon_ids },
                    transaction
                });
                await station.setPhenomenon_types(phenomena, { transaction });
            }
            if (data.id_microcuenca) {
                let mIds = [];
                try {
                    mIds = typeof data.id_microcuenca === "string" && data.id_microcuenca.startsWith("[")
                        ? JSON.parse(data.id_microcuenca)
                        : [data.id_microcuenca];
                } catch (e) {
                    mIds = [data.id_microcuenca];
                }

                const microbasinsItems = await Microbasin.findAll({
                    where: { external_id: mIds },
                    transaction
                });
                await station.setMicrobasins(microbasinsItems, { transaction });
            }

            // TRIGGER MQTT RELOAD
            try {
                const MqttService = require('./MqttService');
                MqttService.reloadBrokers();
            } catch (mqttErr) {
                console.warn('Could not reload MQTT service:', mqttErr);
            }

            await transaction.commit();
            return { station, new_external_id: station.external_id };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async changeStatus(external_id, estado, user, topicTemplate) {
        const estacion = await Station.findOne({
            where: { external_id },
            include: [{ model: Microbasin, as: 'microbasins' }]
        });
        if (!estacion) {
            const err = new Error('Estación no encontrada');
            err.code = 404;
            throw err;
        }

        const isAdmin = user.roles && user.roles.includes('ADMINISTRADOR');
        const isOwner = estacion.microbasins && estacion.microbasins.some(mb => mb.investigator_id === user.id);

        if (!isAdmin && !isOwner) {
            const err = new Error('No tienes permisos para modificar esta estación');
            err.code = 403;
            throw err;
        }

        const estadoMap = estado.replace(/ /g, '_').toUpperCase();
        const validStates = ['OPERATIVA', 'NO_OPERATIVA', 'MANTENIMIENTO'];
        if (!validStates.includes(estadoMap)) {
            const err = new Error('Estado no válido');
            err.code = 400;
            throw err;
        }

        estacion.status = estadoMap;
        await estacion.save();

        // TRIGGER MQTT RELOAD
        try {
            const MqttService = require('./MqttService');
            MqttService.reloadBrokers();
        } catch (mqttErr) {
            console.warn('Could not reload MQTT service:', mqttErr);
        }

        return { external_id, nuevo_estado: estacion.status };
    }

    async linkToMicrobasin(stationExternalId, microbasinExternalId) {
        const station = await Station.findOne({ where: { external_id: stationExternalId } });
        if (!station) throw new Error('Estación no encontrada');

        const microbasin = await Microbasin.findOne({ where: { external_id: microbasinExternalId } });
        if (!microbasin) throw new Error('Cuenca no encontrada');

        await station.addMicrobasin(microbasin);
        return { station, microbasin };
    }

    async unlinkFromMicrobasin(stationExternalId, microbasinExternalId) {
        const station = await Station.findOne({ where: { external_id: stationExternalId } });
        const microbasin = await Microbasin.findOne({ where: { external_id: microbasinExternalId } });

        if (!station || !microbasin) throw new Error('Estación o Cuenca no encontrada');

        await station.removeMicrobasin(microbasin);
        return { success: true };
    }

    async listAvailableForLinking(microbasinExternalId, searchTerm = '') {
        const microbasin = await Microbasin.findOne({
            where: { external_id: microbasinExternalId },
            include: [{ model: Station, as: 'stations', attributes: ['id'] }]
        });
        if (!microbasin) throw new Error('Cuenca no encontrada');

        const linkedStationIds = microbasin.stations.map(s => s.id);

        const where = {
            id: { [Op.notIn]: linkedStationIds.length > 0 ? linkedStationIds : [0] }
        };

        if (searchTerm) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${searchTerm}%` } },
                { alias: { [Op.iLike]: `%${searchTerm}%` } }
            ];
        }

        return await Station.findAll({
            where,
            attributes: ['name', 'alias', 'external_id', 'type', 'status'],
            limit: 20
        });
    }
}

module.exports = new StationService();
