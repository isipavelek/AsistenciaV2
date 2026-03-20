import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';
import { getUserStats, getConventionLimits, getDurationHours } from '../lib/stats_engine.js';

/**
 * Renders the Advanced Reports Dashboard (Resumen por Usuario)
 */
export async function renderAdvancedReports(container) {
  // Fetch current user and their role
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const userRole = currentUserProfile?.role || 'user';
  const isDirector = userRole === 'director';

  // Fetch users for the filter
  const { data: users } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, legajo_utn')
    .order('last_name');

  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  let selectedUserId = 'all';
  let dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
  let dateTo = now.toISOString().split('T')[0];

  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="users"></i> Resumen por Usuario</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button id="add-manual-fichaje-btn" class="btn-primary" style="width: auto; padding: 0.5rem 1rem;">
            <i data-lucide="plus-circle"></i> Nuevo Fichaje
          </button>
          <button id="export-advanced-csv" style="width: auto; padding: 0.5rem 1rem; background: var(--surface);">
            <i data-lucide="download" style="width: 16px;"></i> CSV
          </button>
        </div>
      </div>

      <div class="filters-bar card glass" style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 1rem; align-items: flex-end;">
        <div class="form-group" style="margin-bottom:0">
          <label>Seleccionar Personal</label>
          <select id="filter-user">
            <option value="all">Todos los usuarios</option>
            ${users?.map(u => `<option value="${u.id}">${u.last_name}, ${u.first_name} (${u.legajo_utn || 'S/L'})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Desde</label>
          <input type="date" id="filter-date-from" value="${dateFrom}">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Hasta</label>
          <input type="date" id="filter-date-to" value="${dateTo}">
        </div>
        <button id="apply-filters" style="width: auto; height: 42px; background: var(--accent-gradient);">Actualizar</button>
      </div>

      <div id="convention-dashboard" style="display: none; margin-bottom: 2rem;">
        <!-- Convention stats load here -->
      </div>

      <div id="reports-stats-container" class="stats-grid">
        <!-- Stats will load here -->
      </div>

      <div class="card glass" style="margin-top: 2rem; overflow-x: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem;">
          <h3 class="card-title" style="margin: 0;"><i data-lucide="list"></i> Registros en Crudo</h3>
          <span id="record-count-badge" class="badge" style="background: var(--surface);">0 registros</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: 1rem;">Fecha</th>
              <th style="padding: 1rem;">Personal</th>
              <th style="padding: 1rem;">Entrada</th>
              <th style="padding: 1rem;">Salida</th>
              <th style="padding: 1rem;">Horas</th>
              <th style="padding: 1rem;">Estado</th>
              <th style="padding: 1rem; text-align: center;">Acciones</th>
            </tr>
          </thead>
          <tbody id="reports-table-body">
            <!-- Rows will load here -->
          </tbody>
        </table>
      </div>

      <!-- Modals will be added here -->
      <div id="edit-record-modal" class="modal-overlay" style="display: none;"></div>
      <div id="justify-modal" class="modal-overlay" style="display: none;">
        <div class="card glass modal-content" style="max-width: 400px; width: 90%;">
          <h3>Justificar / Editar Registro</h3>
          <p id="justify-user-name" style="color: var(--text-base); font-size: 1rem; margin-bottom: 0.5rem;"></p>
          <p id="justify-record-type" style="color: var(--text-muted); font-size: 0.875rem;"></p>
          <form id="justify-form" style="margin-top: 1.5rem;">
            <input type="hidden" id="justify-record-id">
            <div class="form-group">
              <label>Nota / Motivo</label>
              <textarea id="justify-note" placeholder="Ej: Olvido de fichaje, compensado..." style="width: 100%; min-height: 80px; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem;"></textarea>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
              <button type="submit" id="save-justify" style="background: var(--accent-gradient);">Guardar Cambios</button>
              <button type="button" id="close-justify-modal" style="background: var(--surface);">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
      
      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  async function loadData() {
    selectedUserId = container.querySelector('#filter-user').value;
    dateFrom = container.querySelector('#filter-date-from').value;
    dateTo = container.querySelector('#filter-date-to').value;

    const loaderStr = '<tr><td colspan="7" style="padding: 2rem; text-align: center;">Cargando datos...</td></tr>';
    container.querySelector('#reports-table-body').innerHTML = loaderStr;

    // Fetch Attendance with Auditor profile
    let query = supabase
      .from('attendance')
      .select('*, profiles:user_id(first_name, last_name, legajo_utn), auditor:justified_by(first_name, last_name)')
      .gte('created_at', `${dateFrom}T00:00:00.000Z`)
      .lte('created_at', `${dateTo}T23:59:59.999Z`)
      .order('created_at', { ascending: false });

    if (selectedUserId !== 'all') {
      query = query.eq('user_id', selectedUserId);
    }

    const { data: records, error } = await query;
    if (error) { showNotification(error.message, 'error'); return; }

    container.querySelector('#record-count-badge').textContent = `${records.length} registros`;

    // Fetch Holidays for the range
    const { data: hRange } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', dateFrom)
      .lte('date', dateTo);
    
    const holidayMap = new Map(hRange?.map(h => [h.date, h]) || []);

    // If a specific user is selected, show convention dashboard
    if (selectedUserId !== 'all') {
      // Note: getUserStats still uses year/month, we might need a version for range
      // but for now we'll show the standard stats
      const stats = await getUserStats(selectedUserId, new Date(dateFrom).getFullYear(), new Date(dateFrom).getMonth());
      renderConventionDashboard(stats);
      container.querySelector('#convention-dashboard').style.display = 'block';
    } else {
      container.querySelector('#convention-dashboard').style.display = 'none';
    }

    renderStats(records, holidayMap);
    renderTable(records, holidayMap);
  }

  function renderConventionDashboard(stats) {
    const dashboard = container.querySelector('#convention-dashboard');
    dashboard.innerHTML = `
      <div class="card glass" style="padding: 1rem; border-left: 4px solid var(--secondary);">
        <h4 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="award"></i> Info. Convenio (Mes Filtro)</h4>
        <div style="display: flex; gap: 2rem;">
          <div><span style="font-size: 0.75rem; color: var(--text-muted);">Asistencia:</span> <strong style="color: var(--success);">${stats.attendanceRate}%</strong></div>
          <div><span style="font-size: 0.75rem; color: var(--text-muted);">Tardanzas:</span> <strong>${stats.late}</strong></div>
          <div><span style="font-size: 0.75rem; color: var(--text-muted);">Ausencias:</span> <strong style="color: var(--danger);">${stats.absent}</strong></div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderStats(records, holidayMap) {
    let totalHours = 0;
    records.forEach(r => {
      if (r.check_in && r.check_out) {
        totalHours += getDurationHours(r.check_in, r.check_out);
      }
    });

    const daysWithAttendance = new Set(records.filter(r => r.check_in).map(r => r.created_at.split('T')[0])).size;
    const averageHours = daysWithAttendance > 0 ? (totalHours / daysWithAttendance).toFixed(1) : 0;

    const statsContainer = container.querySelector('#reports-stats-container');
    statsContainer.innerHTML = `
      <div class="card glass stat-card">
        <span class="stat-label">Total Horas</span>
        <span class="stat-value" style="color: var(--secondary);">${totalHours.toFixed(1)}h</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">Promedio Diario</span>
        <span class="stat-value" style="color: var(--primary-light);">${averageHours}h</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">Tardanzas</span>
        <span class="stat-value" style="color: var(--warning);">${records.filter(r => r.status === 'late').length}</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">Justificadas</span>
        <span class="stat-value" style="color: var(--success);">${records.filter(r => r.is_justified).length}</span>
      </div>
    `;
  }

  function renderTable(records, holidayMap) {
    const tbody = container.querySelector('#reports-table-body');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--text-muted);">Sin registros en este periodo.</td></tr>';
      return;
    }

    const statusLabels = {
      'present': 'PRESENTE',
      'late': 'TARDE',
      'absent': 'AUSENTE',
      'justified': 'JUSTIFICADO'
    };

    tbody.innerHTML = records.map(r => {
      const date = r.check_in || r.created_at;
      const recIsoDate = new Date(date).toISOString().split('T')[0];
      const holidayInfo = holidayMap.get(recIsoDate);
      
      const duration = (r.check_in && r.check_out) ? getDurationHours(r.check_in, r.check_out) : 0;
      const displayDuration = duration > 0 ? `${duration}h` : (r.check_in && !r.check_out ? '<span style="color: var(--warning); font-size: 0.7rem;">En curso / Sín salida</span>' : '--');

      const statusKey = r.is_justified ? 'justified' : (r.status || 'absent');
      const displayStatus = holidayInfo ? holidayInfo.type.toUpperCase() : (statusLabels[statusKey] || statusKey.toUpperCase());

      return `
        <tr style="border-bottom: 1px solid var(--glass-border);">
          <td style="padding: 1rem;">
            <div style="font-weight: 500;">${new Date(date).toLocaleDateString()}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">${new Date(date).toLocaleDateString([], {weekday: 'short'})}</div>
          </td>
          <td style="padding: 1rem;">
            <div style="font-weight: 500;">${r.profiles?.last_name || 'N/A'}, ${r.profiles?.first_name || 'N/A'}</div>
            <div style="font-size: 0.7rem; color: var(--text-dim);">L: ${r.profiles?.legajo_utn || '---'}</div>
          </td>
          <td style="padding: 1rem;">${r.check_in ? new Date(r.check_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</td>
          <td style="padding: 1rem;">${r.check_out ? new Date(r.check_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '<span style="color: var(--text-dim);">--:--</span>'}</td>
          <td style="padding: 1rem; font-weight: 600;">${displayDuration}</td>
          <td style="padding: 1rem;">
            <span class="badge ${holidayInfo ? 'badge-justified' : 'badge-' + statusKey}">
              ${displayStatus}
            </span>
          </td>
          <td style="padding: 1rem;">
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
              <button class="edit-btn btn-icon-sq" data-id="${r.id}" title="Editar / Justificar" style="background: var(--surface);">
                <i data-lucide="edit-3" style="width: 14px;"></i>
              </button>
              <button class="delete-btn btn-icon-sq" data-id="${r.id}" title="Eliminar" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">
                <i data-lucide="trash-2" style="width: 14px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Event Listeners for Table Actions
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.onclick = () => openEditModal(records.find(r => r.id === btn.dataset.id));
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = () => deleteRecord(btn.dataset.id);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function openEditModal(record) {
    const modal = container.querySelector('#edit-record-modal');
    const checkInTime = record.check_in ? new Date(record.check_in).toISOString().slice(0, 16) : '';
    const checkOutTime = record.check_out ? new Date(record.check_out).toISOString().slice(0, 16) : '';

    modal.innerHTML = `
      <div class="card glass modal-content" style="max-width: 450px; width: 90%;">
        <h3>Editar Fichaje</h3>
        <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem;">${record.profiles?.last_name}, ${record.profiles?.first_name}</p>
        
        <form id="edit-record-form">
          <div class="form-group">
            <label>Entrada</label>
            <input type="datetime-local" id="edit-check-in" value="${checkInTime}">
          </div>
          <div class="form-group">
            <label>Salida</label>
            <input type="datetime-local" id="edit-check-out" value="${checkOutTime}">
          </div>
          <div class="form-group">
            <label>Estado / Justificación</label>
            <select id="edit-status">
              <option value="present" ${record.status === 'present' ? 'selected' : ''}>Presente (Normal)</option>
              <option value="late" ${record.status === 'late' ? 'selected' : ''}>Tardanza</option>
              <option value="justified" ${record.status === 'justified' || record.is_justified ? 'selected' : ''}>Justificado</option>
              <option value="absent" ${record.status === 'absent' ? 'selected' : ''}>Ausente</option>
            </select>
          </div>
          <div class="form-group">
            <label>Notas Internas</label>
            <textarea id="edit-notes" placeholder="Motivo del cambio..." style="width: 100%; min-height: 60px; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; font-size: 0.85rem;">${record.justification_note || ''}</textarea>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
            <button type="submit" class="btn-primary">Guardar Cambios</button>
            <button type="button" id="close-edit-modal" class="btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();

    container.querySelector('#close-edit-modal').onclick = () => modal.style.display = 'none';

    container.querySelector('#edit-record-form').onsubmit = async (e) => {
      e.preventDefault();
      const inVal = document.querySelector('#edit-check-in').value;
      const outVal = document.querySelector('#edit-check-out').value;
      const status = document.querySelector('#edit-status').value;
      const notes = document.querySelector('#edit-notes').value;

      const { error } = await supabase
        .from('attendance')
        .update({
          check_in: inVal ? new Date(inVal).toISOString() : null,
          check_out: outVal ? new Date(outVal).toISOString() : null,
          status: status,
          is_justified: status === 'justified',
          justification_note: notes,
          justified_by: user.id
        })
        .eq('id', record.id);

      if (error) showNotification(error.message, 'error');
      else {
        showNotification('Registro actualizado correctamente', 'success');
        modal.style.display = 'none';
        loadData();
      }
    };
  }

  async function deleteRecord(id) {
    const btn = container.querySelector(`.delete-btn[data-id="${id}"]`);
    if (!confirm('¿Estás seguro de eliminar este registro de fichaje? Esta acción no se puede deshacer.')) return;
    
    const originalContent = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="animate-spin" data-lucide="loader-2" style="width: 14px;"></i>';
      if (window.lucide) window.lucide.createIcons();

      const { error } = await supabase.from('attendance').delete().eq('id', id);
      
      if (error) {
        showNotification('Error al eliminar: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if (window.lucide) window.lucide.createIcons();
      } else {
        showNotification('Registro eliminado correctamente', 'warning');
        loadData();
      }
    } catch (err) {
      console.error('Delete error:', err);
      showNotification('Error inesperado al eliminar el registro', 'error');
      btn.disabled = false;
      btn.innerHTML = originalContent;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  async function openManualFichajeModal() {
    const modal = container.querySelector('#edit-record-modal');
    modal.innerHTML = `
      <div class="card glass modal-content" style="max-width: 450px; width: 90%;">
        <h3>Agregar Fichaje Manual</h3>
        <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem;">Registrar una entrada/salida olvidada.</p>
        
        <form id="manual-fichaje-form">
          <div class="form-group">
            <label>Usuario</label>
            <select id="manual-user-id" required>
              <option value="">Seleccionar persona...</option>
              ${users?.map(u => `<option value="${u.id}">${u.last_name}, ${u.first_name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Entrada</label>
            <input type="datetime-local" id="manual-check-in" required>
          </div>
          <div class="form-group">
            <label>Salida (Opcional)</label>
            <input type="datetime-local" id="manual-check-out">
          </div>
          <div class="form-group">
            <label>Nota de Auditoría</label>
            <textarea id="manual-notes" placeholder="Razón de la carga manual..." required style="width: 100%; min-height: 60px; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; font-size: 0.85rem;"></textarea>
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
            <button type="submit" class="btn-primary">Crear Registro</button>
            <button type="button" id="close-manual-modal" class="btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
    container.querySelector('#close-manual-modal').onclick = () => modal.style.display = 'none';

    container.querySelector('#manual-fichaje-form').onsubmit = async (e) => {
      e.preventDefault();
      const userId = document.querySelector('#manual-user-id').value;
      const inVal = document.querySelector('#manual-check-in').value;
      const outVal = document.querySelector('#manual-check-out').value;
      const notes = document.querySelector('#manual-notes').value;

      const { error } = await supabase
        .from('attendance')
        .insert({
          user_id: userId,
          check_in: new Date(inVal).toISOString(),
          check_out: outVal ? new Date(outVal).toISOString() : null,
          status: 'present',
          is_justified: true,
          justification_note: `CARGA MANUAL: ${notes}`,
          justified_by: user.id
        });

      if (error) showNotification(error.message, 'error');
      else {
        showNotification('Registro creado con éxito', 'success');
        modal.style.display = 'none';
        loadData();
      }
    };
  }

  // Exports and Basic Handlers
  container.querySelector('#apply-filters').onclick = loadData;
  container.querySelector('#add-manual-fichaje-btn').onclick = openManualFichajeModal;
  
  container.querySelector('#export-advanced-csv').onclick = () => {
    // Basic export for current filtered records
    const tableData = container.querySelectorAll('#reports-table-body tr');
    if (!tableData.length || tableData[0].innerText.includes('Sin registros')) {
      showNotification('No hay datos para exportar', 'warning');
      return;
    }

    let csv = "Fecha,Personal,Entrada,Salida,Duracion,Estado\n";
    tableData.forEach(row => {
      const cells = row.querySelectorAll('td');
      csv += `"${cells[0].innerText.replace('\n', ' ')}","${cells[1].innerText.replace('\n', ' ')}","${cells[2].innerText}","${cells[3].innerText}","${cells[4].innerText}","${cells[5].innerText}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Resumen_Asistencia_${dateFrom}_al_${dateTo}.csv`;
    link.click();
  };

  // Initial load
  loadData();
  if (window.lucide) window.lucide.createIcons();
}
