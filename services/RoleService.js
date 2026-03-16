'use strict';

const models = require('../models');
const Role = models.role;
const uuid = require('uuid');

class RoleService {

    async list() {
        const roles = await Role.findAll({
            where: { status: true },
            attributes: ['name', 'external_id']
        });
        return roles;
    }

    async createDefaultRoles() {
        const defaultRoles = ['ADMINISTRADOR', 'INVESTIGADOR'];
        const results = [];

        for (const roleName of defaultRoles) {
            const exists = await Role.findOne({ where: { name: roleName } });
            if (!exists) {
                const newRole = await Role.create({
                    name: roleName,
                    external_id: uuid.v4(),
                    status: true
                });
                results.push(`Rol creado: ${roleName}`);
            } else {
                results.push(`Rol ya existe: ${roleName}`);
            }
        }
        return results;
    }

    async getByName(name) {
        return await Role.findOne({
            where: { name, status: true }
        });
    }

    async getByExternalId(external_id) {
        return await Role.findOne({
            where: { external_id, status: true }
        });
    }
}

module.exports = new RoleService();
