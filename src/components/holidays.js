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
        <button id="add-holiday-btn" style="width: auto; padding: 0.5rem 1rem; background: var(--accent-gradient); display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="plus" style="width: 18px;"></i> Nuevo Feriado
        </button>
      </div>

      <div class="card glass">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--glass-border);">
                <th style="padding: 1rem;">Fecha</th>
                <th style="padding: 1rem;">Descripción</th>
                <th style="padding: 1rem;">Tipo</th>
                <th style="padding: 1rem;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${holidays.map(h => `
                <tr style="border-bottom: 1px solid var(--glass-border);">
                  <td style="padding: 1rem;">${new Date(h.date + 'T00:00:00').toLocaleDateString()}</td>
                  <td style="padding: 1rem;">${h.description || ''}</td>
                  <td style="padding: 1rem;"><span class="badge" style="background: rgba(255,255,255,0.1);">${h.type.toUpperCase()}</span></td>
                  <td style="padding: 1rem;">
                    <button class="delete-holiday" data-id="${h.id}" style="width: auto; padding: 0.25rem 0.5rem; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none;">Eliminar</button>
                  </td>
                </tr>
              `).join('')}
              ${holidays.length === 0 ? '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay feriados cargados.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
      
      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>

    <!-- Holiday Modal -->
    <div id="holiday-modal" class="modal-overlay" style="display: none;">
      <div class="card glass modal-content" style="max-width: 400px; width: 90%;">
        <h3>Agregar Feriado</h3>
        <form id="holiday-form" style="margin-top: 1.5rem;">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="holiday-date" required>
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <input type="text" id="holiday-desc" placeholder="Ej: Navidad" required>
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select id="holiday-type">
              <option value="feriado">Feriado Nacional</option>
              <option value="asueto">Asueto / Institucional</option>
              <option value="paro">Paro / Medida de Fuerza</option>
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
  container.querySelector('#add-holiday-btn').onclick = () => modal.style.display = 'flex';
  container.querySelector('#close-holiday-modal').onclick = () => modal.style.display = 'none';

  container.querySelector('#holiday-form').onsubmit = async (e) => {
    e.preventDefault();
    const date = container.querySelector('#holiday-date').value;
    const description = container.querySelector('#holiday-desc').value;
    const type = container.querySelector('#holiday-type').value;

    const { error: insError } = await supabase
      .from('holidays')
      .insert({ date, description, type });

    if (insError) {
      showNotification(insError.message, 'error');
    } else {
      showNotification('Feriado agregado correctamente', 'success');
      modal.style.display = 'none';
      renderHolidays(container);
    }
  };

  container.onclick = async (e) => {
    if (e.target.classList.contains('delete-holiday')) {
      if (confirm('¿Eliminar este feriado?')) {
        const { error: delError } = await supabase
          .from('holidays')
          .delete()
          .eq('id', e.target.dataset.id);
        
        if (delError) showNotification(delError.message, 'error');
        else renderHolidays(container);
      }
    }
  };
}
