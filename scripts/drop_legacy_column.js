'use strict';

const { sequelize } = require('../models');

async function dropColumn() {
    console.log('Dropping legacy id_microbasin column from station table...');

    try {
        // We use raw queries to ensure the column is dropped correctly
        // Check if column exists first (PostgreSQL)
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='station' AND column_name='id_microbasin';
        `);

        if (results.length > 0) {
            await sequelize.query('ALTER TABLE station DROP COLUMN id_microbasin CASCADE;');
            console.log('Column id_microbasin dropped successfully.');
        } else {
            console.log('Column id_microbasin does not exist or was already dropped.');
        }

    } catch (error) {
        console.error('Failed to drop legacy column:', error);
    } finally {
        await sequelize.close();
    }
}

dropColumn();
