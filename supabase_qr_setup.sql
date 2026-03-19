-- Script SQL para la función de Fichaje con QR
-- Ejecutar este código en el SQL Editor de Supabase

-- 1. Crear tabla para almacenar los tokens efímeros
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurarse de que el RLS esté habilitado y permita inserts (ya que el ESP8266 hará insert mediante anon key)
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir insertar qr_tokens anonimamente" ON public.qr_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Permitir leer qr_tokens" ON public.qr_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir eliminar qr_tokens" ON public.qr_tokens FOR DELETE TO authenticated USING (true);


-- 2. Crear Función RPC para validar y registrar asistencia "atomicamente"
CREATE OR REPLACE FUNCTION registrar_fichaje_qr(p_user_id UUID, p_token TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token_record RECORD;
    v_age_seconds INT;
    v_is_late BOOLEAN;
    v_entry_status TEXT;
    v_day_of_week INT;
    v_schedule RECORD;
    v_tolerance INT := 15; -- Minutos de tolerancia
    v_standard_entry TIME := '08:00:00'::TIME;
BEGIN
    -- Verificar si el token existe
    SELECT * INTO v_token_record FROM public.qr_tokens WHERE token = p_token LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN json_build_object('exito', false, 'mensaje', 'QR inválido o no reconocido.');
    END IF;

    -- Calcular edad del token en segundos
    v_age_seconds := EXTRACT(EPOCH FROM (NOW() - v_token_record.created_at));

    -- Si el token es más viejo que 15 segundos, está expirado
    IF v_age_seconds > 15 THEN
        -- Eliminar el token viejo por limpieza
        DELETE FROM public.qr_tokens WHERE id = v_token_record.id;
        RETURN json_build_object('exito', false, 'mensaje', 'El código QR ha expirado. Lee el nuevo código de la pantalla.');
    END IF;

    -- Validado correctamente, proceder a registrar asistencia
    v_day_of_week := EXTRACT(ISODOW FROM NOW());

    -- Buscar horario del usuario
    SELECT * INTO v_schedule FROM public.user_schedules WHERE user_id = p_user_id AND day_of_week = v_day_of_week LIMIT 1;

    IF FOUND THEN
        v_is_late := NOW()::time > (v_schedule.start_time + make_interval(mins => v_tolerance));
    ELSE
        v_is_late := NOW()::time > (v_standard_entry + make_interval(mins => v_tolerance));
    END IF;

    IF v_is_late THEN
        v_entry_status := 'late';
    ELSE
        v_entry_status := 'present';
    END IF;

    -- Insertar el registro (sin ubicación manual, o con ubicación especial 'QR')
    INSERT INTO public.attendance (user_id, check_in, is_late, status, mood_note)
    VALUES (p_user_id, NOW(), v_is_late, v_entry_status, 'Fichaje vía QR Local');

    -- Eliminar el token para que no pueda usarse dos veces
    DELETE FROM public.qr_tokens WHERE id = v_token_record.id;

    RETURN json_build_object('exito', true, 'mensaje', 'Asistencia registrada correctamente.');
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('exito', false, 'mensaje', SQLERRM);
END;
$$;
