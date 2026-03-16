'use strict';

const models = require('../models');
const GRANULAR_WINDOW_DAYS = 3;

class DailyMeasurementService {

  async getMedicionesHistoricas(rango, estacion, fechaInicio, fechaFin, tipo_medida) {
    if (rango !== 'rangoFechas') {
      throw { message: 'Rango de tiempo inválido', code: 400 };
    }
    if (!fechaInicio || !fechaFin) {
      throw { message: 'Se requiere fechaInicio y fechaFin para rangoFechas', code: 400 };
    }

    const estacionFinal = (estacion === 'TODAS' || !estacion) ? null : estacion;
    const tipoMedidaFinal = (tipo_medida === 'TODAS' || !tipo_medida) ? null : tipo_medida;

    const inicio = fechaInicio.slice(0, 10);
    const fin = fechaFin.slice(0, 10);

    const now = new Date();
    const thresholdDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - GRANULAR_WINDOW_DAYS
    );
    const thresholdStr = thresholdDate.toISOString().slice(0, 10);

    const whereBaseDaily = `
        dm.status = true
        AND (:estacion IS NULL OR st.external_id = :estacion)
        AND (:tipo_medida IS NULL OR p.external_id = :tipo_medida)
        AND (
          p.alias NOT ILIKE '%TEMP%'
          OR dm.quantity <= 50
        )
      `;

    const whereBaseRaw = `
        m.status = true
        AND q.status = true
        AND (:estacion IS NULL OR st.external_id = :estacion)
        AND (:tipo_medida IS NULL OR p.external_id = :tipo_medida)
        AND (
          p.alias NOT ILIKE '%TEMP%'
          OR q.quantity <= 50
        )
      `;

    const sql = `
        WITH combined_data AS (
          -- Parte A: datos ya migrados a daily_measurement (antes del umbral)
          SELECT
            date_trunc('month', dm.local_date)::date AS periodo,
            p.alias              AS tipo_medida,
            p.alias             AS alias_es,
            p.name_en           AS alias_en,
            p.icon              AS variable_icon,
            p.unit_measure      AS unidad,
            st.external_id      AS estacion,
            st.alias            AS estacion_alias_es,
            st.name_en          AS estacion_alias_en,
            op.operation        AS operation,
            dm.quantity         AS quantity
          FROM daily_measurement dm
          JOIN phenomenon_type p ON p.id = dm.id_phenomenon_type AND p.status = true
          JOIN type_operation op ON dm.id_type_operation = op.id AND op.status = TRUE
          JOIN station st        ON st.id = dm.id_station          AND st.status = 'OPERATIVA'
          WHERE dm.local_date BETWEEN :fechaInicio::date AND :fechaFin::date
            AND dm.local_date < :threshold::date
            AND ${whereBaseDaily}

          UNION ALL

          -- Parte B: datos recientes aún no migrados (desde el umbral hasta fechaFin)
          SELECT
            date_trunc('month', m.local_date)::date AS periodo,
            p.alias              AS tipo_medida,
            p.alias             AS alias_es,
            p.name_en           AS alias_en,
            p.icon              AS variable_icon,
            p.unit_measure      AS unidad,
            st.external_id      AS estacion,
            st.alias            AS estacion_alias_es,
            st.name_en          AS estacion_alias_en,
            op.operation        AS operation,
            q.quantity          AS quantity
          FROM measurement m
          JOIN quantity q        ON q.id = m.id_quantity
          JOIN phenomenon_type p ON p.id = m.id_phenomenon_type AND p.status = true
          JOIN station st        ON st.id = m.id_station          AND st.status = 'OPERATIVA'
          LEFT JOIN phenomenon_operation po ON po.id_phenomenon_type = p.id
          LEFT JOIN type_operation op ON po.id_type_operation = op.id AND op.status = TRUE
          WHERE (m.local_date::date) BETWEEN GREATEST(:fechaInicio::date, :threshold::date) AND :fechaFin::date
            AND ${whereBaseRaw}
        )
        SELECT
          periodo,
          tipo_medida,
          alias_es,
          alias_en,
          variable_icon,
          unidad,
          estacion,
          estacion_alias_es,
          estacion_alias_en,
          AVG(quantity) FILTER (WHERE operation = 'PROMEDIO') AS promedio,
          MAX(quantity) FILTER (WHERE operation = 'MAX')      AS maximo,
          MIN(quantity) FILTER (WHERE operation = 'MIN')      AS minimo,
          SUM(quantity) FILTER (WHERE operation = 'SUMA')     AS suma
        FROM combined_data
        GROUP BY
          periodo,
          tipo_medida, alias_es, alias_en,
          variable_icon, unidad,
          estacion, estacion_alias_es, estacion_alias_en
        ORDER BY periodo, tipo_medida;
      `;

    const rows = await models.sequelize.query(sql, {
      replacements: {
        estacion: estacionFinal,
        tipo_medida: tipoMedidaFinal,
        fechaInicio: inicio,
        fechaFin: fin,
        threshold: thresholdStr
      },
      type: models.sequelize.QueryTypes.SELECT
    });

    const seriesMap = {};
    rows.forEach(r => {
      const periodoISO = new Date(r.periodo).toISOString();
      const key = `${r.estacion}__${periodoISO}`;

      if (!seriesMap[key]) {
        seriesMap[key] = {
          hora: periodoISO,
          estacion: r.estacion,
          estacion_alias_es: r.estacion_alias_es,
          estacion_alias_en: r.estacion_alias_en,
          medidas: {}
        };
      }

      const ops = {};
      if (r.promedio != null) ops.PROMEDIO = +parseFloat(r.promedio).toFixed(2);
      if (r.maximo != null) ops.MAX = +parseFloat(r.maximo).toFixed(2);
      if (r.minimo != null) ops.MIN = +parseFloat(r.minimo).toFixed(2);
      if (r.suma != null) ops.SUMA = +parseFloat(r.suma).toFixed(2);

      ops.icon = r.variable_icon;
      ops.unidad = r.unidad;
      ops.alias_es = r.alias_es;
      ops.alias_en = r.alias_en;

      seriesMap[key].medidas[r.tipo_medida] = ops;
    });

    return Object.values(seriesMap);
  }
}

module.exports = new DailyMeasurementService();
