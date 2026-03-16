'use strict';

require('dotenv').config();
const mqtt = require('mqtt');
const { broker } = require('../models');
const StationController = require('../controllers/StationController');
const stationController = new StationController();
const MeasurementController = require('../controllers/MeasurementController');
const measurementController = new MeasurementController();
const EncryptionUtil = require('../utils/EncryptionUtil');

const DESPLAZAMIENTO_HORARIO_MINUTOS = -300;

function ajustarZonaHoraria(timestamp) {
    const date = new Date(timestamp);
    date.setMinutes(date.getMinutes() + DESPLAZAMIENTO_HORARIO_MINUTOS);
    return date.toISOString();
}

class MqttService {
    constructor() {
        this.topicTemplate = process.env.TTN_TOPIC_TEMPLATE; // 'v3/{user}/devices/{id}/up'
        this.server = process.env.TTN_SERVER;
        this.clients = {};
        this.REFRESH_MS = 12 * 60 * 1000;

        if (!this.topicTemplate || !this.server) {
            console.error('Falta TTN_TOPIC_TEMPLATE o TTN_SERVER en tu .env');
        }
    }

    async start() {
        if (!this.topicTemplate || !this.server) return;
        console.log('[MqttService] Iniciando servicio...');
        await this.reloadBrokers();
    }

    async reloadBrokers() {
        try {
            console.log('[MqttService] Recargando brokers desde BD...');
            const activeBrokers = await broker.findAll({ where: { status: true } });

            // ── DIAGNÓSTICO ───────────────────────────────────────────────────
            console.log(`[MqttService] Brokers activos en BD: ${activeBrokers.length}`);
            activeBrokers.forEach(b => {
                console.log(`  → [${b.name}] username="${b.username}"  external_id="${b.external_id}"`);
            });
            console.log(`[MqttService] Clientes actualmente conectados: ${Object.keys(this.clients).join(', ') || '(ninguno)'}`);
            // ─────────────────────────────────────────────────────────────────

            const activeIds = new Set(activeBrokers.map(b => b.external_id));

            Object.keys(this.clients).forEach(existingId => {
                if (!activeIds.has(existingId)) {
                    console.log(`[${existingId}] Desconectando broker (inactivo o eliminado)...`);
                    const { client } = this.clients[existingId];
                    if (client) client.end();
                    delete this.clients[existingId];
                } else {
                    const { client } = this.clients[existingId];
                    const newConfig = activeBrokers.find(b => b.external_id === existingId);

                    const currentDecryptedPass = EncryptionUtil.decrypt(newConfig.password);

                    if (this.clients[existingId].user !== newConfig.username || this.clients[existingId].pass !== currentDecryptedPass) {
                        console.log(`[${existingId}] Credenciales cambiadas, reconectando...`);
                        client.end();
                        delete this.clients[existingId];
                    }
                }
            });

            for (const b of activeBrokers) {
                if (!this.clients[b.external_id]) {
                    console.log(`[MqttService] → Intentando conectar nuevo broker: "${b.name}" (${b.username})`);
                    this.connectBroker(b);
                } else {
                    console.log(`[MqttService] → Broker ya conectado: "${b.name}" (${b.username}). Actualizando suscripciones...`);
                    if (typeof this.clients[b.external_id].updateSubscriptions === 'function') {
                        this.clients[b.external_id].updateSubscriptions();
                    }
                }
            }

        } catch (error) {
            console.error('[MqttService] Error recargando brokers:', error);
        }
    }

