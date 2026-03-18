import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';

/**
 * Renders the Holidays management view
 */
export async function renderHolidays(container) {
  const { data: holidays, error } = await supabase
    .from('holidays')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    showNotification(error.message, 'error');
    return;
  }

  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="calendar-days"></i> Calendario de Feriados y Asuetos</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button id="sync-holidays-btn" style="width: auto; padding: 0.5rem 1rem; background: var(--surface); border: 1px solid var(--glass-border); display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="refresh-cw" style="width: 18px;"></i> Sincronizar API
          </button>
          <button id="add-holiday-btn" style="width: auto; padding: 0.5rem 1rem; background: var(--accent-gradient); display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="plus" style="width: 18px;"></i> Nuevo Feriado
          </button>
        </div>
      </div>

      <div class="card glass">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--glass-border);">
                <th style="padding: 1rem; width: 50px;"></th>
                <th style="padding: 1rem;">Fecha</th>
                <th style="padding: 1rem;">Descripción</th>
                <th style="padding: 1rem;">Tipo</th>
                <th style="padding: 1rem; text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${holidays.map(h => `
                <tr style="border-bottom: 1px solid var(--glass-border); ${h.is_pinned ? 'background: rgba(var(--accent-rgb), 0.05);' : ''}">
                  <td style="padding: 1rem; text-align: center;">
                    ${h.is_pinned ? `<i data-lucide="pin" style="width: 16px; color: var(--accent); fill: var(--accent);"></i>` : ''}
                  </td>
                  <td style="padding: 1rem;">
                    <span style="text-transform: capitalize; font-weight: 600;">${new Date(h.date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long' })}</span>, 
                    ${new Date(h.date + 'T00:00:00').toLocaleDateString()}
                  </td>
                  <td style="padding: 1rem;">${h.description || ''}</td>
                  <td style="padding: 1rem;"><span class="badge" style="background: rgba(255,255,255,0.1);">${h.type.toUpperCase()}</span></td>
                  <td style="padding: 1rem; text-align: right;">
                    <button class="pin-holiday btn-icon-sq" data-id="${h.id}" data-pinned="${h.is_pinned}" title="${h.is_pinned ? 'Desfijar' : 'Fijar'}" style="background: transparent; color: ${h.is_pinned ? 'var(--accent)' : 'var(--text-dim)'}; border: none;">
                      <i data-lucide="${h.is_pinned ? 'pin-off' : 'pin'}" style="width: 18px;"></i>
                    </button>
                    <button class="edit-holiday btn-icon-sq" data-id="${h.id}" title="Editar" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: none;">
                      <i data-lucide="edit-2" style="width: 18px;"></i>
                    </button>
                    <button class="delete-holiday btn-icon-sq" data-id="${h.id}" title="Eliminar" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none;">
                      <i data-lucide="trash-2" style="width: 18px;"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
              ${holidays.length === 0 ? '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay feriados cargados.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
      
      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>

    <!-- Holiday Modal -->
    <div id="holiday-modal" class="modal-overlay" style="display: none;">
      <div class="card glass modal-content" style="max-width: 400px; width: 90%;">
        <h3 id="holiday-modal-title">Agregar Feriado o Período</h3>
        <p id="holiday-modal-subtitle" style="font-size: 0.8rem; color: var(--text-muted); margin-top: -0.5rem;">Si es un solo día, deja la fecha de fin vacía.</p>
        <form id="holiday-form" style="margin-top: 1.5rem;">
          <input type="hidden" id="holiday-id">
          <div class="form-group">
            <label>Fecha de Inicio</label>
            <input type="date" id="holiday-date" required>
          </div>
          <div class="form-group">
            <label>Fecha de Fin (opcional)</label>
            <input type="date" id="holiday-end-date">
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <input type="text" id="holiday-desc" placeholder="Ej: Navidad o Receso Invernal" required>
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select id="holiday-type">
              <option value="feriado">Feriado Nacional</option>
              <option value="asueto">Asueto / Institucional</option>
              <option value="paro">Paro / Medida de Fuerza</option>
              <option value="vacaciones">Vacaciones Generales / Receso</option>
            </select>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 2rem;">
            <button type="submit" style="background: var(--accent-gradient);">Guardar</button>
            <button type="button" id="close-holiday-modal" style="background: var(--surface);">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const modal = container.querySelector('#holiday-modal');
  container.querySelector('#add-holiday-btn').onclick = () => {
    container.querySelector('#holiday-modal-title').textContent = 'Agregar Feriado o Período';
    container.querySelector('#holiday-modal-subtitle').style.display = 'block';
    container.querySelector('#holiday-id').value = '';
    container.querySelector('#holiday-form').reset();
    modal.style.display = 'flex';
  };
  container.querySelector('#close-holiday-modal').onclick = () => modal.style.display = 'none';

  container.querySelector('#sync-holidays-btn').onclick = async () => {
    const btn = container.querySelector('#sync-holidays-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="spin"></i> Sincronizando...`;
    
    try {
      const year = new Date().getFullYear();
      // Usamos la API de Nager.Date que soporta CORS nativamente y es muy estable
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/AR`);
      
      if (!response.ok) throw new Error('Error al conectar con la API de feriados (Nager.Date)');
      
      const data = await response.json();
      
      const holidaysToInsert = data.map(f => ({
        date: f.date,
        description: f.localName,
        type: 'feriado' // La API de Nager suele devolver feriados públicos
      }));

      // Filtrar los feriados que ya están fijados localmente para no sobrescribirlos
      const pinnedDates = new Set(holidays.filter(h => h.is_pinned).map(h => h.date));
      const filteredHolidays = holidaysToInsert.filter(h => !pinnedDates.has(h.date));

      if (filteredHolidays.length === 0) {
        showNotification('No hay feriados nuevos para sincronizar (los existentes están fijados o al día).', 'info');
        renderHolidays(container);
        return;
      }

      // Bulk upsert en Supabase usando 'date' como clave de conflicto
      const { error: syncError } = await supabase
        .from('holidays')
        .upsert(filteredHolidays, { onConflict: 'date' });

      if (syncError) {
        throw syncError;
      } else {
        showNotification(`${holidaysToInsert.length} feriados procesados (agregados/actualizados).`, 'success');
      }
      
      renderHolidays(container);
    } catch (err) {
      console.error('API Sync Error:', err);
      showNotification('Error al sincronizar feriados: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
      if (window.lucide) window.lucide.createIcons();
    }
  };

  container.querySelector('#holiday-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = container.querySelector('#holiday-id').value;
    const startDateStr = container.querySelector('#holiday-date').value;
    const endDateStr = container.querySelector('#holiday-end-date').value;
    const description = container.querySelector('#holiday-desc').value;
    const type = container.querySelector('#holiday-type').value;

    if (id) {
      // Logic for editing (update)
      const { error: upError } = await supabase
        .from('holidays')
        .update({ date: startDateStr, description, type })
        .eq('id', id);

      if (upError) {
        showNotification(upError.message, 'error');
      } else {
        showNotification('Feriado actualizado correctamente', 'success');
        modal.style.display = 'none';
        renderHolidays(container);
      }
      return;
    }

    const itemsToInsert = [];
    
    if (endDateStr && endDateStr > startDateStr) {
      const current = new Date(startDateStr + 'T00:00:00');
      const last = new Date(endDateStr + 'T00:00:00');
      while (current <= last) {
        itemsToInsert.push({
          date: current.toISOString().split('T')[0],
          description,
          type
        });
        current.setDate(current.getDate() + 1);
      }
    } else {
      itemsToInsert.push({ date: startDateStr, description, type });
    }

    const { error: insError } = await supabase
      .from('holidays')
      .insert(itemsToInsert);

    if (insError) {
      showNotification(insError.message, 'error');
    } else {
      showNotification(`${itemsToInsert.length} día(s) registrado(s) correctamente`, 'success');
      modal.style.display = 'none';
      renderHolidays(container);
    }
  };

  container.onclick = async (e) => {
    const editBtn = e.target.closest('.edit-holiday');
    const pinBtn = e.target.closest('.pin-holiday');
    const deleteBtn = e.target.closest('.delete-holiday');

    if (editBtn) {
      const holiday = holidays.find(h => String(h.id) === String(editBtn.dataset.id));
      if (holiday) {
        container.querySelector('#holiday-modal-title').textContent = 'Editar Feriado';
        container.querySelector('#holiday-modal-subtitle').style.display = 'none';
        container.querySelector('#holiday-id').value = holiday.id;
        container.querySelector('#holiday-date').value = holiday.date;
        container.querySelector('#holiday-end-date').value = '';
        container.querySelector('#holiday-desc').value = holiday.description;
        container.querySelector('#holiday-type').value = holiday.type;
        modal.style.display = 'flex';
      }
    }

    if (pinBtn) {
      const id = pinBtn.dataset.id;
      const isCurrentlyPinned = pinBtn.dataset.pinned === 'true';
      
      const { error: pinError } = await supabase
        .from('holidays')
        .update({ is_pinned: !isCurrentlyPinned })
        .eq('id', id);

      if (pinError) {
        showNotification('Error al fijar/desfijar: ' + pinError.message, 'error');
      } else {
        renderHolidays(container);
      }
    }

    if (deleteBtn) {
      if (confirm('¿Eliminar este feriado?')) {
        const { error: delError } = await supabase
          .from('holidays')
          .delete()
          .eq('id', deleteBtn.dataset.id);
        
        if (delError) showNotification(delError.message, 'error');
        else renderHolidays(container);
      }
    }
  };
}
