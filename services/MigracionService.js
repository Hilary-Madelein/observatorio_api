'use strict';

// Cargamos vars de entorno
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { CosmosClient } = require('@azure/cosmos');
const Sequelize = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const models = require('../models');

const VALOR_UMBRAL = 1e6;

const quitarAcentos = (s = '') =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normKey = (s = '') =>
    quitarAcentos(String(s))
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[()/_-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

// Sinónimos por contenedor → clave normalizada → nombre interno canónico
const synonymsByContainer = {
    PUEAR: new Map([
        // Caudal
        [normKey('Caudal (Q)'), 'CAUDAL_Q'],
        [normKey('Caudal (L/s)'), 'CAUDAL_Q'],
        [normKey('Caudal (L/S)'), 'CAUDAL_Q'],
        [normKey('Caudal(L/s)'), 'CAUDAL_Q'],
        [normKey('Caudal'), 'CAUDAL_Q'],

        // Sólidos en suspensión
        [normKey('Solidos_Suspendidos_GS'), 'SOLIDOS_SUSPENDIDOS_GS'],
        [normKey('Solidos_Suspendidos_GS (mg/s)'), 'SOLIDOS_SUSPENDIDOS_GS'],
        [normKey('Solidos_Suspendidos_GS (SST/s)'), 'SOLIDOS_SUSPENDIDOS_GS'],
        [normKey('Sólidos_Suspendidos_GS (mg/s)'), 'SOLIDOS_SUSPENDIDOS_GS'],
        [normKey('Solidos Suspendidos GS'), 'SOLIDOS_SUSPENDIDOS_GS'],
        [normKey('SST'), 'SOLIDOS_SUSPENDIDOS_GS'],
    ])
};

const THRESHOLDS = {
    SOLIDOS_SUSPENDIDOS_GS: { min: 0, max: 10000 }, // mg/s
    CAUDAL_Q: { min: 0, max: 60 },     // L/s
};

// Variables exentas del filtrado de anomalías
const EXEMPT_FENS = new Set([
    'NIVEL_DE_AGUA',
    'RADIATION'
]);

// Mapeo de campos por contenedor
const medidaMapeo = {
    EHA: {
        Carga_H: 'CARGA_H',
        Distancia_Hs: 'DISTANCIA_HS',
        Nivel_de_agua: 'NIVEL_DE_AGUA'
    },
    PUEAR: {
        // eui-… datos hidrologicos
        Carga_H: 'CARGA_H',
        'Caudal (Q)': 'CAUDAL_Q',
        'Caudal (L/s)': 'CAUDAL_Q',
        Distancia_Hs: 'DISTANCIA_HS',
        Nivel_de_agua: 'NIVEL_DE_AGUA',
        'Solidos_Suspendidos_GS': 'SOLIDOS_SUSPENDIDOS_GS',
        'Solidos_Suspendidos_GS (mg/s)': 'SOLIDOS_SUSPENDIDOS_GS',
        'Solidos_Suspendidos_GS (SST/s)': 'SOLIDOS_SUSPENDIDOS_GS',

        // mark4 datos meteorologicos
        temperature: 'TEMPERATURE',
        humidity: 'HUMIDITY',
        radiation: 'RADIATION',
        rain: 'RAIN'
    }
};

// Normalización para lookup en phenomenon_type
const normalizacionNombres = {
    'CARGA_H': 'CARGA_H',
    'DISTANCIA_HS': 'DISTANCIA_HS',
    'NIVEL_DE_AGUA': 'NIVEL_DE_AGUA',
    'CAUDAL_Q': 'CAUDAL (L/S)',
    'SOLIDOS_SUSPENDIDOS_GS': 'SOLIDOS_SUSPENDIDOS_GS (MG/S)',
    'TEMPERATURE': 'TEMPERATURE',
    'HUMIDITY': 'HUMIDITY',
    'RADIATION': 'RADIATION',
    'RAIN': 'RAIN'
};

function resolveFenomeno(contenedor, campo) {
    const directo = medidaMapeo[contenedor]?.[campo];
    if (directo) return directo;

    const key = normKey(campo);
    const synMap = synonymsByContainer[contenedor];
    if (synMap && synMap.has(key)) return synMap.get(key);

    return null;
}

function isWithinCustomBounds(nombreFen, valor) {
    const th = THRESHOLDS[nombreFen];
    if (!th) return true;
    if (typeof th.min === 'number' && valor < th.min) return false;
    if (typeof th.max === 'number' && valor > th.max) return false;
    return true;
}

class MigracionService {
    constructor() {
        const endpoint = process.env.COSMOS_ENDPOINT;
        const key = process.env.COSMOS_KEY;
        const dbEhaId = process.env.COSMOS_DB_EHA;
        const dbPuearId = process.env.COSMOS_DB_PUEAR;

        if (!dbEhaId || !dbPuearId) {
            // Warn instead of throw to avoid crashing app on startup if env vars missing during dev
            console.warn('Falta definir COSMOS_DB_EHA o COSMOS_DB_PUEAR en .env. MigracionService no funcionará correctamente.');
            return;
        }

        const client = new CosmosClient({ endpoint, key });
        this.dbEha = client.database(dbEhaId);
        this.dbPuear = client.database(dbPuearId);
    }

    esValorValido(valor) {
        return valor != null && !isNaN(valor) && Math.abs(valor) < VALOR_UMBRAL;
    }

    async generarFechasParaMigrar() {
        const desde = new Date('2024-01-01');
        const hasta = new Date();
        hasta.setHours(0, 0, 0, 0);

        const fechas = [];
        for (let d = new Date(desde); d < hasta; d.setDate(d.getDate() + 1)) {
            fechas.push(d.toISOString().slice(0, 10));
        }
        return fechas;
    }

    async obtenerDatosCosmosConFiltro(container, fecha, campoFecha) {
        const propiedad = campoFecha.includes('-')
            ? `c['${campoFecha}']`
            : `c.${campoFecha}`;

        const querySpec = {
            query: `SELECT * FROM c WHERE STARTSWITH(${propiedad}, @fecha)`,
            parameters: [{ name: '@fecha', value: fecha }]
        };

        try {
            const { resources } = await container.items.query(querySpec).fetchAll();
            return resources;
        } catch (err) {
            console.error(`Error en ${container.id} [${campoFecha}]:`, err.message);
            return [];
        }
    }

    agruparPorEstacionYMedida(items, mapeo, contenedor) {
        const estaciones = {};

        for (const item of items) {
            const deviceId = item.dispositivo || item.deviceId;
            if (!deviceId) continue;

            const data = item.datos || item;
            for (const [campo, rawVal] of Object.entries(data)) {
                const nombreFen = resolveFenomeno(contenedor, campo) || mapeo[campo];
                if (!nombreFen) continue;

                let valor = Number(rawVal);
                if (isNaN(valor)) continue;

                // Si es nivel de agua, le sumamos 2200
                if (nombreFen === 'NIVEL_DE_AGUA') {
                    valor += 2200;
                }

                // Filtrado de anomalías salvo en variables exentas
                if (!isWithinCustomBounds(nombreFen, valor)) {
                    continue;
                }

                if (!EXEMPT_FENS.has(nombreFen) && !this.esValorValido(valor)) {
                    continue;
                }

                estaciones[deviceId] ||= {};
                estaciones[deviceId][nombreFen] ||= [];
                estaciones[deviceId][nombreFen].push(valor);
            }
        }

        return estaciones;
    }

    async procesarMigracion(estaciones, fecha) {
        for (const [deviceId, fenomenos] of Object.entries(estaciones)) {
            const estacion = await models.station.findOne({ where: { id_device: deviceId } });
            if (!estacion) {
                console.warn(`Station ${deviceId} no encontrada`);
                continue;
            }

            for (const [nombreFen, valores] of Object.entries(fenomenos)) {
                const norm = normalizacionNombres[nombreFen.toUpperCase()];
                if (!norm) continue;

                const fenomeno = await models.phenomenon_type.findOne({
                    where: Sequelize.where(
                        Sequelize.fn('UPPER', Sequelize.col('name')),
                        Sequelize.fn('UPPER', norm)
                    )
                });
                if (!fenomeno) continue;

                for (const oper of fenomeno.operations) {
                    const tipoOp = await models.type_operation.findOne({ where: { operation: oper } });
                    if (!tipoOp) continue;

                    let resultado;
                    switch (oper) {
                        case 'PROMEDIO':
                            resultado = valores.reduce((a, b) => a + b, 0) / valores.length;
                            break;
                        case 'MAX':
                            resultado = Math.max(...valores);
                            break;
                        case 'MIN':
                            resultado = Math.min(...valores);
                            break;
                        case 'SUMA':
                            resultado = valores.reduce((a, b) => a + b, 0);
                            break;
                        default:
                            continue;
                    }

                    // Exentar anomalías en ciertos fenómenos
                    if (!EXEMPT_FENS.has(nombreFen) && !this.esValorValido(resultado)) {
                        continue;
                    }

                    if (!isWithinCustomBounds(nombreFen, resultado)) {
                        continue;
                    }

                    await models.daily_measurement.create({
                        local_date: new Date(`${fecha}T00:00:00Z`),
                        quantity: Number(resultado.toFixed(2)),
                        external_id: uuidv4(),
                        status: true,
                        id_station: estacion.id,
                        id_phenomenon_type: fenomeno.id,
                        id_type_operation: tipoOp.id
                    });
                }
            }
        }
    }

    async migrar() {
        if (!this.dbEha || !this.dbPuear) {
            throw new Error('Servicio de migración no inicializado correctamente (faltan credenciales)');
        }
        console.log('🔄 Iniciando migración desde Azure Cosmos DB...');
        const fechas = await this.generarFechasParaMigrar();
        const fuentes = [
            { db: this.dbEha, contenedores: ['EHA'], campoFecha: 'Fecha_local_UTC-5' },
            { db: this.dbPuear, contenedores: ['PUEAR'], campoFecha: 'fecha_recepcion' }
        ];

        for (const fecha of fechas) {
            for (const { db, contenedores, campoFecha } of fuentes) {
                for (const contenedor of contenedores) {
                    console.log(`🔄 Migrando ${contenedor} para ${fecha}`);
                    const container = db.container(contenedor);
                    const items = await this.obtenerDatosCosmosConFiltro(container, fecha, campoFecha);
                    console.log(`📥 ${items.length} docs en ${contenedor}`);

                    const agrupado = this.agruparPorEstacionYMedida(items, medidaMapeo[contenedor] || {}, contenedor);
                    await this.procesarMigracion(agrupado, fecha);
                }
            }
        }
    }
}

module.exports = new MigracionService();
