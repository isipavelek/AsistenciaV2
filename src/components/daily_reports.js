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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="clipboard-list"></i> Parte Diario</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button id="generate-pdf" style="width: auto; padding: 0.5rem 1rem; background: var(--secondary); color: white;">
            <i data-lucide="file-text" style="width: 16px;"></i> Generar PDF
          </button>
        </div>
      </div>

      <div class="card glass filters-bar" style="display: flex; align-items: flex-end; gap: 1rem; margin-bottom: 2rem;">
        <div class="form-group" style="margin-bottom:0">
          <label>Fecha del Parte</label>
          <input type="date" id="report-date" value="${selectedDate}">
        </div>
        <button id="load-report" style="width: auto; height: 42px; background: var(--accent-gradient);">Cargar / Consolidar</button>
        <button id="save-report" style="width: auto; height: 42px; background: var(--surface);">Guardar / Consolidar</button>
      </div>

      <div class="card glass" style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
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
            <tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">Selecciona una fecha y carga el reporte.</td></tr>
          </tbody>
        </table>
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
        supabase.from('authorizations')
          .select('*')
          .or(`and(start_date.lte.${selectedDate},end_date.gte.${selectedDate}),and(start_date.eq.${selectedDate},end_date.is.null)`)
      ]);

      if (resProfiles.error) throw resProfiles.error;
      if (resSchedules.error) throw resSchedules.error;
      if (resAttendance.error) throw resAttendance.error;
      if (resAuths.error) throw resAuths.error;

      const profiles = resProfiles.data || [];
      const schedules = resSchedules.data || [];
      const attendance = resAttendance.data || [];
      const holiday = resHoliday.data;
      const existingReport = resExisting.data;
      const allAuths = resAuths.data || [];

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

      reportData = profiles.filter(p => schedules.some(s => s.user_id === p.id)).map(p => {
        const schedule = schedules.find(s => s.user_id === p.id);
        const record = attendance.find(a => a.user_id === p.id);
        const auth = allAuths.find(a => a.user_id === p.id);
        const existingItem = existingReport?.items.find(i => i.user_id === p.id);

        let novelty = 'Sin novedad';
        let isAuthorized = false;
        let isHoliday = !!holiday;
        let isPending = auth?.status === 'pending';

        if (holiday) {
          novelty = `FERIADO: ${holiday.description.toUpperCase()}`;
          isAuthorized = true;
        } else if (auth) {
          if (auth.status === 'approved') {
            novelty = auth.type.toUpperCase();
            isAuthorized = true;
          } else if (auth.status === 'pending') {
            novelty = `${auth.type.toUpperCase()} (PENDIENTE)`;
            isAuthorized = false;
          } else if (auth.status === 'rejected' && !record) {
            novelty = 'AUSENTE (LIC. RECHAZADA)';
            isAuthorized = false;
          }
        } else if (existingItem && existingReport.status === 'draft') {
          // Keep manual edits if it's a draft we are reloading? 
          // Re-evaluate: user wants to "pisar" but usually manual is first.
          // We'll prioritize the auto-logic for now as requested.
          novelty = existingItem.novelty;
          isAuthorized = existingItem.is_authorized;
        } else if (!record) {
          // Check if date is within attendance period
          const period = settings?.attendance_period;
          const isInPeriod = period && selectedDate >= period.start_date && selectedDate <= period.end_date;

          if (isInPeriod) {
            novelty = 'AUSENTE';
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
            novelty = record.is_late ? 'TARDANZA' : 'Sin novedad';
            isAuthorized = !record.is_late;
          }
        }

        return {
          user_id: p.id,
          attendance_id: record?.id,
          legajo: p.legajo_utn || '---',
          name: `${p.last_name} ${p.first_name}`.toUpperCase(),
          schedule: `${schedule.start_time} - ${schedule.end_time}`,
          scheduled_out: schedule.end_time,
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

    tbody.innerHTML = reportData.map((item, idx) => `
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
            `<select class="novelty-select" data-idx="${idx}" style="font-size: 0.85rem; padding: 0.25rem; ${item.novelty === 'AUSENTE' ? 'color: var(--danger); font-weight: bold;' : ''}">
              <option value="Sin novedad" ${item.novelty === 'Sin novedad' ? 'selected' : ''}>Sin novedad</option>
              <option value="AUSENTE" ${item.novelty === 'AUSENTE' ? 'selected' : ''}>AUSENTE</option>
              <option value="AUSENTE POR MEDICO" ${item.novelty === 'AUSENTE POR MEDICO' ? 'selected' : ''}>AUSENTE POR MEDICO</option>
              <option value="AUSENTE ART" ${item.novelty === 'AUSENTE ART' ? 'selected' : ''}>AUSENTE ART</option>
              <option value="TARDANZA" ${item.novelty === 'TARDANZA' ? 'selected' : ''}>TARDANZA</option>
              <option value="MEDIA JORNADA" ${item.novelty === 'MEDIA JORNADA' ? 'selected' : ''}>MEDIA JORNADA</option>
              <option value="${item.novelty}" ${!['Sin novedad','AUSENTE','AUSENTE POR MEDICO','AUSENTE ART','TARDANZA','MEDIA JORNADA'].includes(item.novelty) ? 'selected' : ''}>${item.novelty}</option>
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
            ${item.novelty === 'AUSENTE' ? `
              <button class="action-btn fix-present" data-idx="${idx}" title="Marcar como presente manual" style="background: var(--secondary); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.75rem;">
                <i data-lucide="check-circle" style="width: 14px;"></i> Presente
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');

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
    const item = reportData[idx];
    if (!item.attendance_id) return;

    if (!confirm(`¿Cerrar la sesión de ${item.name} usando el horario programado (${item.scheduled_out})?`)) return;

    const [h, m] = item.scheduled_out.split(':');
    const outDate = new Date(selectedDate);
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
      renderTable();
    }
  }

  async function handleFixPresent(idx) {
    const item = reportData[idx];
    if (!confirm(`¿Marcar a ${item.name} como PRESENTE MANUAL para este día?`)) return;

    const [h, m] = item.schedule.split(' - ')[0].split(':'); 
    const entryDate = new Date(selectedDate);
    entryDate.setHours(parseInt(h), parseInt(m), 0, 0);

    const { error } = await supabase.from('attendance').insert({
      user_id: item.user_id,
      check_in: entryDate.toISOString(),
      check_out: entryDate.toISOString(), // Simplified placeholder for manual
      status: 'present',
      metadata: { correction: 'manual_presence', corrected_at: new Date().toISOString() }
    });

    if (error) {
      showNotification('Error: ' + error.message, 'error');
    } else {
      showNotification('Presencia registrada.', 'success');
      item.novelty = 'Sin novedad';
      item.is_authorized = true;
      renderTable();
    }
  }

  async function saveReport() {
    try {
      if (reportData.length === 0) {
        showNotification('No hay datos para guardar. Carga el reporte primero.', 'warning');
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

      showNotification('Parte Diario consolidado con éxito', 'success');
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
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(10);
    doc.text('FECHA:', 14, 15);
    doc.setFont(undefined, 'bold');
    doc.text(new Date(selectedDate).toLocaleDateString('es-AR'), 14, 20);
    doc.setFont(undefined, 'normal');

    // Table settings
    const colLegajo = 14;
    const colNombre = 35;
    const colNovedad = 110;
    const colAuth = 175;
    let y = 30;

    // Header Table
    doc.setDrawColor(0);
    doc.line(14, y, 196, y); // Top
    doc.text('Legajo', colLegajo + 2, y + 5);
    doc.text('Nombre y Apellido', colNombre + 2, y + 5);
    doc.text('Novedad', colNovedad + 2, y + 5);
    doc.text('Autorizado', colAuth + 1, y + 3);
    doc.setFontSize(8);
    doc.text('SI', colAuth + 2, y + 8);
    doc.text('NO', colAuth + 12, y + 8);
    doc.setFontSize(10);
    
    y += 10;
    doc.line(14, y, 196, y); // Row Line

    // Content
    reportData.forEach(item => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(String(item.legajo), colLegajo + 2, y + 5);
      doc.text(item.name.substring(0, 35), colNombre + 2, y + 5);
      doc.text(item.novelty, colNovedad + 2, y + 5);
      
      // Checkboxes
      doc.rect(colAuth + 2, y + 2, 4, 4); // SI
      doc.rect(colAuth + 12, y + 2, 4, 4); // NO
      if (item.is_authorized) doc.text('X', colAuth + 3, y + 5);
      else if (item.novelty !== 'Sin novedad') doc.text('X', colAuth + 13, y + 5);

      y += 8;
      doc.line(14, y, 196, y);
    });

    // Vertical Lines
    doc.line(14, 30, 14, y); // Left
    doc.line(colNombre, 30, colNombre, y);
    doc.line(colNovedad, 30, colNovedad, y);
    doc.line(colAuth, 30, colAuth, y);
    doc.line(colAuth + 10, 40, colAuth + 10, y);
    doc.line(196, 30, 196, y); // Right

    doc.save(`Parte_Diario_${selectedDate}.pdf`);
    showNotification('PDF generado con éxito', 'success');
  }

  container.querySelector('#load-report').onclick = loadReport;
  container.querySelector('#save-report').onclick = saveReport;
  container.querySelector('#generate-pdf').onclick = generatePDF;
}
