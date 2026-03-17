-- Database Schema for Personal Attendance System

-- 1. Profiles Table (Extends Supabase Auth)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    birth_date DATE,
    legajo_utn TEXT UNIQUE,
    address TEXT,
    role TEXT CHECK (role IN ('user', 'director', 'vicedirector', 'rrhh')) DEFAULT 'user',
    personnel_group TEXT CHECK (personnel_group IN ('Administrativo', 'Servicios Generales')),
    category TEXT, -- e.g., 'Jefe de Preceptores', 'Mantenimiento'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Attendance Table
CREATE TABLE attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    lat DOUBLE PRECISION,
    long DOUBLE PRECISION,
    is_late BOOLEAN DEFAULT FALSE,
    is_compensated BOOLEAN DEFAULT FALSE,
    compensation_minutes INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('present', 'late', 'absent', 'justified')) DEFAULT 'present',
    is_justified BOOLEAN DEFAULT FALSE,
    justification_note TEXT,
    document_path TEXT,
    justified_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Authorizations Table
CREATE TABLE authorizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'medical', 'half-day', 'exceptional-departure', 'marriage', etc.
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE, -- nullable for single day/event
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approved_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Holidays Table
CREATE TABLE holidays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('feriado', 'asueto', 'paro')) DEFAULT 'feriado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS for Holidays
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read holidays" ON holidays FOR SELECT USING (TRUE);
CREATE POLICY "Admins can edit holidays" ON holidays FOR ALL USING (is_admin());

-- 4. Settings Table
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS for Settings (moved from below for clarity)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON settings FOR SELECT USING (TRUE);
CREATE POLICY "Admins can edit settings" ON settings FOR ALL USING (is_admin());

-- Initial Settings
INSERT INTO settings (key, value) VALUES 
('school_location', '{"lat": -34.4578, "lng": -58.9100, "radius_meters": 100}'),
('business_rules', '{"tolerance_minutes": 15, "daily_hours": 7, "max_late_justifications_month": 3}'),
('convention_limits', '{
    "Ausente con aviso": {"month": 2, "year": 10},
    "Atención Familiar": {"month": 3, "year": 15},
    "Salida Excepcional": {"month": 2, "year": 12},
    "Media Jornada": {"month": 1, "year": 6}
}');

-- RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin (breaks recursion in RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (role IN ('director', 'vicedirector', 'rrhh'))
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users can view/edit their own, Admins (Director/RRHH) can view/edit all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can edit own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Admins can edit all profiles" ON profiles FOR ALL USING (is_admin());

-- Attendance: Users can view/create own, Admins can view all
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own attendance" ON attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all attendance" ON attendance FOR SELECT USING (is_admin());

-- Authorizations: Users can view/create own, Director/Vicedirector can approve
CREATE POLICY "Users can view own authorizations" ON authorizations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own authorizations" ON authorizations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Approvers can view/edit all authorizations" ON authorizations FOR ALL USING (is_admin());

-- Settings: Only Admins can edit, everyone can read
CREATE POLICY "Anyone can read settings" ON settings FOR SELECT USING (TRUE);
CREATE POLICY "Admins can edit settings" ON settings FOR ALL USING (is_admin());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_authorizations_updated_at BEFORE UPDATE ON authorizations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name, 
    email, 
    role, 
    legajo_utn, 
    personnel_group, 
    category
  )
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''), 
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''), 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NEW.raw_user_meta_data->>'legajo_utn',
    NEW.raw_user_meta_data->>'personnel_group',
    NEW.raw_user_meta_data->>'category'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- 6. Daily Reports Tables
CREATE TABLE daily_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    created_by UUID REFERENCES profiles(id),
    status TEXT CHECK (status IN ('draft', 'final')) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE daily_report_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    novelty TEXT,
    is_authorized BOOLEAN DEFAULT FALSE,
    observation TEXT,
    UNIQUE(report_id, user_id)
);

-- RLS for Daily Reports
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view/edit daily reports" ON daily_reports FOR ALL USING (is_admin());
CREATE POLICY "Admins can view/edit daily report items" ON daily_report_items FOR ALL USING (is_admin());
-- 7. User Schedules Table
CREATE TABLE user_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    UNIQUE(user_id, day_of_week)
);

ALTER TABLE user_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can edit all schedules" ON user_schedules FOR ALL USING (is_admin());
CREATE POLICY "Users can view own schedule" ON user_schedules FOR SELECT USING (auth.uid() = user_id);
