-- Script para insertar datos de prueba
-- Paciente UUID: 0f6a7041-20e2-4d98-86a0-38ea264594e4

-- Primero, crear el paciente si no existe
INSERT INTO public.pacientes (
  id,
  nombre,
  apellido,
  dni,
  fecha_nacimiento,
  sexo,
  direccion,
  telefono,
  email,
  obra_social,
  numero_afiliado,
  contacto_emergencia_nombre,
  contacto_emergencia_telefono
) VALUES (
  '0f6a7041-20e2-4d98-86a0-38ea264594e4',
  'Paciente',
  'Test',
  '12345678',
  '1990-01-15',
  'Masculino',
  'Calle Principal 123',
  '1234567890',
  'paciente@example.com',
  'OSDE',
  'AF123456',
  'Contacto Test',
  '1123456789'
) ON CONFLICT (id) DO NOTHING;

-- Crear turno de prueba
INSERT INTO public.turnos (
  paciente_id,
  nombre,
  email,
  telefono,
  motivo,
  fecha_preferida,
  hora_preferida,
  estado,
  obra_social,
  es_particular
) VALUES (
  '0f6a7041-20e2-4d98-86a0-38ea264594e4',
  'Paciente Test',
  'paciente@example.com',
  '1234567890',
  'Consulta general - Revisión',
  '2026-09-05',
  '14:00',
  'confirmado',
  'OSDE',
  false
);

-- Crear consulta de prueba
INSERT INTO public.consultas (
  paciente_id,
  profesional_id,
  fecha,
  motivo_consulta,
  examen_fisico,
  observaciones
) VALUES (
  '0f6a7041-20e2-4d98-86a0-38ea264594e4',
  NULL,
  '2026-09-04',
  'Paciente acude por dolor de cabeza recurrente',
  'Presión arterial normal, sin signos de alarma',
  'Se sugiere seguimiento en una semana'
);

-- Crear segunda consulta
INSERT INTO public.consultas (
  paciente_id,
  profesional_id,
  fecha,
  motivo_consulta,
  examen_fisico,
  observaciones
) VALUES (
  '0f6a7041-20e2-4d98-86a0-38ea264594e4',
  NULL,
  '2026-08-28',
  'Control rutinario de salud',
  'Todos los parámetros dentro de los rangos normales',
  'Paciente en buen estado general'
);
