-- Script SQL para solucionar el error de permisos RLS en el Fichaje de Salida
-- Ejecutar este código en el SQL Editor de Supabase y presionar "Run"

-- 1. Eliminar políticas previas para evitar conflictos o duplicados
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can create own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can view, edit and delete all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins can insert all attendance" ON public.attendance;

-- 2. Asegurarse de que el RLS esté completamente habilitado en la tabla
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 3. Crear política de Lectura (Permite a cada empleado ver su propio historial)
CREATE POLICY "Users can view own attendance" 
ON public.attendance 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Crear política de Entrada (Permite a cada empleado crear su ficha de entrada)
CREATE POLICY "Users can create own attendance" 
ON public.attendance 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 5. Crear política de Salida / Comentarios (Permite a cada empleado actualizar su propia ficha de salida)
CREATE POLICY "Users can update own attendance" 
ON public.attendance 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 6. Crear políticas de Administrador (Director, Vicedirector y RRHH)
CREATE POLICY "Admins can view, edit and delete all attendance" 
ON public.attendance 
FOR ALL 
TO authenticated 
USING (is_admin());

CREATE POLICY "Admins can insert all attendance" 
ON public.attendance 
FOR INSERT 
TO authenticated 
WITH CHECK (is_admin());
