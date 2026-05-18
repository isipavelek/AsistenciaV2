import { supabase } from './supabase.js';

export function normalizeAuthType(type) {
  if (!type) return '';
  if (type === 'Razones Particulares (Art. 85)') return 'Ausente con aviso';
  if (type === 'Media Jornada (Art. 87)') return 'Media Jornada';
  if (type === 'Atención Familiar (Art. 75/76)' || type === 'Atención Familiar') return 'Atención de familiar enfermo';
  if (type === 'Examen (Estudio)') return 'Examen';
  if (type === 'Médico - Corto Tratamiento') return 'Enfermedad de corto tratamiento';
  return type;
}

/**
 * Statistics Engine for Attendance and Convention Limits
 */

/**
 * Calculates detailed stats for a user
 */
export async function getUserStats(userId, year = new Date().getFullYear(), month = null) {
  // 1. Fetch attendance records for the period
  let startDate, endDate;
  if (month !== null) {
    startDate = new Date(year, month, 1).toISOString().split('T')[0];
    endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId)
    .gte('check_in', `${startDate}T00:00:00.000Z`)
    .lte('check_in', `${endDate}T23:59:59.999Z`)
    .order('check_in', { ascending: false });

  if (attError) throw attError;

  // 1b. Fetch Holidays for the period
  const { data: holidays } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);
  
  const holidayMap = new Map(holidays?.map(h => [h.date, h]) || []);

  // 1c. Fetch User Schedules
  const { data: schedules } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('user_id', userId);

  const activeDaysOfWeek = new Set(schedules?.map(s => s.day_of_week) || []);

  // 2. Fetch authorizations (licencias) for the entire year to calculate accurate limits
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const { data: auths, error: authError } = await supabase
    .from('authorizations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .gte('start_date', yearStart)
    .lte('start_date', yearEnd);

  if (authError) throw authError;

  // 1d. Fetch User Profile to check study level and adjust Examen limits
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('is_studying, study_level')
    .eq('id', userId)
    .maybeSingle();

  let examenLimit = 0;
  if (userProfile?.is_studying) {
    if (userProfile.study_level === 'secundario') {
      examenLimit = 20;
    } else if (userProfile.study_level === 'terciario') {
      examenLimit = 24;
    } else if (userProfile.study_level === 'universitario_posgrado') {
      examenLimit = 28;
    }
  }

  // 3. Get convention limits and attendance period from settings
  const { data: settingsData } = await supabase.from('settings').select('*');
  const settingsObj = settingsData?.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {}) || {};

  const limits = {
    "Ausente con aviso": { year: 6, month: 2 },
    "Media Jornada": { year: null, month: 2 },
    "Salida Excepcional": { year: 5, month: null },
    "Enfermedad de corto tratamiento": { year: 45, month: null },
    "Atención de familiar enfermo": { year: 30, month: null },
    "Examen": { year: examenLimit, month: null }
  };
  
  const period = settingsObj.attendance_period;

  // 4. Process Period Day-by-Day for accurate stats
  const stats = {
    present: 0,
    late: 0,
    absent: 0,
    justified: 0,
    expected_working_days: 0,
    non_working_days: 0,
    total_days_in_period: 0,
    history: attendance,
    limits_usage: {},
    licenseUsage: {}
  };

  const attMap = new Map();
  attendance.forEach(a => {
    const dateVal = a.check_in || a.check_out || a.created_at;
    if (!dateVal) return;
    const d = dateVal.split('T')[0];
    attMap.set(d, a);
  });

  const current = new Date(startDate + 'T00:00:00');
  const last = new Date(endDate + 'T00:00:00');

  // Utility to check if a date is within an authorization range
  const isDateInAuth = (dateStr) => {
    return auths.some(a => {
      const start = a.start_date;
      const end = a.end_date || a.start_date;
      return dateStr >= start && dateStr <= end;
    });
  };

  while (current <= last) {
    const dateStr = current.toISOString().split('T')[0];
    const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay(); // 1=Mon, 7=Sun
    
    const isHoliday = holidayMap.has(dateStr);
    const isScheduled = activeDaysOfWeek.has(dayOfWeek);

    if (isScheduled) {
      if (isHoliday) {
        stats.non_working_days++;
        stats.justified++;
        stats.expected_working_days++;
      } else {
        stats.expected_working_days++;
        const record = attMap.get(dateStr);
        const hasAuth = isDateInAuth(dateStr);

        if (record) {
          if (record.status === 'present') stats.present++;
          else if (record.status === 'late') {
            if (record.is_justified || hasAuth) stats.justified++;
            else stats.late++;
          } else if (record.status === 'justified' || hasAuth) stats.justified++;
          else if (record.status === 'absent') {
            if (record.is_justified || hasAuth) stats.justified++;
            else stats.absent++;
          }
        } else if (hasAuth) {
          stats.justified++;
        } else {
          // No record, no auth, and it's a scheduled day -> Potential Absent
          const isInPeriod = period && dateStr >= period.start_date && dateStr <= period.end_date;
          if (current < new Date() && isInPeriod) {
            stats.absent++;
          }
        }
      }
    } else if (isHoliday) {
      stats.non_working_days++;
    }

    stats.total_days_in_period++;
    current.setDate(current.getDate() + 1);
  }

  // 5. Calculate Convention Usage (Yearly and Monthly)
  const targetMonth = month !== null ? month : new Date().getMonth();

  Object.keys(limits).forEach(type => {
    let usedInYear = 0;
    let usedInMonth = 0;

    auths?.filter(a => normalizeAuthType(a.type) === type).forEach(a => {
      const start = new Date(a.start_date.split('T')[0] + 'T00:00:00');
      const end = new Date((a.end_date || a.start_date).split('T')[0] + 'T00:00:00');
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      usedInYear += diffDays;
      if (start.getMonth() === targetMonth) {
        usedInMonth += diffDays;
      }
    });

    stats.limits_usage[type] = {
      used: usedInYear,
      max_year: limits[type].year,
      remaining: limits[type].year !== null ? Math.max(0, limits[type].year - usedInYear) : null,
      used_month: usedInMonth,
      max_month: limits[type].month,
      remaining_month: limits[type].month !== null ? Math.max(0, limits[type].month - usedInMonth) : null
    };
    stats.licenseUsage[type] = usedInYear;
  });

  // Calculate attendance rate
  // (Present + Justified) / Expected
  const effectivePresent = stats.present + stats.justified;
  stats.attendanceRate = stats.expected_working_days > 0 
    ? Math.round((effectivePresent / stats.expected_working_days) * 100) 
    : 0;

  return stats;
}

/**
 * Fetches convention limits from settings
 */
export async function getConventionLimits() {
  return {
    "Ausente con aviso": { year: 6, month: 2 },
    "Media Jornada": { year: null, month: 2 },
    "Salida Excepcional": { year: 5, month: null },
    "Enfermedad de corto tratamiento": { year: 45, month: null },
    "Atención de familiar enfermo": { year: 30, month: null },
    "Examen": { year: 28, month: null }
  };
}

/**
 * Calculates duration in decimal hours between two timestamps
 */
export function getDurationHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffMs = end - start;
  if (diffMs < 0) return 0;
  return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
}

// Keep the object export for backward compatibility if needed, but named is preferred
export const StatsEngine = {
  getUserStats,
  getConventionLimits,
  getDurationHours
};
