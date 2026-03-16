import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Renders the Schedule management for a specific user
 */
export async function renderUserSchedules(container, userId, userName) {
  const { data: currentSchedules, error } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('user_id', userId)
    .order('day_of_week');

  if (error) {
    showNotification(error.message, 'error');
    return;
  }

  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="calendar-clock"></i> Horarios de ${userName}
        </h2>
        <button id="back-to-abm" style="width: auto; padding: 0.5rem 1rem; background: var(--surface);">
          <i data-lucide="arrow-left" style="width: 16px;"></i> Volver al Personal
        </button>
      </div>

      <div class="card glass">
        <p style="color: var(--text-muted); margin-bottom: 2rem;">Define los horarios de entrada y salida para cada día de la semana. Los días sin horario definido se consideran no laborables.</p>
        
        <div style="display: grid; gap: 1rem;">
          ${DAYS.map((day, index) => {
            const dayIndex = index + 1; // Skip Sunday (0), Lunes is 1, etc.
            const schedule = currentSchedules.find(s => s.day_of_week === dayIndex);
            return `
              <div class="schedule-row" style="display: flex; align-items: center; gap: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid var(--glass-border);">
                <div style="width: 100px; font-weight: 600;">${day}</div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                  <label style="font-size: 0.75rem; color: var(--text-muted);">Entrada</label>
                  <input type="time" class="start-time" data-day="${dayIndex}" value="${schedule?.start_time || ''}" style="width: 120px;">
                  <span style="color: var(--text-muted); margin: 0 0.5rem;">—</span>
                  <label style="font-size: 0.75rem; color: var(--text-muted);">Salida</label>
                  <input type="time" class="end-time" data-day="${dayIndex}" value="${schedule?.end_time || ''}" style="width: 120px;">
                </div>
                <button class="clear-day" data-day="${dayIndex}" style="width: auto; padding: 0.4rem; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none;">
                  <i data-lucide="trash-2" style="width: 16px;"></i>
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top: 2rem; display: flex; gap: 1rem;">
          <button id="save-schedules" style="background: var(--accent-gradient);">Guardar Horarios</button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  container.querySelector('#back-to-abm').onclick = () => {
    import('./admin.js').then(m => m.renderABM(container));
  };

  container.querySelectorAll('.clear-day').forEach(btn => {
    btn.onclick = () => {
      const day = btn.dataset.day;
      container.querySelector(`.start-time[data-day="${day}"]`).value = '';
      container.querySelector(`.end-time[data-day="${day}"]`).value = '';
    };
  });

  container.querySelector('#save-schedules').onclick = async () => {
    const rows = container.querySelectorAll('.schedule-row');
    const updates = [];
    const deletes = [];

    rows.forEach(row => {
      const day = parseInt(row.querySelector('.start-time').dataset.day);
      const start = row.querySelector('.start-time').value;
      const end = row.querySelector('.end-time').value;

      if (start && end) {
        updates.push({
          user_id: userId,
          day_of_week: day,
          start_time: start,
          end_time: end
        });
      } else {
        deletes.push(day);
      }
    });

    const btn = container.querySelector('#save-schedules');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      // Delete removed schedules
      if (deletes.length > 0) {
        await supabase
          .from('user_schedules')
          .delete()
          .eq('user_id', userId)
          .in('day_of_week', deletes);
      }

      // Upsert updated schedules
      if (updates.length > 0) {
        const { error: upsertError } = await supabase
          .from('user_schedules')
          .upsert(updates, { onConflict: 'user_id,day_of_week' });
        
        if (upsertError) throw upsertError;
      }

      showNotification('Horarios actualizados correctamente', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Horarios';
    }
  };
}