    connectBroker(brokerConfig) {
        const { external_id, name, username, password } = brokerConfig;

        let decryptedPassword;
        try {
            decryptedPassword = EncryptionUtil.decrypt(password);
        } catch (e) {
            console.error(`[${name}] ERROR al descifrar contraseña:`, e.message);
            return;
        }

        console.log(`[${name}] Conectando a ${this.server} con usuario="${username}"...`);

        const client = mqtt.connect(this.server, {
            username: username,
            password: decryptedPassword,
            keepalive: 60,
            reconnectPeriod: 2000,
            connectTimeout: 30_000,
            clean: true
        });

        let currentSubs = new Set();
        const updateSubscriptions = async () => {
            try {
                if (!client.connected) {
                    console.log(`[${name}] updateSubscriptions: cliente no conectado todavía, omitiendo.`);
                    return;
                }

                let estaciones;
                const fakeReq = { user: username };
                const fakeRes = {
                    json: body => { estaciones = body.info; },
                    status: () => ({ json: err => { throw new Error(err.msg); } })
                };

                await stationController.listActiveMQTT(fakeReq, fakeRes);

                // ── DIAGNÓSTICO ───────────────────────────────────────────────
                console.log(`[${name}] Estaciones activas (OPERATIVAS/MANTENIMIENTO) con app_user="${username}": ${estaciones ? estaciones.length : 0}`);
                if (estaciones && estaciones.length > 0) {
                    estaciones.forEach(e => console.log(`  → id_device="${e.id_device}"  app_user="${e.app_user}"`));
                } else {
                    console.warn(`[${name}] Sin estaciones para suscribir. Verifica que las estaciones tengan app_user="${username}" y estado OPERATIVA o MANTENIMIENTO.`);
                }
                // ─────────────────────────────────────────────────────────────

                if (!estaciones) return;

                const newIds = new Set(estaciones.map(e => e.id_device));

                // Subscribe new
                for (const id_device of newIds) {
                    if (!currentSubs.has(id_device)) {
                        const topic = this.topicTemplate
                            .replace('{user}', username)
                            .replace('{id}', id_device);

                        client.subscribe(topic, err => {
                            if (err) console.error(`[${name}] Error suscribiendo ${topic}:`, err.message);
                            else console.log(`[${name}] Suscrito a ${topic}`);
                        });
                    }
                }

                // Unsubscribe old
                for (const oldId of currentSubs) {
                    if (!newIds.has(oldId)) {
                        const topic = this.topicTemplate
                            .replace('{user}', username)
                            .replace('{id}', oldId);

                        client.unsubscribe(topic, err => {
                            if (err) console.error(`[${name}] Error desuscribiendo ${topic}:`, err.message);
                            else console.log(`[${name}] Desuscrito de ${topic}`);
                        });
                    }
                }

                currentSubs = newIds;

            } catch (err) {
                console.error(`[${name}] Error en updateSubscriptions():`, err.message);
            }
        };

        this.clients[external_id] = { client, user: username, pass: decryptedPassword, name, updateSubscriptions };

        client.on('connect', () => {
            console.log(`[${name}] Conectado exitosamente.`);
            updateSubscriptions();
            const interval = setInterval(() => {
                if (!client.connected) {
                    clearInterval(interval);
                    return;
                }
                updateSubscriptions();
            }, this.REFRESH_MS);
        });

        client.on('reconnect', () => console.log(`[${name}] Reintentando conexión...`));
        client.on('offline', () => console.log(`[${name}] Cliente offline`));
        client.on('error', err => console.error(`[${name}] Error MQTT:`, err.message));
        client.on('end', () => console.log(`[${name}] Conexión finalizada`));

        client.on('message', async (receivedTopic, message) => {
            try {
                // ── RAW MESSAGE FROM TTN ──────────────────────────────────────
                console.log(`\n[TTN RAW] Topic   : ${receivedTopic}`);
                console.log(`[TTN RAW] Payload  : ${message.toString()}`);
                console.log(`[TTN RAW] Parsed   :`, JSON.parse(message.toString()));
                console.log(`[TTN RAW] ──────────────────────────────────────────\n`);
                // ─────────────────────────────────────────────────────────────

                const parts = receivedTopic.split('/');
                const deviceId = parts[3];

                if (!currentSubs.has(deviceId)) return;

                const data = JSON.parse(message.toString());
                if (data.received_at) data.received_at = ajustarZonaHoraria(data.received_at);

                const entrada = {
                    fecha: data.received_at,
                    dispositivo: deviceId,
                    payload: data.uplink_message?.decoded_payload
                };

                console.log(`[${name}] Datos de ${deviceId}:`, entrada);

                const req = { body: entrada };
                const res = {
                    status: code => ({
                        json: response => {
                            if (code !== 200) console.error(`[${name}][${code}]`, response);
                            else console.log(`[${name}] Guardado exitoso`, response);
                        }
                    })
                };

                await measurementController.saveFromTTN(req, res);

            } catch (err) {
                console.error(`[${name}] Error procesando mensaje:`, err.message);
            }
        });
    }
}

module.exports = new MqttService();
