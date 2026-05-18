import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';
import { getUserStats, getConventionLimits, getDurationHours } from '../lib/stats_engine.js';
import { logAction } from '../lib/logger.js';

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

  // Fetch users for the filter, excluding director and vicedirector
  const { data: users } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, legajo_utn, role')
    .not('role', 'in', '("director","vicedirector")')
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

    const [resRecords, resHolidays, resSchedules, resAuths] = await Promise.all([
      query,
      supabase.from('holidays').select('*').gte('date', dateFrom).lte('date', dateTo),
      supabase.from('user_schedules').select('*'),
      supabase.from('authorizations').select('*').gte('start_date', `${dateFrom}T00:00:00.000Z`).lte('start_date', `${dateTo}T23:59:59.999Z`)
    ]);

    if (resRecords.error) { showNotification(resRecords.error.message, 'error'); return; }

    const records = resRecords.data || [];
    const holidayMap = new Map(resHolidays.data?.map(h => [h.date, h]) || []);
    const schedules = resSchedules.data || [];
    const auths = resAuths.data || [];

    container.querySelector('#record-count-badge').textContent = `${records.length} registros`;

    // If a specific user is selected, show convention dashboard
    if (selectedUserId !== 'all') {
      const stats = await getUserStats(selectedUserId, new Date(dateFrom).getFullYear(), new Date(dateFrom).getMonth());
      await renderConventionDashboard(stats);
      container.querySelector('#convention-dashboard').style.display = 'block';
    } else {
      container.querySelector('#convention-dashboard').style.display = 'none';
    }

    renderStats(records, holidayMap);
    renderTable(records, holidayMap, schedules, auths);
  }

  async function renderConventionDashboard(stats) {
    const dashboard = container.querySelector('#convention-dashboard');
    
    // Fetch user authorizations with approver info
    let authsData = [];
    try {
      const { data } = await supabase
        .from('authorizations')
        .select(`
          id, type, start_date, end_date, status, notes, admin_notes,
          approver:profiles!approved_by ( first_name, last_name )
        `)
        .eq('user_id', selectedUserId)
        .order('start_date', { ascending: false });
      authsData = data || [];
    } catch (err) {
      console.error('Error fetching authorizations for dashboard:', err);
    }

    // Build the yearly limits consumption UI list
    const limitsHtml = Object.keys(stats.limits_usage || {}).map(type => {
      const u = stats.limits_usage[type];
      
      // Check if it has a yearly limit
      const hasYearlyLimit = u.max_year !== null && u.max_year !== undefined;
      
      let percent = 0;
      if (hasYearlyLimit) {
        percent = Math.min(100, (u.used / u.max_year) * 100);
      } else if (u.max_month !== null && u.max_month !== undefined && u.max_month > 0) {
        percent = Math.min(100, (u.used_month / u.max_month) * 100);
      }
      
      const barColor = percent >= 90 ? 'var(--danger)' : percent >= 60 ? 'var(--warning)' : 'var(--primary-light)';
      
      let labelText = '';
      let detailText = '';
      
      if (hasYearlyLimit) {
        labelText = `${u.used} / ${u.max_year} días`;
        if (u.max_month !== null && u.max_month !== undefined && u.max_month > 0) {
          detailText = `(Quedan ${u.remaining} en el año - ${u.remaining_month} este mes)`;
        } else {
          detailText = `(Quedan ${u.remaining})`;
        }
      } else {
        // Monthly only (like Media Jornada)
        labelText = `${u.used_month} / ${u.max_month} permisos este mes`;
        detailText = `(Quedan ${u.remaining_month} este mes)`;
      }

      return `
        <div style="margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
            <span><strong>${type}</strong></span>
            <span style="color: var(--text-muted);">${labelText} ${detailText}</span>
          </div>
          <div style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow: hidden; border: 1px solid var(--glass-border);">
            <div style="background: ${barColor}; width: ${percent}%; height: 100%; border-radius: 3px; transition: width 0.3s ease;"></div>
          </div>
        </div>
      `;
    }).join('');

    // Build the Authorizations table
    let authsListHtml = '';
    if (authsData.length === 0) {
      authsListHtml = `<p style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 2rem;">Sin solicitudes de licencias registradas.</p>`;
    } else {
      authsListHtml = `
        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 8px; background: rgba(0,0,0,0.15);">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--glass-border); position: sticky; top: 0; z-index: 1;">
                <th style="padding: 0.5rem; color: var(--secondary);">Tipo</th>
                <th style="padding: 0.5rem; color: var(--secondary);">Periodo</th>
                <th style="padding: 0.5rem; color: var(--secondary);">Estado</th>
                <th style="padding: 0.5rem; color: var(--secondary);">Autorizante</th>
                <th style="padding: 0.5rem; color: var(--secondary);">Detalles</th>
              </tr>
            </thead>
            <tbody>
              ${authsData.map(a => {
                const start = a.start_date ? new Date(a.start_date).toLocaleDateString() : '---';
                const end = a.end_date ? new Date(a.end_date).toLocaleDateString() : '---';
                const period = start === end ? start : `${start} al ${end}`;
                const approverName = a.approver ? `${a.approver.first_name} ${a.approver.last_name}` : (a.status === 'approved' || a.status === 'rejected' ? 'Administrador' : '---');
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.5rem; font-weight: 500;">${a.type}</td>
                    <td style="padding: 0.5rem; color: var(--text-muted); font-size: 0.75rem;">${period}</td>
                    <td style="padding: 0.5rem;">
                      <span class="badge badge-${a.status}" style="font-size: 0.65rem; padding: 0.15rem 0.35rem;">${a.status.toUpperCase()}</span>
                    </td>
                    <td style="padding: 0.5rem; color: var(--text-muted); font-size: 0.75rem;">${approverName}</td>
                    <td style="padding: 0.5rem; font-size: 0.75rem; color: var(--text-muted); max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.notes || ''}">
                      ${a.notes || '---'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    dashboard.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        
        <!-- Left Panel: Monthly statistics & Collective limits usage -->
        <div class="card glass" style="padding: 1.25rem; border-left: 4px solid var(--secondary); display: flex; flex-direction: column; gap: 1rem;">
          <h4 style="margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--text);"><i data-lucide="award" style="color: var(--secondary);"></i> Info. Convenio y Límites Anuales</h4>
          
          <div style="display: flex; gap: 1.5rem; background: rgba(255,255,255,0.02); padding: 0.6rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div><span style="font-size: 0.75rem; color: var(--text-muted);">Asistencia:</span> <strong style="color: var(--success); font-size: 0.9rem;">${stats.attendanceRate}%</strong></div>
            <div><span style="font-size: 0.75rem; color: var(--text-muted);">Tardanzas:</span> <strong style="font-size: 0.9rem;">${stats.late}</strong></div>
            <div><span style="font-size: 0.75rem; color: var(--text-muted);">Ausencias:</span> <strong style="color: var(--danger); font-size: 0.9rem;">${stats.absent}</strong></div>
          </div>
          
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <h5 style="margin-bottom: 0.5rem; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Consumo de Límites Anuales</h5>
            ${limitsHtml || '<p style="color: var(--text-muted); font-size: 0.8rem;">Sin límites dinámicos registrados.</p>'}
          </div>
        </div>

        <!-- Right Panel: Historic requests status -->
        <div class="card glass" style="padding: 1.25rem; border-left: 4px solid var(--primary-light); display: flex; flex-direction: column; gap: 0.5rem;">
          <h4 style="margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--text);"><i data-lucide="history" style="color: var(--primary-light);"></i> Solicitudes y Autorizantes</h4>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Historial completo de licencias y quién procesó la aprobación/rechazo.</p>
          ${authsListHtml}
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

  function renderTable(records, holidayMap, schedules, auths) {
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
      const date = r.check_in || r.check_out || r.created_at;
      const recIsoDate = new Date(date).toISOString().split('T')[0];
      const holidayInfo = holidayMap.get(recIsoDate);
      
      const duration = (r.check_in && r.check_out) ? getDurationHours(r.check_in, r.check_out) : 0;
      const displayDuration = duration > 0 ? `${duration}h` : 
                              (r.check_in && !r.check_out ? '<span style="color: var(--warning); font-size: 0.7rem;">En curso / Sin salida</span>' : 
                              (!r.check_in && r.check_out ? '<span style="color: var(--warning); font-size: 0.7rem;">Abierto / Sin entrada</span>' : '--'));

      // Calcular si cumplió la carga horaria programada
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      const scheduleDayIndex = dayOfWeek === 0 ? 7 : dayOfWeek;
      const sched = schedules?.find(s => s.user_id === r.user_id && s.day_of_week === scheduleDayIndex);
      
      // Horas del cronograma
      const schedHours = sched ? getDurationHours(`2026-05-18T${sched.start_time}`, `2026-05-18T${sched.end_time}`) : 0;

      let displayStatus = '';
      let badgeClass = '';

      if (holidayInfo) {
        displayStatus = holidayInfo.type.toUpperCase();
        badgeClass = 'badge-justified';
      } else if (r.check_in && !r.check_out) {
        displayStatus = 'SESIÓN ABIERTA';
        badgeClass = 'badge-late';
      } else if (!r.check_in && r.check_out) {
        displayStatus = 'SIN ENTRADA';
        badgeClass = 'badge-late';
      } else {
        const isHoursCovered = schedHours === 0 || duration >= (schedHours - 0.1); // Tolerancia de 6 min

        if (isHoursCovered) {
          const statusKey = r.is_justified ? 'justified' : (r.status || 'present');
          displayStatus = statusLabels[statusKey] || statusKey.toUpperCase();
          badgeClass = 'badge-' + statusKey;
        } else {
          // Carga horaria incompleta. Buscar si tiene solicitudes de licencia/permiso
          const auth = auths?.find(a => 
            a.user_id === r.user_id && 
            new Date(a.start_date).toISOString().split('T')[0] === recIsoDate
          );

          if (auth) {
            if (auth.status === 'approved') {
              displayStatus = `JUSTIFICADO (${auth.type.toUpperCase()})`;
              badgeClass = 'badge-justified';
            } else if (auth.status === 'pending') {
              displayStatus = `PENDIENTE (${auth.type.toUpperCase()})`;
              badgeClass = 'badge-pending';
            } else {
              displayStatus = 'INCOMPLETO (SIN JUSTIFICAR)';
              badgeClass = 'badge-absent';
            }
          } else if (r.is_justified) {
            displayStatus = 'JUSTIFICADO (MANUAL)';
            badgeClass = 'badge-justified';
          } else {
            displayStatus = 'INCOMPLETO (SIN JUSTIFICAR)';
            badgeClass = 'badge-absent';
          }
        }
      }

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
            <span class="badge ${badgeClass}" style="display: inline-flex; align-items: center; gap: 0.25rem;">
              ${badgeClass === 'badge-pending' ? '⚠️ ' : (badgeClass === 'badge-absent' ? '❌ ' : '')}${displayStatus}
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
      const rec = records.find(r => r.id === btn.dataset.id);
      const name = rec ? `${rec.profiles?.last_name || ''}, ${rec.profiles?.first_name || ''}`.trim() : 'Desconocido';
      btn.onclick = () => deleteRecord(btn.dataset.id, name);
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
          justified_by: user.id,
          metadata: {
            ...record.metadata,
            last_edited_by_admin: true,
            last_admin_id: user.id,
            last_admin_role: userRole,
            last_admin_comment: notes
          }
        })
        .eq('id', record.id);

      if (error) showNotification(error.message, 'error');
      else {
        await logAction('ADMIN_EDIT_CLOCK', {
          target_user_id: record.user_id,
          target_user_name: `${record.profiles?.last_name || ''}, ${record.profiles?.first_name || ''}`.trim(),
          old_check_in: record.check_in,
          old_check_out: record.check_out,
          new_check_in: inVal ? new Date(inVal).toISOString() : 'N/A',
          new_check_out: outVal ? new Date(outVal).toISOString() : 'N/A',
          comment: notes,
          admin_role: userRole
        }, user.id);

        showNotification('Registro actualizado correctamente', 'success');
        modal.style.display = 'none';
        loadData();
      }
    };
  }

  async function deleteRecord(id, targetName = 'Desconocido') {
    const btn = container.querySelector(`.delete-btn[data-id="${id}"]`);
    if (!confirm(`¿Estás seguro de eliminar este registro de fichaje de ${targetName}? Esta acción no se puede deshacer.`)) return;
    
    const originalContent = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="animate-spin" data-lucide="loader-2" style="width: 14px;"></i>';
      if (window.lucide) window.lucide.createIcons();

      const { error, count } = await supabase.from('attendance').delete({ count: 'exact' }).eq('id', id);
      
      console.log('Delete attempt:', { id, error, count });

      if (error) {
        showNotification('Error al eliminar: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if (window.lucide) window.lucide.createIcons();
      } else if (count === 0) {
        showNotification('No se pudo eliminar: el registro no existe o no tienes permisos.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalContent;
        if (window.lucide) window.lucide.createIcons();
      } else {
        await logAction('ADMIN_DELETE_CLOCK', {
          target_user_name: targetName,
          record_id: id,
          admin_role: userRole
        }, user.id);

        showNotification('Registro eliminado correctamente', 'warning');
        // Give a small delay for DB consistency before reload
        setTimeout(() => loadData(), 200);
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
          <div class="form-group" style="position: relative; margin-bottom: 1.5rem;">
            <label>Usuario (Buscar Personal)</label>
            <input type="text" id="manual-user-search" placeholder="Escribe apellido o nombre..." required autocomplete="off" style="width: 100%; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.9rem;">
            <input type="hidden" id="manual-user-id" required>
            <div id="manual-user-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: #1e293b; border: 1px solid var(--glass-border); border-radius: 8px; z-index: 1010; box-shadow: 0 10px 25px rgba(0,0,0,0.6); margin-top: 4px;"></div>
          </div>
          <div class="form-group">
            <label>Fecha de Fichaje</label>
            <input type="date" id="manual-date" required style="background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; width: 100%;">
          </div>
          <div class="form-group-row" style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label>Horario Entrada</label>
              <input type="time" id="manual-time-in" style="background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; width: 100%;">
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label>Horario Salida (Opcional)</label>
              <input type="time" id="manual-time-out" style="background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; width: 100%;">
            </div>
          </div>
          <div class="form-group">
            <label>Observaciones (Opcional)</label>
            <textarea id="manual-notes" placeholder="Observaciones o comentarios adicionales..." style="width: 100%; min-height: 60px; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; font-size: 0.85rem;"></textarea>
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

    // Establecer fecha por defecto (hoy local del usuario)
    const todayStr = new Date().toLocaleDateString('sv-SE');
    container.querySelector('#manual-date').value = todayStr;

    // Lógica del filtro de autocompletado en tiempo real
    const searchInput = container.querySelector('#manual-user-search');
    const userIdInput = container.querySelector('#manual-user-id');
    const suggestionsDiv = container.querySelector('#manual-user-suggestions');
    const originalUsers = [...(users || [])];

    const renderSuggestions = (filteredList) => {
      if (filteredList.length === 0) {
        suggestionsDiv.innerHTML = `<div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No se encontraron resultados</div>`;
      } else {
        suggestionsDiv.innerHTML = filteredList.map(u => `
          <div class="suggestion-item" data-id="${u.id}" data-name="${u.last_name}, ${u.first_name}" style="padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.875rem; transition: background 0.2s;">
            ${u.last_name}, ${u.first_name}
          </div>
        `).join('');
      }
      suggestionsDiv.style.display = 'block';
    };

    suggestionsDiv.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) item.style.background = 'rgba(255, 255, 255, 0.08)';
    });

    suggestionsDiv.addEventListener('mouseout', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) item.style.background = '';
    });

    suggestionsDiv.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        const id = item.dataset.id;
        const name = item.dataset.name;
        searchInput.value = name;
        userIdInput.value = id;
        suggestionsDiv.style.display = 'none';
      }
    });

    searchInput.onfocus = () => {
      const term = searchInput.value.toLowerCase().trim();
      const filtered = originalUsers.filter(u => 
        `${u.last_name}, ${u.first_name}`.toLowerCase().includes(term)
      );
      renderSuggestions(filtered);
    };

    searchInput.oninput = (e) => {
      userIdInput.value = ''; // Reset ID while typing
      const term = e.target.value.toLowerCase().trim();
      const filtered = originalUsers.filter(u => 
        `${u.last_name}, ${u.first_name}`.toLowerCase().includes(term)
      );
      renderSuggestions(filtered);
    };

    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Evitar envío prematuro del formulario
        const items = suggestionsDiv.querySelectorAll('.suggestion-item');
        if (items.length === 1) {
          const firstItem = items[0];
          const id = firstItem.dataset.id;
          const name = firstItem.dataset.name;
          searchInput.value = name;
          userIdInput.value = id;
          suggestionsDiv.style.display = 'none';
        }
      }
    };

    const handleOutsideClick = (e) => {
      if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
        suggestionsDiv.style.display = 'none';
      }
    };

    document.addEventListener('click', handleOutsideClick);

    container.querySelector('#close-manual-modal').onclick = () => {
      modal.style.display = 'none';
      document.removeEventListener('click', handleOutsideClick);
    };

    container.querySelector('#manual-fichaje-form').onsubmit = async (e) => {
      e.preventDefault();
      const btnSubmit = e.target.querySelector('button[type="submit"]');
      const originalText = btnSubmit.innerHTML;
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = 'Procesando...';

      try {
        const userId = userIdInput.value;
        const dateVal = container.querySelector('#manual-date').value;
        const timeInVal = container.querySelector('#manual-time-in').value;
        const timeOutVal = container.querySelector('#manual-time-out').value;
        const notes = container.querySelector('#manual-notes').value;

        if (!userId) {
          showNotification('Por favor, selecciona un usuario válido de la lista de sugerencias.', 'error');
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalText;
          return;
        }

        if (!timeInVal && !timeOutVal) {
          showNotification('Debes ingresar al menos el horario de entrada o el de salida.', 'error');
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalText;
          return;
        }

        const checkInLocal = timeInVal ? new Date(`${dateVal}T${timeInVal}`) : null;
        const checkOutLocal = timeOutVal ? new Date(`${dateVal}T${timeOutVal}`) : null;

        if (checkInLocal && checkOutLocal && checkOutLocal <= checkInLocal) {
          showNotification('La hora de salida debe ser posterior a la de entrada.', 'error');
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalText;
          return;
        }

        const userName = searchInput.value;

        // Query existing attendance records for this user to check for unification
        const { data: existingRecords, error: queryErr } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', userId);

        if (queryErr) throw queryErr;

        const matchingRecords = (existingRecords || []).filter(r => {
          const checkInDate = r.check_in ? r.check_in.split('T')[0] : null;
          const checkOutDate = r.check_out ? r.check_out.split('T')[0] : null;
          return checkInDate === dateVal || checkOutDate === dateVal;
        });

        let saveError = null;
        let isUnified = false;

        if (matchingRecords.length > 0) {
          // Unify with existing record
          const r = matchingRecords[0];
          isUnified = true;

          const updatePayload = {
            is_justified: true,
            justification_note: `CARGA MANUAL (UNIFICADA): ${notes}`,
            justified_by: user.id,
            metadata: {
              created_by_admin: true,
              admin_id: user.id,
              admin_role: userRole,
              admin_comment: notes,
              unified_from_manual: true,
              unified_at: new Date().toISOString()
            }
          };

          if (timeInVal) {
            updatePayload.check_in = checkInLocal.toISOString();
          }
          if (timeOutVal) {
            updatePayload.check_out = checkOutLocal.toISOString();
          }

          const { error } = await supabase
            .from('attendance')
            .update(updatePayload)
            .eq('id', r.id);
          saveError = error;
        } else {
          // Create new record
          const insertPayload = {
            user_id: userId,
            check_in: checkInLocal ? checkInLocal.toISOString() : null,
            check_out: checkOutLocal ? checkOutLocal.toISOString() : null,
            status: 'present',
            is_justified: true,
            justification_note: `CARGA MANUAL: ${notes}`,
            justified_by: user.id,
            metadata: {
              created_by_admin: true,
              admin_id: user.id,
              admin_role: userRole,
              admin_comment: notes
            }
          };

          const { error } = await supabase
            .from('attendance')
            .insert(insertPayload);
          saveError = error;
        }

        if (saveError) {
          showNotification(saveError.message, 'error');
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalText;
        } else {
          await logAction(isUnified ? 'ADMIN_EDIT_CLOCK' : 'ADMIN_MANUAL_CLOCK', {
            target_user_id: userId,
            target_user_name: userName,
            check_in: checkInLocal ? checkInLocal.toISOString() : 'N/A',
            check_out: checkOutLocal ? checkOutLocal.toISOString() : 'N/A',
            comment: notes,
            admin_role: userRole,
            was_unified: isUnified
          }, user.id);

          showNotification(isUnified ? 'Registro unificado correctamente' : 'Fichaje manual creado con éxito', 'success');
          document.removeEventListener('click', handleOutsideClick);
          modal.style.display = 'none';
          loadData();
        }
      } catch (err) {
        console.error('Manual clocking submission error:', err);
        showNotification('Error inesperado: ' + err.message, 'error');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
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
