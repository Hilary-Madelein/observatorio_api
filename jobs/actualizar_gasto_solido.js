/* jobs/actualizar_gs_por_estacion.js */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const models = require('../models');
const sequelize = models.sequelize;

const CUTOFF = '2025-10-16 23:59:59-05';
const PHEN_Q = 1; // CAUDAL
const PHEN_GS = 7; // GASTO SÓLIDO EN SUSPENSIÓN

(async () => {
    console.log('🔄 Actualizando quantity de GS = 17.3 * (Q^2) emparejando por FECHA (America/Guayaquil) + estación…');
    const t = await sequelize.transaction();
    try {
        const [rows] = await sequelize.query(
            `
      WITH q_day AS (
        SELECT
          q.id_station,
          (q.local_date AT TIME ZONE 'America/Guayaquil')::date AS d_cal,
          q.quantity,
          q.local_date,
          ROW_NUMBER() OVER (
            PARTITION BY q.id_station, (q.local_date AT TIME ZONE 'America/Guayaquil')::date
            ORDER BY q.local_date DESC
          ) AS rn
        FROM daily_measurement q
        WHERE q.id_phenomenon_type = :PHEN_Q
      ),
      gs_day AS (
        SELECT
          gs.id AS id_gs,
          gs.id_station,
          (gs.local_date AT TIME ZONE 'America/Guayaquil')::date AS d_cal
        FROM daily_measurement gs
        WHERE gs.id_phenomenon_type = :PHEN_GS
          AND gs.local_date <= :CUTOFF
      ),
      pares AS (
        SELECT g.id_gs, q.quantity
        FROM gs_day g
        JOIN q_day q
          ON q.id_station = g.id_station
          AND q.d_cal = g.d_cal
          AND q.rn = 1
      )
      UPDATE daily_measurement d
         SET quantity = 17.3 * (p.quantity * p.quantity)
      FROM pares p
      WHERE d.id = p.id_gs
      RETURNING d.id;
      `,
            {
                replacements: { PHEN_Q, PHEN_GS, CUTOFF },
                transaction: t,
            }
        );

        await t.commit();
        console.log(`✅ Filas actualizadas correctamente: ${rows.length}`);
        process.exit(0);
    } catch (err) {
        await t.rollback();
        console.error('❌ Error en la actualización:', err.message);
        process.exit(1);
    }
})();
