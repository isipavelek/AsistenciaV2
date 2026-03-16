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

-- 4. Settings Table (Global Config)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Initial Settings
INSERT INTO settings (key, value) VALUES 
('school_location', '{"lat": -34.4578, "lng": -58.9100, "radius_meters": 100}'), -- Approximate for Rafael 50, Pilar
('business_rules', '{"tolerance_minutes": 15, "daily_hours": 7, "max_late_justifications_month": 3}');

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
