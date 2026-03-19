-- Comprobar si RLS está habilitado y si hay políticas para anon
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename = 'qr_tokens';

-- Ver las políticas actuales
SELECT * FROM pg_policies WHERE tablename = 'qr_tokens';

-- Si no hay política de INSERT para anon, esta es la solución:
-- ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir insertar tokens a todos" ON public.qr_tokens FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY "Permitir leer tokens a todos" ON public.qr_tokens FOR SELECT TO authenticated, anon USING (true);
-- CREATE POLICY "Permitir borrar tokens a todos" ON public.qr_tokens FOR DELETE TO authenticated, anon USING (true);
