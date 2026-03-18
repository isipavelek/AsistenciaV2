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

      <div class="card glass" style="margin-bottom: 2rem; border-color: var(--primary-light);">
        <h3 style="display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; margin-bottom: 1rem;">
          <i data-lucide="zap" style="width: 18px; color: var(--primary-light);"></i> Carga Rápida (Lunes a Viernes)
        </h3>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input type="time" id="quick-start" value="08:00" style="width: 110px;">
            <span>—</span>
            <input type="time" id="quick-end" value="15:00" style="width: 110px;">
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="apply-lv" class="btn-small" style="background: var(--surface); width: auto; font-size: 0.8rem;">Aplicar Lun-Vie</button>
            <button id="apply-ls" class="btn-small" style="background: var(--surface); width: auto; font-size: 0.8rem;">Aplicar Lun-Sáb</button>
          </div>
        </div>
      </div>

      <div class="card glass">
        <p style="color: var(--text-muted); margin-bottom: 2rem;">Define los horarios de entrada y salida para cada día de la semana. Los días sin horario definido se consideran no laborables.</p>
        
        <div style="display: grid; gap: 0.5rem;">
          ${DAYS.map((day, index) => {
            const dayIndex = index + 1; // Skip Sunday (0), Lunes is 1, etc.
            const schedule = currentSchedules.find(s => s.day_of_week === dayIndex);
            return `
              <div class="schedule-row">
                <div class="schedule-day">${day}</div>
                <div class="schedule-controls">
                  <label>Entrada</label>
                  <input type="time" class="start-time" data-day="${dayIndex}" value="${schedule?.start_time || ''}">
                  <span style="color: var(--text-muted); margin: 0 0.25rem;">—</span>
                  <label>Salida</label>
                  <input type="time" class="end-time" data-day="${dayIndex}" value="${schedule?.end_time || ''}">
                </div>
                <div class="schedule-hours">
                  <span class="daily-hours">0h</span>
                </div>
                <button class="clear-day" data-day="${dayIndex}" title="Limpiar día">
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

  // Quick fill logic
  const applyQuickFill = (daysCount) => {
    const start = container.querySelector('#quick-start').value;
    const end = container.querySelector('#quick-end').value;
    if (!start || !end) return;

    for (let i = 1; i <= daysCount; i++) {
      const startInp = container.querySelector(`.start-time[data-day="${i}"]`);
      const endInp = container.querySelector(`.end-time[data-day="${i}"]`);
      if (startInp) startInp.value = start;
      if (endInp) endInp.value = end;
    }
  };

  const calculateHours = (row) => {
    const start = row.querySelector('.start-time').value;
    const end = row.querySelector('.end-time').value;
    const hoursSpan = row.querySelector('.daily-hours');
    
    if (start && end) {
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = end.split(':').map(Number);
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60; // Handle overnight if necessary (unlikely here but safe)
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      hoursSpan.textContent = h + (m > 0 ? `h ${m}m` : 'h');
      hoursSpan.style.color = 'var(--primary-light)';
    } else {
      hoursSpan.textContent = '0h';
      hoursSpan.style.color = 'var(--text-muted)';
    }
  };

  container.querySelectorAll('.schedule-row').forEach(row => {
    calculateHours(row);
    row.querySelectorAll('input[type="time"]').forEach(input => {
      input.oninput = () => {
        calculateHours(row);
      };
    });
  });

  const updateAllHours = () => {
    container.querySelectorAll('.schedule-row').forEach(calculateHours);
  };

  container.querySelector('#apply-lv').onclick = () => { applyQuickFill(5); updateAllHours(); };
  container.querySelector('#apply-ls').onclick = () => { applyQuickFill(6); updateAllHours(); };

  container.querySelector('#back-to-abm').onclick = () => {
    import('./admin.js').then(m => m.renderABM(container));
  };

  container.querySelectorAll('.clear-day').forEach(btn => {
    btn.onclick = () => {
      const day = btn.dataset.day;
      container.querySelector(`.start-time[data-day="${day}"]`).value = '';
      container.querySelector(`.end-time[data-day="${day}"]`).value = '';
      calculateHours(btn.closest('.schedule-row'));
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
