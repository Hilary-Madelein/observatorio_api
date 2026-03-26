'use strict';

const { v4: uuidv4 } = require('uuid');
const models = require('../models');
const { Op } = require('sequelize');
const { getIO } = require('../config/socket.config');

const Station = models.station;
const Quantity = models.quantity;
const Measurement = models.measurement;
const PhenomenonType = models.phenomenon_type;
const DailyMeasurement = models.daily_measurement;
const TypeOperation = models.type_operation;

const GRANULAR_WINDOW_DAYS = 3;

class MeasurementService {

    /**
     * Helper to calculate start/end dates based on range
     */
    calculateDates(range, now = new Date()) {
        let fechaInicio;
        let fechaFin = now;
        if (['15min', '30min', 'hora'].includes(range)) {
            const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            fechaInicio = new Date(inicioHoy.getTime() - 3 * 24 * 60 * 60 * 1000);
        } else if (range === 'diaria') {
            const inicioHoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            fechaInicio = new Date(inicioHoy.getTime() - 14 * 24 * 60 * 60 * 1000);
            fechaFin = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                23, 59, 59, 999
            );
        } else {
            throw new Error('Rango inválido');
        }
        return { fechaInicio, fechaFin };
    }

    /**
     * Logic for processing TTN payload
     */
    async processTTNPayload(fecha, dispositivo, payload) {
        const station = await Station.findOne({ where: { id_device: dispositivo } });
        if (!station) {
            throw new Error('Estación no encontrada');
        }

        const MAX_ANOMALO = 50000;
        const EXEMPT_VARS = new Set([
            'solidos_suspendidos_gs (mg/s)',
            'nivel_de_agua',
            'radiation',
            'caudal (l/s)'
        ]);

        const allPhenomena = await PhenomenonType.findAll({ where: { status: true } });

        const phenomByKey = new Map();
        for (const ph of allPhenomena) {
            for (const key of (ph.ttn_keys || [])) {
                phenomByKey.set(key.toLowerCase(), ph);
            }
        }

        const fechaDate = new Date(fecha);
        const quantities = [];
        const measurementsMeta = [];
        let valor_rain = 0;

        const fLluvia = phenomByKey.get('rain_mm');

        if (!fLluvia) {
            console.warn("No se encontró un tipo de fenómeno configurado para 'rain_mm'");
        }

        const idLluvia = fLluvia ? fLluvia.id : null;

        const lastRainMeasurement = idLluvia ? await Measurement.findOne({
            where: {
                id_station: station.id,
                id_phenomenon_type: idLluvia
            },
            include: [{ model: Quantity, as: 'quantity' }],
            order: [['local_date', 'DESC']]
        }) : null;

        let valorAnterior = lastRainMeasurement ? parseFloat(lastRainMeasurement.quantity.quantity) : 0;

        for (const [variable, rawValue] of Object.entries(payload)) {
            let valor = parseFloat(rawValue);
            if (isNaN(valor)) continue;

            if (variable === 'Nivel_de_agua') {
                valor += 2200;
            }

            if (variable === 'rain_mm') {
                if (valor >= valorAnterior) {
                    valor_rain = valor - valorAnterior;
                } else {
                    valor_rain = valor;
                }
                valor = valor_rain;
            }

            if (!EXEMPT_VARS.has(variable.toLowerCase()) && valor > MAX_ANOMALO) {
                continue;
            }

            const phenomenon = phenomByKey.get(variable.toLowerCase());
            if (!phenomenon) continue;

            quantities.push({
                quantity: valor,
                external_id: uuidv4(),
                status: true,
                _variable: variable,
                _phenomenonId: phenomenon.id,
                _unit: phenomenon.unit_measure || ''
            });
        }

        const createdQuantities = await Quantity.bulkCreate(
            quantities.map(({ quantity, external_id, status }) => ({ quantity, external_id, status })),
            { returning: true }
        );

        const measurementsToInsert = createdQuantities.map((q, i) => ({
            local_date: fechaDate,
            id_station: station.id,
            id_quantity: q.id,
            id_phenomenon_type: quantities[i]._phenomenonId,
            external_id: uuidv4(),
            status: true
        }));

        await Measurement.bulkCreate(measurementsToInsert);

        const savedMeasurements = quantities.map((meta, i) => ({
            tipo_medida: meta._variable,
            valor: meta.quantity,
            unidad: meta._unit,
            estacion: dispositivo
        }));

        try {
            getIO().emit('new-measurements', savedMeasurements);
        } catch (err) {
            console.warn('Socket no disponible:', err.message);
        }

        return savedMeasurements;
    }

    /**
     * Get latest measurements for all variables
     */
    async getLatestMeasurements() {
        const results = await models.sequelize.query(
            `
            SELECT DISTINCT ON (p.alias, st.external_id)
              p.alias                AS tipo_medida,
              p.alias               AS alias_es,
              p.name_en             AS alias_en,
              q.quantity            AS valor,
              p.unit_measure        AS unidad,
              st.name               AS estacion,
              COALESCE(st.alias, st.name) AS estacion_alias_es,
              COALESCE(st.alias, st.name) AS estacion_alias_en,
              m.local_date          AS fecha_medicion
            FROM measurement m
            JOIN quantity q
              ON m.id_quantity = q.id
             AND q.status = TRUE
            JOIN phenomenon_type p
              ON m.id_phenomenon_type = p.id
             AND p.status = TRUE
            JOIN station st
              ON m.id_station = st.id
             AND st.status = 'OPERATIVA'    
            WHERE m.status = TRUE
            ORDER BY p.alias, st.external_id, m.local_date DESC;
            `,
            { type: models.sequelize.QueryTypes.SELECT }
        );

        return results.map(row => ({
            tipo_medida: row.tipo_medida,
            alias_es: row.alias_es,
            alias_en: row.alias_en,
            valor: parseFloat(row.valor),
            unidad: row.unidad,
            estacion: row.estacion,
            estacion_alias_es: row.estacion_alias_es,
            estacion_alias_en: row.estacion_alias_en,
            fecha_medicion: row.fecha_medicion.toISOString()
        }));
    }

    /**
     * Get latest measurements for a specific station
     */
    async getStationLatestMeasurements(externalId) {
        const results = await models.sequelize.query(
            `
              SELECT DISTINCT ON (p.alias, st.id)
                     p.alias         AS tipo_medida,
                     p.icon         AS icono,
                     p.alias        AS alias_es,
                     p.name_en      AS alias_en,
                     q.quantity     AS valor,
                     p.unit_measure AS unidad,
                     m.local_date   AS fecha_medicion
              FROM measurement m
              JOIN quantity q 
                ON m.id_quantity = q.id 
               AND q.status = true          
              JOIN phenomenon_type p 
                ON m.id_phenomenon_type = p.id 
               AND p.status = true         
              JOIN station st 
                ON m.id_station = st.id 
               AND st.external_id = :externalId
              WHERE m.status = true         
              ORDER BY p.alias, st.id, m.local_date DESC;
            `,
            {
                replacements: { externalId },
                type: models.sequelize.QueryTypes.SELECT
            }
        );

        return results.map(row => ({
            tipo_medida: row.tipo_medida,
            alias_es: row.alias_es,
            alias_en: row.alias_en,
            valor: parseFloat(row.valor),
            unidad: row.unidad,
            fecha_medicion: row.fecha_medicion,
            icono: row.icono
        }));
    }

    /**
     * Get time series measurements
     */
    async getTimeSeries(rango, estacion, tipo_medida) {
        const estacionFinal = estacion === 'TODAS' ? null : estacion;
        const tipoMedidaFinal = tipo_medida === 'TODAS' ? null : tipo_medida;

        const ahora = new Date();
        const { fechaInicio, fechaFin } = this.calculateDates(rango, ahora);

        const joinMeasurement = `
            JOIN quantity q
              ON m.id_quantity = q.id AND q.status = true
            JOIN phenomenon_type p
              ON m.id_phenomenon_type = p.id AND p.status = true
            JOIN station st
              ON m.id_station = st.id AND st.status = 'OPERATIVA'
        `;

        const joinDaily = `
            JOIN phenomenon_type p
              ON dm.id_phenomenon_type = p.id AND p.status = true
            JOIN station st
              ON dm.id_station = st.id AND st.status = 'OPERATIVA'
        `;

        if (['15min', '30min', 'hora'].includes(rango)) {
            const intervalMap = { '15min': 15, '30min': 30, 'hora': 60 };
            const bucket = intervalMap[rango];

            const sql = `
              SELECT
                (
                  date_trunc('day', m.local_date)
                  + date_part('hour', m.local_date) * interval '1 hour'
                  + floor(date_part('minute', m.local_date)/${bucket}) * interval '${bucket} minutes'
                ) AS periodo,
                p.alias         AS tipo_medida,
                p.alias        AS alias_es,
                p.name_en      AS alias_en,
                p.icon         AS variable_icon,
                p.unit_measure AS unidad,
      
                -- ESTACIÓN
                st.external_id       AS estacion,
                st.alias             AS estacion_alias_es,
                st.name_en           AS estacion_alias_en,
      
                AVG(q.quantity) FILTER(WHERE op.operation = 'PROMEDIO') AS promedio,
                MAX(q.quantity) FILTER(WHERE op.operation = 'MAX')     AS maximo,
                MIN(q.quantity) FILTER(WHERE op.operation = 'MIN')     AS minimo,
                SUM(q.quantity) FILTER(WHERE op.operation = 'SUMA')    AS suma
              FROM measurement m
              ${joinMeasurement}
              -- Join with operations
              JOIN phenomenon_operation po ON po.id_phenomenon_type = p.id
              JOIN type_operation op ON po.id_type_operation = op.id AND op.status = TRUE
              WHERE m.local_date BETWEEN :fechaInicio AND :fechaFin
                AND m.status = true
                AND (:estacion IS NULL OR st.external_id = :estacion)
                AND (:tipo_medida IS NULL OR p.external_id = :tipo_medida)
              GROUP BY
                periodo,
                p.alias, p.name_en, p.icon, p.unit_measure,
                st.external_id, st.alias, st.name_en
              ORDER BY periodo;
            `;

            const rows = await models.sequelize.query(sql, {
                replacements: {
                    fechaInicio,
                    fechaFin,
                    estacion: estacionFinal,
                    tipo_medida: tipoMedidaFinal
                },
                type: models.sequelize.QueryTypes.SELECT
            });

            const seriesMap = {};
            rows.forEach(r => {
                const fechaKey = new Date(r.periodo).toISOString();
                const mapKey = `${fechaKey}__${r.estacion}`;
                seriesMap[mapKey] ??= {
                    hora: fechaKey,
                    estacion: r.estacion,
                    estacion_alias_es: r.estacion_alias_es,
                    estacion_alias_en: r.estacion_alias_en,
                    medidas: {}
                };

                const ops = {};
                if (r.promedio != null) ops.PROMEDIO = Math.round(r.promedio * 100) / 100;
                if (r.maximo != null) ops.MAX = parseFloat(r.maximo);
                if (r.minimo != null) ops.MIN = parseFloat(r.minimo);
                if (r.suma != null) ops.SUMA = parseFloat(r.suma);

                ops.icon = r.variable_icon;
                ops.unidad = r.unidad;
                ops.alias_es = r.alias_es;
                ops.alias_en = r.alias_en;

                seriesMap[mapKey].medidas[r.tipo_medida] = ops;
            });

            return Object.values(seriesMap);
        }

        if (rango === 'diaria') {
            const sqlPre = `
              SELECT
                dm.local_date        AS periodo,
                p.alias               AS tipo_medida,
                p.alias              AS alias_es,
                p.name_en            AS alias_en,
                p.icon               AS variable_icon,
                p.unit_measure       AS unidad,
      
                -- estación
                st.external_id       AS estacion,
                st.alias             AS estacion_alias_es,
                st.name_en           AS estacion_alias_en,
      
                dm.quantity          AS valor,
                dm.id_type_operation AS op
              FROM daily_measurement dm
              ${joinDaily}
              WHERE dm.local_date BETWEEN :fechaInicio AND :fechaFin
                AND dm.status = true
                AND (:estacion IS NULL OR st.external_id = :estacion)
                AND (:tipo_medida IS NULL OR p.external_id = :tipo_medida)
            `;

            const sqlRaw = `
              SELECT
                date_trunc('day', m.local_date) AS periodo,
                p.alias         AS tipo_medida,
                p.alias        AS alias_es,
                p.name_en      AS alias_en,
                p.icon         AS variable_icon,
                p.unit_measure AS unidad,
      
                -- estación
                st.external_id       AS estacion,
                st.alias             AS estacion_alias_es,
                st.name_en           AS estacion_alias_en,
      
                AVG(q.quantity) FILTER(WHERE op.operation = 'PROMEDIO') AS promedio,
                MAX(q.quantity) FILTER(WHERE op.operation = 'MAX')     AS maximo,
                MIN(q.quantity) FILTER(WHERE op.operation = 'MIN')     AS minimo,
                SUM(q.quantity) FILTER(WHERE op.operation = 'SUMA')    AS suma
              FROM measurement m
              ${joinMeasurement}
              JOIN phenomenon_operation po ON po.id_phenomenon_type = p.id
              JOIN type_operation op ON po.id_type_operation = op.id AND op.status = TRUE
              -- LEFT JOIN reemplaza el NOT EXISTS correlacionado (más eficiente con índice idx_dm_date_phenom_status)
              LEFT JOIN daily_measurement dm2
                ON dm2.local_date = date_trunc('day', m.local_date)::date
               AND dm2.id_phenomenon_type = m.id_phenomenon_type
               AND dm2.status = true
              WHERE m.local_date BETWEEN :fechaInicio AND :fechaFin
                AND m.status = true
                AND dm2.id IS NULL
                AND (:estacion IS NULL OR st.external_id = :estacion)
                AND (:tipo_medida IS NULL OR p.external_id = :tipo_medida)
              GROUP BY
                periodo,
                p.alias, p.name_en, p.icon, p.unit_measure,
                st.external_id, st.alias, st.name_en
              ORDER BY periodo;
            `;

            const [pre, raw] = await Promise.all([
                models.sequelize.query(sqlPre, {
                    replacements: { fechaInicio, fechaFin, estacion: estacionFinal, tipo_medida: tipoMedidaFinal },
                    type: models.sequelize.QueryTypes.SELECT
                }),
                models.sequelize.query(sqlRaw, {
                    replacements: { fechaInicio, fechaFin, estacion: estacionFinal, tipo_medida: tipoMedidaFinal },
                    type: models.sequelize.QueryTypes.SELECT
                })
            ]);

            const mapDaily = {};

            pre.forEach(r => {
                const dayKey = new Date(r.periodo).toISOString().slice(0, 10);
                const mapKey = `${dayKey}__${r.estacion}`;
                mapDaily[mapKey] ??= {
                    dia: dayKey,
                    estacion: r.estacion,
                    estacion_alias_es: r.estacion_alias_es,
                    estacion_alias_en: r.estacion_alias_en,
                    medidas: {}
                };

                const opMap = { 1: 'PROMEDIO', 2: 'MAX', 3: 'MIN', 4: 'SUMA' };
                const opName = opMap[r.op] || `OP${r.op}`;

                mapDaily[mapKey].medidas[r.tipo_medida] ??= {};
                mapDaily[mapKey].medidas[r.tipo_medida][opName] = parseFloat(r.valor);
                mapDaily[mapKey].medidas[r.tipo_medida].icon = r.variable_icon;
                mapDaily[mapKey].medidas[r.tipo_medida].unidad = r.unidad;
                mapDaily[mapKey].medidas[r.tipo_medida].alias_es = r.alias_es;
                mapDaily[mapKey].medidas[r.tipo_medida].alias_en = r.alias_en;
            });

            raw.forEach(r => {
                const dayKey = new Date(r.periodo).toISOString().slice(0, 10);
                const mapKey = `${dayKey}__${r.estacion}`;
                mapDaily[mapKey] ??= {
                    dia: dayKey,
                    estacion: r.estacion,
                    estacion_alias_es: r.estacion_alias_es,
                    estacion_alias_en: r.estacion_alias_en,
                    medidas: {}
                };

                const ops = {};
                if (r.promedio != null) ops.PROMEDIO = Math.round(r.promedio * 100) / 100;
                if (r.maximo != null) ops.MAX = parseFloat(r.maximo);
                if (r.minimo != null) ops.MIN = parseFloat(r.minimo);
                if (r.suma != null) ops.SUMA = parseFloat(r.suma);

                ops.icon = r.variable_icon;
                ops.unidad = r.unidad;
                ops.alias_es = r.alias_es;
                ops.alias_en = r.alias_en;

                mapDaily[mapKey].medidas[r.tipo_medida] = {
                    ...mapDaily[mapKey].medidas[r.tipo_medida],
                    ...ops
                };
            });

            return Object.values(mapDaily);
        }
    }

    /**
     * Migrate granular data to daily aggregates
     */
    async performDailyMigration() {
        const now = new Date();
        const thresholdDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - GRANULAR_WINDOW_DAYS
        );

        const last = await DailyMeasurement.findOne({
            where: { status: true },
            order: [['local_date', 'DESC']],
            attributes: ['local_date']
        });
        const desde = last ? new Date(last.local_date) : new Date(0);

        const agg = await models.sequelize.query(
            `
            SELECT
              date_trunc('day', m.local_date)::date AS day,
              m.id_station,
              m.id_phenomenon_type,
              AVG(q.quantity) AS promedio,
              MAX(q.quantity) AS maximo,
              MIN(q.quantity) AS minimo,
              SUM(q.quantity) AS suma
            FROM measurement m
            JOIN quantity q ON m.id_quantity = q.id
            WHERE m.local_date > :desde
              AND m.local_date < :threshold
              AND m.status = true
              AND q.status = true
            GROUP BY day, m.id_station, m.id_phenomenon_type
            ORDER BY day;
            `,
            {
                replacements: {
                    desde: desde.toISOString(),
                    threshold: thresholdDate.toISOString()
                },
                type: models.sequelize.QueryTypes.SELECT
            }
        );

        const opsList = await TypeOperation.findAll({
            attributes: ['id', 'operation'],
            where: { status: true }
        });
        const opMap = opsList.reduce((m, op) => {
            m[String(op.operation).toUpperCase()] = op.id;
            return m;
        }, {});

        const phenoms = await PhenomenonType.findAll({
            attributes: ['id'],
            where: { status: true },
            include: [{
                model: TypeOperation,
                as: 'type_operations',
                attributes: ['operation'],
                through: { attributes: [] }
            }]
        });
        const allowedOpsByPhen = new Map(
            phenoms.map(p => [
                p.id,
                new Set((p.type_operations || []).map(tp => String(tp.operation).toUpperCase()))
            ])
        );

        const opKeyToField = {
            PROMEDIO: 'promedio',
            MAX: 'maximo',
            MIN: 'minimo',
            SUMA: 'suma'
        };

        const inserts = [];
        for (const r of agg) {
            const allowed = allowedOpsByPhen.get(r.id_phenomenon_type) || new Set();

            ['PROMEDIO', 'MAX', 'MIN', 'SUMA'].forEach(opKey => {
                if (!allowed.has(opKey)) return;

                const field = opKeyToField[opKey];
                const valor = r[field];

                if (valor != null && opMap[opKey]) {
                    inserts.push({
                        local_date: r.day,
                        id_station: r.id_station,
                        id_phenomenon_type: r.id_phenomenon_type,
                        id_type_operation: opMap[opKey],
                        quantity: parseFloat(Number(valor).toFixed(2)),
                        external_id: uuidv4(),
                        status: true
                    });
                }
            });
        }

        if (inserts.length) {
            await DailyMeasurement.bulkCreate(inserts, {
                ignoreDuplicates: true
            });
        }

        return inserts.length;
    }

    /**
     * Delete old measurements
     */
    async cleanOldMeasurements() {
        const now = new Date();
        const cutoffDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - GRANULAR_WINDOW_DAYS
        );

        const deletedMeasurements = await Measurement.destroy({
            where: {
                local_date: { [Op.lt]: cutoffDate }
            }
        });

        const deletedQuantities = await Quantity.destroy({
            where: {
                id: {
                    [Op.notIn]: models.sequelize.literal(
                        '(SELECT DISTINCT id_quantity FROM measurement)'
                    )
                }
            }
        });

        return { deletedMeasurements, deletedQuantities };
    }
}

module.exports = new MeasurementService();
