import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';

/**
 * Renders the Daily Report module
 */
export async function renderDailyReports(container, settings) {
  const now = new Date();
  let selectedDate = now.toISOString().split('T')[0];
  let reportData = [];

  container.innerHTML = `
    <div class="animate-in">
      <div class="daily-reports-header">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="clipboard-list"></i> Parte Diario</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button id="generate-pdf" style="width: auto; padding: 0.5rem 1rem; background: var(--secondary); color: white;">
            <i data-lucide="file-text" style="width: 16px;"></i> Generar PDF
          </button>
        </div>
      </div>

      <div class="daily-reports-layout" style="display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; margin-top: 1rem; align-items: start;">
        <!-- Calendar Column -->
        <div class="card glass calendar-sidebar" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; height: fit-content; border: 1px solid var(--glass-border); border-radius: 8px;">
          <div class="calendar-header" style="display: flex; justify-content: space-between; align-items: center;">
            <button id="prev-month" class="btn-icon" style="background: transparent; border: none; color: var(--text-normal); font-size: 1.2rem; cursor: pointer; padding: 4px 8px; font-weight: bold;">&lt;</button>
            <span id="calendar-title" style="font-weight: bold; font-size: 1.05rem;">Cargando...</span>
            <button id="next-month" class="btn-icon" style="background: transparent; border: none; color: var(--text-normal); font-size: 1.2rem; cursor: pointer; padding: 4px 8px; font-weight: bold;">&gt;</button>
          </div>
          <div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 0.8rem;">
            <div style="font-weight: bold; color: var(--text-muted);">Lu</div>
            <div style="font-weight: bold; color: var(--text-muted);">Ma</div>
            <div style="font-weight: bold; color: var(--text-muted);">Mi</div>
            <div style="font-weight: bold; color: var(--text-muted);">Ju</div>
            <div style="font-weight: bold; color: var(--text-muted);">Vi</div>
            <div style="font-weight: bold; color: var(--text-muted);">Sá</div>
            <div style="font-weight: bold; color: var(--text-muted);">Do</div>
          </div>
          <div id="calendar-days" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
            <!-- Days will go here dynamically -->
          </div>
          <div class="calendar-legend" style="display: flex; gap: 1rem; justify-content: center; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; border-top: 1px solid var(--glass-border); padding-top: 0.75rem;">
            <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: rgba(16, 185, 129, 0.4); border: 1px solid #10B981; display: inline-block;"></span> Generado</span>
            <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); border: 1px solid #EF4444; display: inline-block;"></span> Faltante</span>
          </div>
        </div>

        <!-- Main Content Column -->
        <div class="daily-reports-main" style="display: flex; flex-direction: column; gap: 1rem;">
          <div class="card glass filters-bar" style="margin-top: 0;">
            <div class="form-group" style="margin-bottom:0">
              <label>Fecha del Parte</label>
              <input type="date" id="report-date" value="${selectedDate}">
            </div>
            <div class="filter-actions" style="display: flex; gap: 1rem;">
              <button id="load-report" style="width: auto; height: 42px; background: var(--accent-gradient);">Cargar / Consolidar</button>
              <button id="save-report" style="width: auto; height: 42px; background: var(--surface);">Guardar / Consolidar</button>
            </div>
          </div>

          <div class="card glass table-wrapper">
            <table class="daily-report-table">
              <thead>
                <tr style="border-bottom: 1px solid var(--glass-border);">
                  <th style="padding: 1rem; width: 80px;">Legajo</th>
                  <th style="padding: 1rem;">Nombre y Apellido</th>
                  <th style="padding: 1rem;">Horario</th>
                  <th style="padding: 1rem;">Novedad</th>
                  <th style="padding: 1rem; text-align: center;">Autorizado</th>
                  <th style="padding: 1rem;">Observación</th>
                </tr>
              </thead>
              <tbody id="daily-report-body">
                <tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">Selecciona una fecha del calendario o ingresala arriba para cargar el reporte.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  /**
   * Consolidate attendance, schedules and authorizations for a date
   */
  async function loadReport() {
    try {
      selectedDate = container.querySelector('#report-date').value;
      if (!selectedDate) {
        showNotification('Selecciona una fecha válida', 'warning');
        return;
      }

      console.log('--- Loading Daily Report for:', selectedDate);
      const loadBtn = container.querySelector('#load-report');
      loadBtn.disabled = true;
      loadBtn.textContent = 'Procesando...';

      const dateObj = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      const scheduleDayIndex = dayOfWeek === 0 ? 7 : dayOfWeek;

      const [resProfiles, resSchedules, resAttendance, resHoliday, resExisting, resAuths] = await Promise.all([
        supabase.from('profiles').select('*').order('last_name'),
        supabase.from('user_schedules').select('*').eq('day_of_week', scheduleDayIndex),
        supabase.from('attendance')
          .select('*')
          .gte('check_in', `${selectedDate}T00:00:00.000Z`)
          .lte('check_in', `${selectedDate}T23:59:59.999Z`),
        supabase.from('holidays').select('*').eq('date', selectedDate).maybeSingle(),
        supabase.from('daily_reports').select('*, items:daily_report_items(*)').eq('date', selectedDate).maybeSingle(),
        supabase.from('authorizations').select('*')
      ]);

      if (resProfiles.error) throw resProfiles.error;
      if (resSchedules.error) throw resSchedules.error;
      if (resAttendance.error) throw resAttendance.error;
      if (resAuths.error) throw resAuths.error;

      // Exclude director and vicedirector roles completely from Daily Reports
      const profiles = (resProfiles.data || []).filter(p => !['director', 'vicedirector'].includes(p.role));
      const schedules = resSchedules.data || [];
      const attendance = resAttendance.data || [];
      const holiday = resHoliday.data;
      const existingReport = resExisting.data;
      
      // Filtrar autorizaciones en memoria para evitar errores de sintaxis y cuelgues de Supabase/PostgREST
      const allAuths = (resAuths.data || []).filter(a => {
        const start = new Date(a.start_date).toISOString().split('T')[0];
        const end = a.end_date ? new Date(a.end_date).toISOString().split('T')[0] : null;
        if (end) {
          return selectedDate >= start && selectedDate <= end;
        }
        return selectedDate === start;
      });

      // Check for pending auths
      const pendingAuths = allAuths.filter(a => a.status === 'pending');
      if (pendingAuths.length > 0) {
        if (!confirm(`Hay ${pendingAuths.length} solicitud(es) de licencia PENDIENTE(S) para el día de hoy.\n\n¿Deseas continuar con la generación del parte de todas formas? Se recomienda resolverlas primero.`)) {
          return;
        }
      }

      if (existingReport) {
        showNotification('Ya existe un reporte para este día. Cargar los datos actuales sobreescribirá el borrador si decides guardar.', 'info');
      }

      reportData = profiles.filter(p => 
        schedules.some(s => s.user_id === p.id) || 
        attendance.some(a => a.user_id === p.id) || 
        allAuths.some(a => a.user_id === p.id)
      ).map(p => {
        const schedule = schedules.find(s => s.user_id === p.id);
        const record = attendance.find(a => a.user_id === p.id);
        const auth = allAuths.find(a => a.user_id === p.id);
        const existingItem = existingReport?.items.find(i => i.user_id === p.id);

        let novelty = 'Sin novedad';
        let isAuthorized = false;
        let isHoliday = !!holiday;
        let isPending = auth?.status === 'pending';

        if (existingItem) {
          // Si ya existe el parte guardado, mostramos exactamente lo que se guardó y consolidó
          novelty = existingItem.novelty;
          isAuthorized = existingItem.is_authorized;
        } else if (holiday) {
          novelty = `FERIADO: ${holiday.description.toUpperCase()}`;
          isAuthorized = true;
        } else if (auth) {
          // Si hay una licencia/permiso en trámite o aprobada, colocarla automáticamente
          if (auth.status === 'approved') {
            novelty = auth.type;
            isAuthorized = true;
          } else if (auth.status === 'pending') {
            novelty = `${auth.type} (EN TRÁMITE)`;
            isAuthorized = false;
          } else if (auth.status === 'rejected' && !record) {
            novelty = 'Ausente sin justificativo';
            isAuthorized = false;
          }
        } else if (!record) {
          // Check if date is within attendance period
          const period = settings?.attendance_period;
          const isInPeriod = period && selectedDate >= period.start_date && selectedDate <= period.end_date;

          if (isInPeriod) {
            novelty = 'Ausente sin aviso';
            isAuthorized = false;
          } else {
            novelty = 'FUERA DE CICLO';
            isAuthorized = true;
          }
        } else if (record) {
          if (!record.check_out) {
            novelty = 'SESIÓN ABIERTA';
            isAuthorized = false;
          } else {
            // Calcular dinámicamente si llegó tarde o trabajó menos horas de las programadas
            let isLate = record.is_late;
            let isShort = false;

            if (schedule) {
              const [schH, schM] = schedule.start_time.split(':').map(Number);
              const checkInDate = new Date(record.check_in);
              
              const scheduledEntryMins = schH * 60 + schM;
              const actualEntryMins = checkInDate.getHours() * 60 + checkInDate.getMinutes();
              const tolerance = settings?.business_rules?.tolerance_minutes || 15;
              
              if (actualEntryMins - scheduledEntryMins > tolerance) {
                isLate = true;
              }

              if (record.check_out) {
                const checkOutDate = new Date(record.check_out);
                const workedHrs = (checkOutDate - checkInDate) / 3600000;
                
                const [schOutH, schOutM] = schedule.end_time.split(':').map(Number);
                const scheduledHrs = (schOutH * 60 + schOutM - scheduledEntryMins) / 60;
                
                // Si faltan más de 30 minutos de trabajo, marcar como incompleto
                if (scheduledHrs - workedHrs > 0.5) {
                  isShort = true;
                }
              }
            }

            if (isLate) {
              novelty = 'TARDANZA';
              isAuthorized = false;
            } else if (isShort) {
              novelty = 'HORARIO INCOMPLETO';
              isAuthorized = false;
            } else {
              novelty = 'Sin novedad';
              isAuthorized = true;
            }
          }
        }

        return {
          user_id: p.id,
          attendance_id: record?.id,
          legajo: p.legajo_utn || '---',
          name: `${p.last_name} ${p.first_name}`.toUpperCase(),
          schedule: schedule ? `${schedule.start_time} - ${schedule.end_time}` : 'Sin horario asignado',
          scheduled_out: schedule ? schedule.end_time : null,
          novelty: novelty,
          is_authorized: isAuthorized,
          is_holiday: isHoliday,
          is_pending: isPending,
          observation: existingItem?.observation || ''
        };
      });

      renderTable();
    } catch (err) {
      console.error('Error loading report:', err);
      showNotification('Error al cargar reporte: ' + err.message, 'error');
    } finally {
      const loadBtn = container.querySelector('#load-report');
      if (loadBtn) {
        loadBtn.disabled = false;
        loadBtn.textContent = 'Cargar / Consolidar';
      }
    }
  }

  function renderTable() {
    const tbody = container.querySelector('#daily-report-body');
    if (!tbody) return;
    
    if (reportData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay personal programado para este día.</td></tr>';
      return;
    }

    const header = container.querySelector('thead tr');
    if (header && !header.querySelector('.actions-th')) {
      const th = document.createElement('th');
      th.className = 'actions-th';
      th.style.padding = '1rem';
      th.style.textAlign = 'right';
      th.textContent = 'Acciones';
      header.appendChild(th);
    }

    tbody.innerHTML = reportData.map((item, idx) => {
      const isRed = item.novelty.toLowerCase().includes('ausente') || 
                    item.novelty.toLowerCase().includes('incompleto') || 
                    item.novelty.toLowerCase().includes('tardanza');
                    
      const standardOptions = [
        'Sin novedad',
        'Ausente sin aviso',
        'Ausente sin justificativo',
        'Ausente con aviso',
        'Permiso de media jornada',
        'Permisos de salida excepcional',
        'Ausente por medico',
        'Ausente por enfermdad de largo tratamiento',
        'Atención de familiar enfermo',
        'Ausente por Mapaternidad',
        'Matrimonio',
        'Fallecimiento',
        'Examen',
        'TARDANZA',
        'HORARIO INCOMPLETO',
        'SESIÓN ABIERTA'
      ];
      
      const options = [...standardOptions];
      if (item.novelty && !options.includes(item.novelty)) {
        options.push(item.novelty);
      }

      const optionsHtml = options.map(opt => `
        <option value="${opt}" ${item.novelty === opt ? 'selected' : ''}>${opt}</option>
      `).join('');

      return `
        <tr style="border-bottom: 1px solid var(--glass-border); 
          ${item.is_holiday ? 'background: rgba(16, 185, 129, 0.05);' : ''} 
          ${item.is_pending ? 'background: rgba(245, 158, 11, 0.1);' : ''}">
          <td data-label="Legajo" style="padding: 1rem; ${item.is_pending ? 'border-left: 4px solid var(--warning);' : ''}">${item.legajo}</td>
          <td data-label="Personal" style="padding: 1rem;">
            ${item.name}
            ${item.is_pending ? '<br><span style="font-size: 0.7rem; color: var(--warning); font-weight: bold;">⚠️ LICENCIA PENDIENTE</span>' : ''}
          </td>
          <td data-label="Horario" style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem;">${item.schedule}</td>
          <td data-label="Novedad" style="padding: 1rem;">
            ${item.is_holiday ? 
              `<span style="color: var(--success); font-weight: bold; font-size: 0.85rem;">${item.novelty}</span>` :
              `<select class="novelty-select" data-idx="${idx}" style="font-size: 0.85rem; padding: 0.25rem; ${isRed ? 'color: var(--danger); font-weight: bold;' : ''}">
                ${optionsHtml}
              </select>`
            }
          </td>
          <td data-label="Autorizado" style="padding: 1rem; text-align: center;">
            <input type="checkbox" class="auth-check" data-idx="${idx}" ${item.is_authorized ? 'checked' : ''} ${item.is_holiday ? 'disabled' : ''}>
          </td>
          <td data-label="Observación" style="padding: 1rem;">
            <input type="text" class="obs-input" data-idx="${idx}" value="${item.observation}" placeholder="..." style="font-size: 0.85rem; background: transparent; border: 1px solid var(--glass-border); width: 100%;">
          </td>
          <td data-label="Acciones" style="padding: 1rem; text-align: right;">
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
              ${item.novelty === 'SESIÓN ABIERTA' ? `
                <button class="action-btn fix-out" data-idx="${idx}" title="Cerrar salida con horario programado" style="background: var(--warning); color: black; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.75rem;">
                  <i data-lucide="log-out" style="width: 14px;"></i> Cerrar
                </button>
              ` : ''}
              ${item.novelty.toLowerCase().includes('ausente') ? `
                <button class="action-btn fix-present" data-idx="${idx}" title="Marcar como presente manual" style="background: var(--secondary); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.75rem;">
                  <i data-lucide="check-circle" style="width: 14px;"></i> Presente
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Attach events
    tbody.querySelectorAll('.fix-out').forEach(btn => btn.onclick = () => handleFixOut(btn.dataset.idx));
    tbody.querySelectorAll('.fix-present').forEach(btn => btn.onclick = () => handleFixPresent(btn.dataset.idx));

    // Attach events
    tbody.querySelectorAll('.novelty-select').forEach(s => s.onchange = (e) => {
      reportData[e.target.dataset.idx].novelty = e.target.value;
    });
    tbody.querySelectorAll('.auth-check').forEach(c => c.onchange = (e) => {
      reportData[e.target.dataset.idx].is_authorized = e.target.checked;
    });
    tbody.querySelectorAll('.obs-input').forEach(i => i.oninput = (e) => {
      reportData[e.target.dataset.idx].observation = e.target.value;
    });
  }

  async function handleFixOut(idx) {
    try {
      const item = reportData[parseInt(idx)];
      if (!item.attendance_id) return;

      if (!confirm(`¿Cerrar la sesión de ${item.name} usando el horario programado (${item.scheduled_out})?`)) return;

      const [h, m] = item.scheduled_out.split(':');
      const outDate = new Date(selectedDate + 'T00:00:00');
      outDate.setHours(parseInt(h), parseInt(m), 0, 0);

      const { error } = await supabase.from('attendance')
        .update({ 
          check_out: outDate.toISOString(),
          metadata: { correction: 'administrative_close', corrected_at: new Date().toISOString() }
        })
        .eq('id', item.attendance_id);

      if (error) {
        showNotification('Error al corregir: ' + error.message, 'error');
      } else {
        showNotification('Sesión cerrada correctamente.', 'success');
        item.novelty = 'Sin novedad';
        item.is_authorized = true;
        await loadReport();
      }
    } catch (e) {
      console.error(e);
      showNotification('Error al cerrar sesión: ' + e.message, 'error');
    }
  }

  async function handleFixPresent(idx) {
    try {
      const item = reportData[parseInt(idx)];
      if (!confirm(`¿Marcar a ${item.name} como PRESENTE MANUAL para este día?`)) return;

      const schedulePart = item.schedule ? item.schedule.split(' - ')[0] : '08:00';
      const [h, m] = schedulePart.split(':'); 
      const entryDate = new Date(selectedDate + 'T00:00:00');
      entryDate.setHours(parseInt(h || 8), parseInt(m || 0), 0, 0);

      const { error } = await supabase.from('attendance').insert({
        user_id: item.user_id,
        check_in: entryDate.toISOString(),
        check_out: entryDate.toISOString(), // Simplificado
        status: 'present',
        metadata: { correction: 'manual_presence', corrected_at: new Date().toISOString() }
      });

      if (error) {
        showNotification('Error: ' + error.message, 'error');
      } else {
        showNotification('Presencia registrada.', 'success');
        item.novelty = 'Sin novedad';
        item.is_authorized = true;
        await loadReport();
      }
    } catch (e) {
      console.error(e);
      showNotification('Error al registrar presencia: ' + e.message, 'error');
    }
  }

  function checkUnresolvedNovelties() {
    const unresolved = reportData.filter(d => d.novelty !== 'Sin novedad' && !d.is_authorized);
    if (unresolved.length > 0) {
      const names = unresolved.map(d => `${d.name} (${d.novelty})`).join('\n• ');
      return confirm(
        `⚠️ ¡ATENCIÓN! Se detectó personal con incumplimiento de horario o ausencias que NO han sido autorizados en el parte:\n\n• ${names}\n\n¿Deseas continuar de todas formas?`
      );
    }
    return true;
  }

  async function saveReport() {
    try {
      if (reportData.length === 0) {
        showNotification('No hay datos para guardar. Carga el reporte primero.', 'warning');
        return;
      }

      // Check for unresolved novelties before saving
      if (!checkUnresolvedNovelties()) {
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const btn = container.querySelector('#save-report');
      
      // Check if already exists for overwrite warning
      const { data: existing } = await supabase.from('daily_reports').select('id').eq('date', selectedDate).maybeSingle();
      
      if (existing && !confirm('Ya existe un parte para esta fecha. ¿Deseas sobreescribirlo con la información actual?')) {
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Guardando...';

      const { data: report, error: rError } = await supabase.from('daily_reports').upsert({
        date: selectedDate,
        created_by: user.id,
        status: 'consolidated',
        updated_at: new Date().toISOString()
      }, { onConflict: 'date' }).select().single();

      if (rError) throw rError;

      const items = reportData.map(d => ({
        report_id: report.id,
        user_id: d.user_id,
        novelty: d.novelty,
        is_authorized: d.is_authorized,
        observation: d.observation
      }));

      // Delete old items first to ensure clean state if overwriting
      await supabase.from('daily_report_items').delete().eq('report_id', report.id);
      
      const { error: iError } = await supabase.from('daily_report_items').insert(items);
      if (iError) throw iError;

      // Sincronizar los cambios en caliente con la tabla 'attendance' (ingreso/egreso) y registrar las licencias administrativas correspondientes
      const syncPromises = reportData.map(async (d) => {
        let statusKey = 'present';
        if (d.novelty === 'TARDANZA') statusKey = 'late';
        else if (d.novelty.toLowerCase().includes('ausente')) statusKey = 'absent';

        const ADMIN_LICENSES = [
          'Ausente con aviso',
          'Permiso de media jornada',
          'Permisos de salida excepcional',
          'Ausente por medico',
          'Ausente por enfermdad de largo tratamiento',
          'Atención de familiar enfermo',
          'Ausente por Mapaternidad',
          'Matrimonio',
          'Fallecimiento',
          'Examen'
        ];

        if (ADMIN_LICENSES.includes(d.novelty)) {
          const startOfDay = new Date(selectedDate + 'T00:00:00.000Z').toISOString();
          const endOfDay = new Date(selectedDate + 'T23:59:59.999Z').toISOString();

          // Verificar si ya existe esa autorización para el usuario ese día
          const { data: existingAuth } = await supabase.from('authorizations')
            .select('id')
            .eq('user_id', d.user_id)
            .eq('type', d.novelty)
            .gte('start_date', startOfDay)
            .lte('start_date', endOfDay)
            .maybeSingle();

          if (!existingAuth) {
            await supabase.from('authorizations').insert({
              user_id: d.user_id,
              type: d.novelty,
              start_date: startOfDay,
              end_date: endOfDay,
              status: 'approved',
              approved_by: user.id,
              notes: 'Impuesto por Dirección / RRHH / Vicedirección en el Parte Diario.',
              admin_notes: 'Generado automáticamente desde la consolidación del parte diario.'
            });
          }
        }

        if (d.attendance_id) {
          // Si ya existe el registro de asistencia, lo actualizamos directamente
          const { error } = await supabase.from('attendance')
            .update({
              status: statusKey,
              is_justified: d.is_authorized,
              justification_note: d.observation,
              notes: d.observation
            })
            .eq('id', d.attendance_id);
          if (error) console.error(`Error al actualizar asistencia para user ${d.user_id}:`, error);
        } else if (statusKey !== 'present' || d.observation || d.is_authorized) {
          // Si no existe pero tiene novedades cargadas en el parte, creamos el registro de asistencia correspondiente
          const schedulePart = d.schedule ? d.schedule.split(' - ')[0] : '08:00';
          const [h, m] = schedulePart.split(':');
          const entryDate = new Date(selectedDate + 'T00:00:00');
          entryDate.setHours(parseInt(h || 8), parseInt(m || 0), 0, 0);

          const { error } = await supabase.from('attendance')
            .insert({
              user_id: d.user_id,
              check_in: entryDate.toISOString(),
              check_out: entryDate.toISOString(),
              status: statusKey,
              is_justified: d.is_authorized,
              justification_note: d.observation,
              notes: d.observation,
              metadata: { correction: 'consolidated_report_sync', corrected_at: new Date().toISOString() }
            });
          if (error) console.error(`Error al insertar asistencia para user ${d.user_id}:`, error);
        }
      });

      await Promise.all(syncPromises);

      showNotification('Parte Diario consolidado y sincronizado con éxito', 'success');
      await loadReport();
    } catch (err) {
      console.error('Error saving report:', err);
      showNotification('Error al guardar: ' + err.message, 'error');
    } finally {
      const btn = container.querySelector('#save-report');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Guardar / Consolidar';
      }
    }
  }

  function generatePDF() {
    if (reportData.length === 0) {
      showNotification('No hay datos para exportar. Carga el reporte primero.', 'warning');
      return;
    }

    // Check for unresolved novelties before printing/generating PDF
    if (!checkUnresolvedNovelties()) {
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(10);
    doc.text('FECHA:', 10, 15);
    doc.setFont(undefined, 'bold');
    const [year, month, day] = selectedDate.split('-');
    doc.text(`${day}/${month}/${year}`, 10, 20);
    doc.setFont(undefined, 'normal');

    // Table settings
    const colLegajo = 10;
    const colNombre = 32;
    const colNovedad = 95;
    const colAuth = 133;
    const colObs = 150;
    let y = 30;

    // Header Table
    doc.setDrawColor(0);
    doc.line(10, y, 200, y); // Top
    doc.text('Legajo', colLegajo + 2, y + 5);
    doc.text('Nombre y Apellido', colNombre + 2, y + 5);
    doc.text('Novedad', colNovedad + 2, y + 5);
    doc.text('Autorizado', colAuth + 1, y + 3);
    doc.setFontSize(8);
    doc.text('SI', colAuth + 2, y + 8);
    doc.text('NO', colAuth + 10, y + 8);
    doc.setFontSize(10);
    doc.text('Observación', colObs + 2, y + 5);
    
    y += 10;
    doc.line(10, y, 200, y); // Row Line

    // Content
    reportData.forEach(item => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(String(item.legajo), colLegajo + 2, y + 5);
      doc.text(item.name.substring(0, 26), colNombre + 2, y + 5);
      doc.text(item.novelty.substring(0, 18), colNovedad + 2, y + 5);
      
      // Checkboxes
      doc.rect(colAuth + 2, y + 2, 4, 4); // SI
      doc.rect(colAuth + 10, y + 2, 4, 4); // NO
      if (item.is_authorized) doc.text('X', colAuth + 3, y + 5);
      else if (item.novelty !== 'Sin novedad') doc.text('X', colAuth + 11, y + 5);

      doc.text((item.observation || '').substring(0, 24), colObs + 2, y + 5);

      y += 8;
      doc.line(10, y, 200, y);
    });

    // Vertical Lines
    doc.line(10, 30, 10, y); // Left
    doc.line(colNombre, 30, colNombre, y);
    doc.line(colNovedad, 30, colNovedad, y);
    doc.line(colAuth, 30, colAuth, y);
    doc.line(colAuth + 8.5, 40, colAuth + 8.5, y);
    doc.line(colObs, 30, colObs, y);
    doc.line(200, 30, 200, y); // Right

    doc.save(`Parte_Diario_${selectedDate}.pdf`);
    showNotification('PDF generado con éxito', 'success');
  }

  // CALENDAR LOGIC
  let calendarYear = now.getFullYear();
  let calendarMonth = now.getMonth(); // 0-indexed

  async function updateCalendar() {
    const daysContainer = container.querySelector('#calendar-days');
    const titleSpan = container.querySelector('#calendar-title');
    if (!daysContainer || !titleSpan) return;

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    titleSpan.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

    // Get first day of month and total days
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    // Adjust for Monday start (0=Monday, 6=Sunday)
    let startDayIndex = firstDay.getDay();
    if (startDayIndex === 0) startDayIndex = 6;
    else startDayIndex -= 1;

    // Fetch reports for this month
    const monthStr = String(calendarMonth + 1).padStart(2, '0');
    const startStr = `${calendarYear}-${monthStr}-01`;
    const endStr = `${calendarYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    try {
      const { data: reports } = await supabase.from('daily_reports')
        .select('date, status')
        .gte('date', startStr)
        .lte('date', endStr);

      const reportsMap = new Map();
      if (reports) {
        reports.forEach(r => reportsMap.set(r.date, r.status));
      }

      let daysHtml = '';

      // Empty paddings for previous month's days
      for (let i = 0; i < startDayIndex; i++) {
        daysHtml += `<div style="padding: 6px;"></div>`;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Generate month days
      for (let day = 1; day <= lastDay; day++) {
        const currentDayStr = `${calendarYear}-${monthStr}-${String(day).padStart(2, '0')}`;
        const hasReport = reportsMap.has(currentDayStr);
        const isSelected = selectedDate === currentDayStr;

        let cellStyle = `cursor: pointer; border-radius: 4px; padding: 6px; font-weight: 600; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s; aspect-ratio: 1; border: 1px solid transparent; `;
        
        if (hasReport) {
          // Green cell
          cellStyle += `background: rgba(16, 185, 129, 0.15); color: #10B981; border-color: rgba(16, 185, 129, 0.3);`;
        } else {
          // Red cell if in the past or today, otherwise standard grey
          if (currentDayStr <= todayStr) {
            cellStyle += `background: rgba(239, 68, 68, 0.15); color: #EF4444; border-color: rgba(239, 68, 68, 0.3);`;
          } else {
            cellStyle += `background: rgba(255, 255, 255, 0.05); color: var(--text-muted);`;
          }
        }

        if (isSelected) {
          cellStyle += `outline: 2px solid var(--accent); outline-offset: 1px; box-shadow: 0 0 8px var(--accent); font-weight: bold;`;
        }

        daysHtml += `
          <button class="calendar-day-btn" data-date="${currentDayStr}" style="${cellStyle}" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
            ${day}
          </button>
        `;
      }

      daysContainer.innerHTML = daysHtml;

      // Attach click events
      daysContainer.querySelectorAll('.calendar-day-btn').forEach(btn => {
        btn.onclick = () => {
          selectedDate = btn.dataset.date;
          const dateInput = container.querySelector('#report-date');
          if (dateInput) dateInput.value = selectedDate;
          updateCalendar();
          loadReport();
        };
      });
    } catch (e) {
      console.error('Error loading calendar:', e);
    }
  }

  // Wire up calendar navigation
  const prevBtn = container.querySelector('#prev-month');
  const nextBtn = container.querySelector('#next-month');
  
  if (prevBtn) {
    prevBtn.onclick = () => {
      calendarMonth--;
      if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
      }
      updateCalendar();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      calendarMonth++;
      if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
      }
      updateCalendar();
    };
  }

  // Sync date input with calendar highlights
  const dateInput = container.querySelector('#report-date');
  if (dateInput) {
    dateInput.onchange = (e) => {
      selectedDate = e.target.value;
      const [y, m, d] = selectedDate.split('-').map(Number);
      if (y && m) {
        calendarYear = y;
        calendarMonth = m - 1; // 0-indexed
      }
      updateCalendar();
      loadReport();
    };
  }

  container.querySelector('#load-report').onclick = async () => {
    await loadReport();
    updateCalendar();
  };

  container.querySelector('#save-report').onclick = async () => {
    await saveReport();
    updateCalendar();
  };

  container.querySelector('#generate-pdf').onclick = generatePDF;

  // Initialize view
  updateCalendar();
  // Cargar automáticamente si ya viene una fecha seleccionada
  loadReport();
}
