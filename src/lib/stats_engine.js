import { supabase } from './supabase.js';

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

  // 2. Fetch authorizations (licencias)
  const { data: auths, error: authError } = await supabase
    .from('authorizations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .gte('start_date', startDate)
    .lte('start_date', endDate);

  if (authError) throw authError;

  // 3. Get convention limits and attendance period from settings
  const { data: settingsData } = await supabase.from('settings').select('*');
  const settingsObj = settingsData?.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {}) || {};

  const limits = settingsObj.convention_limits || {
    'Médico - Corto Tratamiento': { year: 45, month: 15 },
    'Atención Familiar': { year: 20, month: 5 },
    'Examen': { year: 28, month: 5 }
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
    const d = a.check_in.split('T')[0];
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

  // 5. Calculate Convention Usage (Yearly)
  Object.keys(limits).forEach(type => {
    const usedInYear = auths.filter(a => a.type === type).length;
    stats.limits_usage[type] = {
      used: usedInYear,
      max_year: limits[type].year,
      remaining: Math.max(0, limits[type].year - usedInYear)
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
  const { data: settingsData } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'convention_limits')
    .single();
  
  return settingsData?.value || {
    'Médico - Corto Tratamiento': { year: 45, month: 15 },
    'Atención Familiar': { year: 20, month: 5 },
    'Examen': { year: 28, month: 5 }
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
