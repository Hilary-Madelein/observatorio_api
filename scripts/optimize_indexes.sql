-- =============================================================
-- Script de optimización MÍNIMA de índices
-- Solo lo que no está cubierto por índices existentes
--
-- ESTADO ACTUAL DE LA BD:
--   measurement:       idx_measurement_station_date (id_station, local_date)
--   daily_measurement: idx_daily_measurement_station_date (id_station, local_date)
--                      uq_daily_measurement_station_date_pheno_op UNIQUE
--                        (id_station, local_date, id_phenomenon_type, id_type_operation)
--
-- NOTA: El UNIQUE constraint de daily_measurement ya cubre la mayoría
-- de queries (Postgres puede usar cualquier prefijo izquierdo del índice).
-- NO se añaden índices redundantes a daily_measurement.
-- =============================================================

-- -----------------------------------------------
-- TABLA: measurement  (alto volumen de escritura)
-- Solo UN índice nuevo: para getLatestMeasurements (DISTINCT ON por fenómeno)
-- El índice existente (id_station, local_date) ya cubre getTimeSeries por estación.
-- -----------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_measurement_phenom_station_date
  ON measurement (id_phenomenon_type, id_station, local_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_measurement_station_pheno_date
    ON measurement (id_station, id_phenomenon_type, local_date DESC);

-- -----------------------------------------------
-- TABLA: phenomenon_type  (tabla pequeña, muy pocas escrituras)
-- Acelera el JOIN AND p.status = true en todos los servicios
-- -----------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_phenomenon_type_status
  ON phenomenon_type (status);

-- -----------------------------------------------
-- VERIFICACIÓN
-- -----------------------------------------------
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('measurement', 'daily_measurement', 'phenomenon_type')
ORDER BY tablename, indexname;
