-- Migración: Añadir campo status a worker_assignments
-- Solo se ejecuta si la columna no existe

-- Agregar la columna status si no existe
ALTER TABLE worker_assignments ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'finished'));

-- Actualizar todas las asignaciones existentes a 'active'
UPDATE worker_assignments SET status = 'active' WHERE status IS NULL;
