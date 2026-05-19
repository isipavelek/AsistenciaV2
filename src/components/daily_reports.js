import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';

/**
 * Renders the Daily Report module
 */
export async function renderDailyReports(container, settings) {
  const now = new Date();
  let selectedDate = now.toISOString().split('T')[0];
  let reportData = [];

  const [initY, initM, initD] = selectedDate.split('-');
  const initialFormattedDate = initY ? `${initD}/${initM}/${initY}` : selectedDate;

  container.innerHTML = `
    <div class="animate-in" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="daily-reports-header">
        <h2 style="display: flex; align-items: center; gap: 0.5rem; margin: 0;"><i data-lucide="clipboard-list"></i> Parte Diario</h2>
      </div>

      <!-- Compact Redesigned Horizontal Calendar (Centered & Balanced) -->
      <div class="card glass calendar-top-card" style="padding: 1rem 1.5rem; display: flex; gap: 2rem; align-items: center; justify-content: space-between; border: 1px solid var(--glass-border); border-radius: 12px; background: var(--glass-bg); max-width: 800px; width: 100%; margin: 0 auto;">
        <!-- Left Side: Compact Controls & Legend -->
        <div style="display: flex; align-items: center; gap: 1.5rem; border-right: 1px solid var(--glass-border); padding-right: 1.5rem; min-width: 320px;">
          <!-- Month Picker -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="prev-month" class="btn-icon" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: var(--text-normal); font-size: 1rem; cursor: pointer; padding: 6px 12px; border-radius: 6px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">&lt;</button>
            <span id="calendar-title" style="font-weight: 700; font-size: 1.1rem; color: var(--text-normal); min-width: 130px; text-align: center; display: inline-block; white-space: nowrap;">Cargando...</span>
            <button id="next-month" class="btn-icon" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: var(--text-normal); font-size: 1rem; cursor: pointer; padding: 6px 12px; border-radius: 6px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">&gt;</button>
          </div>
          <!-- Legend -->
          <div class="calendar-legend" style="display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; color: var(--text-muted);">
            <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: rgba(16, 185, 129, 0.4); border: 1px solid #10B981; display: inline-block;"></span> Generado</div>
            <div style="display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); border: 1px solid #EF4444; display: inline-block;"></span> Faltante</div>
          </div>
        </div>

        <!-- Right Side: Compact Days Grid -->
        <div style="flex-grow: 1; max-width: 420px; margin-left: auto;">
          <div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; text-align: center; font-size: 0.8rem; margin-bottom: 4px; font-weight: 600;">
            <div style="color: var(--text-muted);">Lu</div>
            <div style="color: var(--text-muted);">Ma</div>
            <div style="color: var(--text-muted);">Mi</div>
            <div style="color: var(--text-muted);">Ju</div>
            <div style="color: var(--text-muted);">Vi</div>
            <div style="color: var(--text-muted); font-weight: bold;">Sá</div>
            <div style="color: var(--text-muted); font-weight: bold;">Do</div>
          </div>
          <div id="calendar-days" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
            <!-- Days will go here dynamically -->
          </div>
        </div>
      </div>

      <!-- Unified Compact Controls & Actions Bar (Directly above table) -->
      <div class="card glass table-control-bar" style="padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--glass-border); border-radius: 8px; background: rgba(255, 255, 255, 0.02); margin-top: 0.5rem; flex-wrap: wrap; gap: 1rem;">
        <!-- Compact Date Badge -->
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 8px; cursor: pointer;" onclick="document.getElementById('report-date').showPicker()">
            <i data-lucide="calendar" style="width: 16px; height: 16px; color: var(--accent);"></i>
            <span id="selected-date-badge" style="font-weight: 700; font-size: 0.95rem; color: var(--text-normal);">${initialFormattedDate}</span>
          </div>
          <input type="date" id="report-date" value="${selectedDate}" style="display: none;">
        </div>

        <!-- Sleek Buttons Group -->
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button id="load-report" style="width: auto; height: 36px; padding: 0 14px; font-size: 0.85rem; font-weight: 600; background: var(--accent-gradient); border-radius: 6px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Cargar
          </button>
          <button id="save-report" style="width: auto; height: 36px; padding: 0 14px; font-size: 0.85rem; font-weight: 600; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10B981; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(16, 185, 129, 0.25)'" onmouseout="this.style.background='rgba(16, 185, 129, 0.15)'">
            <i data-lucide="save" style="width: 14px; height: 14px;"></i> Guardar
          </button>
          <button id="delete-report" style="width: auto; height: 36px; padding: 0 14px; font-size: 0.85rem; font-weight: 600; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Eliminar
          </button>
          <button id="generate-pdf" style="width: auto; height: 36px; padding: 0 14px; font-size: 0.85rem; font-weight: 600; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); color: var(--text-normal); border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> Exportar PDF
          </button>
        </div>
      </div>

      <!-- Main Report Table -->
      <div class="card glass table-wrapper" style="margin-top: 0;">
        <table class="daily-report-table">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: 1rem;">Personal / Legajo</th>
              <th style="padding: 1rem; width: 120px;">Horario</th>
              <th style="padding: 1rem; width: 220px;">Novedad</th>
              <th style="padding: 1rem; text-align: center; width: 100px;">Autorizado</th>
              <th style="padding: 1rem;">Observación</th>
            </tr>
          </thead>
          <tbody id="daily-report-body">
            <tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">Selecciona una fecha del calendario superior para cargar el reporte.</td></tr>
          </tbody>
        </table>
      </div>

      <button id="back-to-dash" style="margin-top: 1rem; background: var(--surface);">Volver al Dashboard</button>
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

      // Update Date Badge Display
      const [badgeY, badgeM, badgeD] = selectedDate.split('-');
      const badgeText = badgeY ? `${badgeD}/${badgeM}/${badgeY}` : selectedDate;
      const badgeElem = container.querySelector('#selected-date-badge');
      if (badgeElem) badgeElem.textContent = badgeText;
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
          
          <td data-label="Personal" style="padding: 1rem; ${item.is_pending ? 'border-left: 4px solid var(--warning);' : ''}">
            <div style="font-weight: 600; color: var(--text-normal); font-size: 0.95rem;">${item.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 8px;">
              <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--glass-border);">Legajo: ${item.legajo}</span>
              ${item.is_pending ? '<span style="color: var(--warning); font-weight: bold; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px;"><i data-lucide="alert-triangle" style="width:12px; height:12px;"></i> LICENCIA PENDIENTE</span>' : ''}
            </div>
          </td>
          
          <td data-label="Horario" style="padding: 1rem; color: var(--text-normal); font-size: 0.85rem; font-weight: 500;">
            ${item.schedule.replace(' - ', '<br><span style="color:var(--text-muted); font-size:0.75rem;">hasta</span> ')}
          </td>
          
          <td data-label="Novedad" style="padding: 1rem;">
            ${item.is_holiday ? 
              `<span style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-weight: bold; font-size: 0.8rem; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2); display: inline-block;">${item.novelty}</span>` :
              `<select class="novelty-select" data-idx="${idx}" style="font-size: 0.85rem; padding: 0.4rem 0.6rem; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid ${isRed ? 'rgba(239, 68, 68, 0.3)' : 'var(--glass-border)'}; ${isRed ? 'color: var(--danger); font-weight: bold; background: rgba(239, 68, 68, 0.05);' : 'color: var(--text-normal);'} transition: all 0.2s; outline: none; cursor: pointer; width: 100%;">
                ${optionsHtml}
              </select>`
            }
          </td>
          
          <td data-label="Autorizado" style="padding: 1rem; text-align: center;">
            <label style="display: inline-flex; align-items: center; justify-content: center; cursor: pointer; position: relative;">
              <input type="checkbox" class="auth-check" data-idx="${idx}" ${item.is_authorized ? 'checked' : ''} ${item.is_holiday ? 'disabled' : ''} style="opacity: 0; position: absolute; width: 20px; height: 20px; cursor: pointer;">
              <div class="custom-cb" style="width: 20px; height: 20px; border-radius: 6px; border: 2px solid ${item.is_authorized ? '#10B981' : 'var(--glass-border)'}; background: ${item.is_authorized ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.02)'}; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                <i data-lucide="check" style="width: 14px; height: 14px; color: ${item.is_authorized ? '#10B981' : 'transparent'}; stroke-width: 3;"></i>
              </div>
            </label>
          </td>
          
          <td data-label="Observación" style="padding: 1rem;">
            <input type="text" class="obs-input" data-idx="${idx}" value="${item.observation}" placeholder="Agregar nota..." style="font-size: 0.85rem; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 0.4rem 0.6rem; border-radius: 6px; width: 100%; color: var(--text-normal); transition: all 0.2s;" onfocus="this.style.borderColor='var(--accent)'; this.style.background='rgba(255,255,255,0.05)';" onblur="this.style.borderColor='var(--glass-border)'; this.style.background='rgba(255,255,255,0.02)';">
          </td>
          
          <td data-label="Acciones" style="padding: 1rem; text-align: right;">
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
              ${item.novelty === 'SESIÓN ABIERTA' ? `
                <button class="action-btn fix-out" data-idx="${idx}" title="Cerrar salida con horario programado" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='rgba(245, 158, 11, 0.25)'" onmouseout="this.style.background='rgba(245, 158, 11, 0.15)'">
                  <i data-lucide="log-out" style="width: 14px; height: 14px;"></i> Cerrar
                </button>
              ` : ''}
              ${item.novelty.toLowerCase().includes('ausente') ? `
                <button class="action-btn fix-present" data-idx="${idx}" title="Marcar como presente manual" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='rgba(16, 185, 129, 0.25)'" onmouseout="this.style.background='rgba(16, 185, 129, 0.15)'">
                  <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Presente
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
        status: 'final'
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
        btn.innerHTML = '<i data-lucide="save" style="width: 14px; height: 14px;"></i> Guardar';
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  async function deleteReport() {
    try {
      if (!selectedDate) {
        showNotification('Selecciona una fecha válida', 'warning');
        return;
      }

      // Check if report exists
      const { data: existing, error: checkError } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('date', selectedDate)
        .maybeSingle();

      if (checkError) throw checkError;

      if (!existing) {
        showNotification('No existe ningún parte guardado para esta fecha', 'warning');
        return;
      }

      if (!confirm(`¿Estás completamente seguro de que deseas eliminar permanentemente el parte del día ${selectedDate}? Esta acción borrará todos sus registros y no se puede deshacer.`)) {
        return;
      }

      const deleteBtn = container.querySelector('#delete-report');
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Eliminando...';

      // Perform delete - cascade deletes report items automatically!
      const { error: dError } = await supabase
        .from('daily_reports')
        .delete()
        .eq('id', existing.id);

      if (dError) throw dError;

      showNotification('Parte diario eliminado con éxito', 'success');
      
      // Reset local reportData and UI state
      reportData = [];
      renderTable();
      updateCalendar();
    } catch (err) {
      console.error('Error deleting report:', err);
      showNotification('Error al eliminar: ' + err.message, 'error');
    } finally {
      const deleteBtn = container.querySelector('#delete-report');
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Eliminar';
        if (window.lucide) window.lucide.createIcons();
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
        daysHtml += `<div style="width: 28px; height: 28px; display: inline-block;"></div>`;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Generate month days
      for (let day = 1; day <= lastDay; day++) {
        const currentDayStr = `${calendarYear}-${monthStr}-${String(day).padStart(2, '0')}`;
        const hasReport = reportsMap.has(currentDayStr);
        const isSelected = selectedDate === currentDayStr;

        let cellStyle = `cursor: pointer; border-radius: 6px; padding: 4px; font-weight: 600; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s; aspect-ratio: 1; border: 1px solid transparent; width: 28px; height: 28px; max-width: 28px; max-height: 28px; margin: 0 auto; `;
        
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

  container.querySelector('#delete-report').onclick = deleteReport;
  container.querySelector('#generate-pdf').onclick = generatePDF;

  // Initialize view
  updateCalendar();
  // Cargar automáticamente si ya viene una fecha seleccionada
  loadReport();
}
