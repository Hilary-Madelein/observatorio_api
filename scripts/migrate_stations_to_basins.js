'use strict';

const { sequelize, station, microbasin, station_microbasin } = require('../models');
const uuid = require('uuid');

async function migrate() {
    console.log('Starting migration of stations to join table...');

    try {
        // Ensure the join table is synced
        await station_microbasin.sync({ force: false });

        // Raw SQL for reliability (it uses the field names precisely)
        const [results] = await sequelize.query(`
            INSERT INTO station_microbasin (id_station, id_microbasin, external_id, status, created_at, updated_at)
            SELECT s.id, s.id_microbasin, gen_random_uuid(), true, NOW(), NOW()
            FROM station s
            WHERE s.id_microbasin IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM station_microbasin sm
                WHERE sm.id_station = s.id AND sm.id_microbasin = s.id_microbasin
            )
        `);

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
