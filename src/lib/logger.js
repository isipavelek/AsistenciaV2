import { supabase } from './supabase.js';

/**
 * Centrally manages system audit logs
 */
export async function logAction(action, details = {}, userId = null) {
  try {
    // If no userId is provided, try to get current session
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    const logEntry = {
      user_id: userId,
      action: action,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      created_at: new Date().toISOString()
    };

    console.log(`[AUDIT LOG] ${action}:`, details);

    const { error } = await supabase
      .from('audit_logs')
      .insert(logEntry);

    if (error) {
      console.warn('Failed to save audit log to Supabase. This might be because the "audit_logs" table doesn\'t exist yet.', error.message);
      // Fallback: Local storage or just console
    }
  } catch (err) {
    console.error('Error in logAction:', err);
  }
}

/**
 * Fetches recent logs
 */
export async function getAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, profiles:user_id(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
  return data;
}
