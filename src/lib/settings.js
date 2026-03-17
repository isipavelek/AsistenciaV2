import { supabase } from './supabase.js';

let cachedSettings = null;

/**
 * Fetches global settings from the database and caches them.
 * @returns {Promise<Object>} The settings object.
 */
export async function getSettings() {
  if (cachedSettings) return cachedSettings;

  const { data, error } = await supabase
    .from('settings')
    .select('*');

  if (error) {
    console.error('Error fetching settings:', error);
    // Return default settings if DB fails
    return {
      school_location: { lat: -34.4578, lng: -58.9100, radius_meters: 100 },
      business_rules: { tolerance_minutes: 15, daily_hours: 7, max_late_justifications_month: 3 }
    };
  }

  // Convert array of [{key, value}] to object {key: value}
  const settingsObj = data.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  // Ensure mandatory keys exist with defaults if missing
  const currentYear = new Date().getFullYear();
  const finalSettings = {
    school_location: settingsObj.school_location || { lat: -34.4578, lng: -58.9100, radius_meters: 100 },
    attendance_period: settingsObj.attendance_period || { 
      start_date: `${currentYear}-03-01`, 
      end_date: `${currentYear}-12-20` 
    },
    business_rules: settingsObj.business_rules || { 
      tolerance_minutes: 15, 
      max_late_justifications_month: 3,
      hours_by_group: {
        'Servicios Generales': 7,
        'Administrativo': 6
      }
    }
  };

  cachedSettings = finalSettings;
  return finalSettings;
}

/**
 * Resolves the standard daily hours for a given user profile.
 * @param {Object} profile 
 * @param {Object} settings 
 * @returns {number}
 */
export function resolveStandardHours(profile, settings) {
  const rules = settings?.business_rules;
  if (!rules?.hours_by_group) return rules?.daily_hours || 7;
  
  const group = profile?.personnel_group || 'Administrativo';
  return rules.hours_by_group[group] || 6;
}

/**
 * Clears the settings cache to force a fresh fetch.
 */
export function clearSettingsCache() {
  cachedSettings = null;
}
