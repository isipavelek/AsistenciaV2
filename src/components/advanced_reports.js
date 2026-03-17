import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';
import { getUserStats, getConventionLimits } from '../lib/stats_engine.js';

/**
 * Renders the Advanced Reports Dashboard
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
    .select('id, first_name, last_name')
    .order('last_name');

  const now = new Date();
  let selectedUserId = 'all';
  let selectedYear = now.getFullYear();
  let selectedMonth = now.getMonth();

  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="bar-chart-big"></i> Reportes y Convenio</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button id="export-advanced-csv" style="width: auto; padding: 0.5rem 1rem; background: var(--surface);">
            <i data-lucide="download" style="width: 16px;"></i> CSV
          </button>
          <button id="export-advanced-pdf" style="width: auto; padding: 0.5rem 1rem; background: var(--secondary); color: white;">
            <i data-lucide="file-text" style="width: 16px;"></i> PDF
          </button>
        </div>
      </div>

      <div class="filters-bar card glass" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; align-items: flex-end;">
        <div class="form-group" style="margin-bottom:0">
          <label>Usuario</label>
          <select id="filter-user">
            <option value="all">Todos los usuarios</option>
            ${users?.map(u => `<option value="${u.id}">${u.last_name}, ${u.first_name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Año</label>
          <select id="filter-year">
            ${[selectedYear, selectedYear-1].map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Mes</label>
          <select id="filter-month">
            <option value="all">Todo el año</option>
            ${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => `
              <option value="${i}" ${i === selectedMonth ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>
        <button id="apply-filters" style="width: auto; height: 42px; background: var(--accent-gradient);">Ver Estadísticas</button>
      </div>

      <div id="convention-dashboard" style="display: none; margin-bottom: 2rem;">
        <!-- Convention stats load here -->
      </div>

      <div id="reports-stats-container" class="stats-grid">
        <!-- Stats will load here -->
      </div>

      <div class="card glass" style="margin-top: 2rem; overflow-x: auto;">
        <h3 class="card-title" style="padding: 1rem 1rem 0 1rem;"><i data-lucide="list"></i> Historial de Registros</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: 1rem;">Fecha</th>
              <th style="padding: 1rem;">Personal</th>
              <th style="padding: 1rem;">Entrada</th>
              <th style="padding: 1rem;">Estado</th>
              <th style="padding: 1rem;">Doc</th>
              <th style="padding: 1rem;">Justificación / Auditoría</th>
              <th style="padding: 1rem;">Acción</th>
            </tr>
          </thead>
          <tbody id="reports-table-body">
            <!-- Rows will load here -->
          </tbody>
        </table>
      </div>

      <!-- Chart Section -->
      <div id="chart-section" class="card glass" style="margin-top: 2rem; min-height: 400px; display: flex; flex-direction: column;">
        <h3 class="card-title">Análisis de Asistencia</h3>
        <div style="flex: 1; position: relative;">
          <canvas id="main-chart-canvas"></canvas>
        </div>
      </div>

      <div id="justify-modal" class="modal-overlay" style="display: none;">
        <div class="card glass modal-content" style="max-width: 400px; width: 90%;">
          <h3>Justificar Registros</h3>
          <p id="justify-user-name" style="color: var(--text-base); font-size: 1rem; margin-bottom: 0.5rem;"></p>
          <p id="justify-record-type" style="color: var(--text-muted); font-size: 0.875rem;"></p>
          <form id="justify-form" style="margin-top: 1.5rem;">
            <input type="hidden" id="justify-record-id">
            <div class="form-group">
              <label>Nota de Justificación</label>
              <textarea id="justify-note" placeholder="Ej: Certificado médico presentado" style="width: 100%; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem;"></textarea>
            </div>
            <div class="form-group">
              <label>Adjuntar Comprobante (Opcional)</label>
              <input type="file" id="justify-file" accept="image/*,.pdf" style="background: var(--surface);">
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
              <button type="submit" id="save-justify" style="background: var(--accent-gradient);">Confirmar Justificación</button>
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
    selectedYear = parseInt(container.querySelector('#filter-year').value);
    const monthVal = container.querySelector('#filter-month').value;
    selectedMonth = monthVal === 'all' ? null : parseInt(monthVal);

    let startDate, endDate;
    if (selectedMonth !== null) {
      startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
    } else {
      startDate = `${selectedYear}-01-01`;
      endDate = `${selectedYear}-12-31`;
    }

    // Fetch Attendance with Auditor profile
    let query = supabase
      .from('attendance')
      .select('*, profiles:user_id(first_name, last_name), auditor:justified_by(first_name, last_name)')
      .gte('created_at', `${startDate}T00:00:00.000Z`)
      .lte('created_at', `${endDate}T23:59:59.999Z`)
      .order('created_at', { ascending: false });

    if (selectedUserId !== 'all') {
      query = query.eq('user_id', selectedUserId);
    }

    const { data: records, error } = await query;
    if (error) { showNotification(error.message, 'error'); return; }

    // Fetch Holidays for the range
    const { data: hRange } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);
    
    const holidayMap = new Map(hRange?.map(h => [h.date, h]) || []);

    // If a specific user is selected, show convention dashboard
    if (selectedUserId !== 'all') {
      const stats = await getUserStats(selectedUserId, selectedYear, selectedMonth);
      const limits = await getConventionLimits();
      renderConventionDashboard(stats, limits);
      container.querySelector('#convention-dashboard').style.display = 'block';
    } else {
      container.querySelector('#convention-dashboard').style.display = 'none';
    }

    renderStats(records);
    renderTable(records);
    renderChart(records);
  }

  async function renderConventionDashboard(stats, limits) {
    const dashboard = container.querySelector('#convention-dashboard');
    
    dashboard.innerHTML = `
      <div class="card glass" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
          <div>
            <h3 class="card-title"><i data-lucide="award"></i> Cumplimiento de Convenio</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem;">Estadísticas basadas en tus días laborales programados (excluyendo feriados).</p>
          </div>
          <div class="attendance-circle">
            <span class="value">${stats.attendanceRate}%</span>
            <span class="label">Asistencia</span>
          </div>
        </div>

        <div class="convention-grid">
          ${Object.keys(limits).map(type => {
            const used = stats.licenseUsage[type] || 0;
            const limit = selectedMonth !== null ? limits[type].month : limits[type].year;
            const percentage = Math.min((used / limit) * 100, 100);
            const statusClass = percentage >= 100 ? 'progress-danger' : (percentage > 70 ? 'progress-warning' : 'progress-success');
            
            return `
              <div class="limit-card">
                <div class="limit-header">
                  <span>${type}</span>
                  <span style="font-weight: bold;">${used} / ${limit}</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill ${statusClass}" style="width: ${percentage}%"></div>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                  <span>Uso ${selectedMonth !== null ? 'mensual' : 'anual'}</span>
                  <span>${Math.round(percentage)}%</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  function renderStats(records) {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late' && !r.is_justified).length;
    const justified = records.filter(r => r.status === 'justified' || r.is_justified).length;

    const statsContainer = container.querySelector('#reports-stats-container');
    const nonWorkingDays = records.reduce((acc, r) => {
       const isHoliday = holidayMap.has(new Date(r.check_in || r.created_at).toISOString().split('T')[0]);
       return acc + (isHoliday ? 1 : 0);
    }, 0);

    statsContainer.innerHTML = `
      <div class="card glass stat-card">
        <span class="stat-label">Total Entradas</span>
        <span class="stat-value">${total}</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">Presentes</span>
        <span class="stat-value" style="background: var(--success); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">${present}</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">Feriados / No Lab.</span>
        <span class="stat-value" style="background: var(--secondary); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">${nonWorkingDays}</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">Justificadas</span>
        <span class="stat-value" style="background: #10b981; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">${justified}</span>
      </div>
    `;
  }

  function renderTable(records) {
    const tbody = container.querySelector('#reports-table-body');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--text-muted);">Sin registros en este periodo.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(r => {
      const date = r.check_in || r.created_at;
      const recIsoDate = new Date(date).toISOString().split('T')[0];
      const holidayInfo = holidayMap.get(recIsoDate);
      
      const isJustified = r.is_justified || r.status === 'justified' || !!holidayInfo;
      const justifiedBy = holidayInfo ? 'CALENDARIO' : (r.auditor ? `${r.auditor.last_name}, ${r.auditor.first_name[0]}.` : 'N/A');
      
      let actionBtn = '--';
      const canJustifyAbsent = isDirector && r.status === 'absent' && !holidayInfo;
      const canJustifyLate = r.status === 'late' && !r.is_justified && !holidayInfo;

      if ((canJustifyAbsent || canJustifyLate) && !isJustified) {
        actionBtn = `<button class="justify-btn" data-id="${r.id}" data-name="${r.profiles?.last_name || 'User'}" data-status="${r.status}" style="width: auto; padding: 0.25rem 0.5rem; background: var(--secondary); font-size: 0.75rem;">Justificar</button>`;
      }

      return `
        <tr style="border-bottom: 1px solid var(--glass-border);">
          <td style="padding: 1rem;">${new Date(date).toLocaleDateString()}</td>
          <td style="padding: 1rem;">${r.profiles?.last_name || 'N/A'}, ${r.profiles?.first_name || 'N/A'}</td>
          <td style="padding: 1rem;">${r.check_in ? new Date(r.check_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</td>
          <td style="padding: 1rem;">
            <span class="badge ${holidayInfo ? 'badge-justified' : 'badge-' + r.status}">${holidayInfo ? holidayInfo.type.toUpperCase() : (r.status === 'present' ? 'PRESENTO' : (r.status === 'late' ? 'TARDANZA' : (r.status === 'justified' ? 'JUSTIFICADO' : 'AUSENTE')))}</span>
          </td>
          <td style="padding: 1rem;">
            ${r.document_path ? `<a href="${supabase.storage.from('justificativos').getPublicUrl(r.document_path).data.publicUrl}" target="_blank" title="Ver comprobante"><i data-lucide="file-text" style="width: 18px; color: var(--secondary);"></i></a>` : '--'}
          </td>
          <td style="padding: 1rem;">
            ${isJustified ? 
              `<div style="font-size: 0.75rem;">
                <span class="badge badge-justified" title="${holidayInfo ? holidayInfo.description : (r.justification_note || '')}">JUSTIFICADO</span>
                <div style="color: var(--text-muted); margin-top: 4px;">Por: ${justifiedBy}</div>
              </div>` : 
              (r.status === 'late' || r.status === 'absent' ? `<span class="badge badge-pending">PENDIENTE</span>` : '--')
            }
          </td>
          <td style="padding: 1rem;">${actionBtn}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.justify-btn').forEach(btn => {
      btn.onclick = () => {
        const { id, name, status } = btn.dataset;
        container.querySelector('#justify-record-id').value = id;
        container.querySelector('#justify-user-name').textContent = `Usuario: ${name}`;
        container.querySelector('#justify-record-type').textContent = `Justificando: ${status === 'absent' ? 'AUSENTE (Acción de Director)' : 'TARDANZA'}`;
        container.querySelector('#justify-modal').style.display = 'flex';
      };
    });
  }

  container.querySelector('#close-justify-modal').onclick = () => {
    container.querySelector('#justify-modal').style.display = 'none';
  };

  container.querySelector('#justify-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = container.querySelector('#justify-record-id').value;
    const note = container.querySelector('#justify-note').value;
    const file = container.querySelector('#justify-file').files[0];
    const btn = container.querySelector('#save-justify');

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    let documentPath = null;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('justificativos')
        .upload(fileName, file);

      if (uploadError) {
        showNotification('Error al subir archivo: ' + uploadError.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Confirmar Justificación';
        return;
      }
      documentPath = uploadData.path;
    }

    const { error } = await supabase
      .from('attendance')
      .update({ 
        is_justified: true, 
        justification_note: note,
        document_path: documentPath,
        status: 'justified',
        justified_by: user.id
      })
      .eq('id', id);

    if (error) {
      showNotification(error.message, 'error');
    } else {
      showNotification('Registro justificado y auditado', 'success');
      container.querySelector('#justify-modal').style.display = 'none';
      loadData();
    }
    btn.disabled = false;
    btn.textContent = 'Confirmar Justificación';
  };

  let chartInstance = null;

  function renderChart(records) {
    const ctx = container.querySelector('#main-chart-canvas').getContext('2d');
    
    // Group by status
    const stats = {
      present: records.filter(r => r.status === 'present').length,
      late: records.filter(r => r.status === 'late').length,
      absent: records.filter(r => r.status === 'absent').length,
      justified: records.filter(r => r.status === 'justified' || r.is_justified).length
    };

    if (chartInstance) {
      chartInstance.destroy();
    }

    if (!records.length) {
      return;
    }

    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Presentes', 'Tardanzas', 'Ausentes', 'Justificados'],
        datasets: [{
          label: 'Frecuencia',
          data: [stats.present, stats.late, stats.absent, stats.justified],
          backgroundColor: [
            'rgba(34, 197, 94, 0.6)', // Success
            'rgba(245, 158, 11, 0.6)', // Warning
            'rgba(239, 68, 68, 0.6)',  // Danger
            'rgba(16, 185, 129, 0.6)'  // Justified
          ],
          borderColor: [
            'rgb(34, 197, 94)',
            'rgb(245, 158, 11)',
            'rgb(239, 68, 68)',
            'rgb(16, 185, 129)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#94a3b8'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#94a3b8'
            }
          }
        }
      }
    });
  }

  container.querySelector('#apply-filters').onclick = loadData;
  
  container.querySelector('#export-advanced-pdf').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Planilla de Asistencia - UTN', 20, 20);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 20, 28);
    doc.text(`Rango: ${startDate} al ${endDate}`, 20, 33);
    
    let y = 45;
    doc.setFont(undefined, 'bold');
    doc.text('Fecha', 20, y);
    doc.text('Nombre', 50, y);
    doc.text('Entrada', 100, y);
    doc.text('Estado', 130, y);
    doc.text('Nota', 160, y);
    doc.line(20, y + 2, 190, y + 2);
    
    y += 10;
    doc.setFont(undefined, 'normal');
    
    // Using current data from logic
    const tableData = container.querySelectorAll('#reports-table-body tr');
    tableData.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(cells[0].innerText, 20, y);
      doc.text(cells[1].innerText.substring(0, 20), 50, y);
      doc.text(cells[2].innerText, 100, y);
      doc.text(cells[3].innerText, 130, y);
      doc.text(cells[4].innerText.substring(0, 15), 160, y);
      y += 8;
    });
    
    doc.save(`asistencia_utn_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('PDF generado con éxito', 'success');
  };

  container.querySelector('#export-advanced-csv').onclick = async () => {
    showNotification('Generando reporte consolidado de toda la planta...', 'info');
    
    // Header for CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Legajo,Apellido,Nombre,Asistencia %,Presentes,Tardanzas,Ausentes,Justificados,Dias Laborales Esperados\n";

    try {
      for (const u of users) {
        const stats = await getUserStats(u.id, selectedYear, selectedMonth);
        const row = [
          u.id.substring(0,8), // Legajo placeholder or u.legajo if exists
          u.last_name,
          u.first_name,
          `${stats.attendanceRate}%`,
          stats.present,
          stats.late,
          stats.absent,
          stats.justified,
          stats.expected_working_days
        ].join(",");
        csvContent += row + "\n";
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Reporte_Consolidado_${selectedYear}_${selectedMonth || 'Anual'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showNotification('Reporte CSV generado con éxito', 'success');
    } catch (err) {
      showNotification('Error al generar CSV: ' + err.message, 'error');
    }
  };

  // Initial load
  loadData();
  if (window.lucide) window.lucide.createIcons();
}
