import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';

/**
 * Renders the Advanced Reports Dashboard
 */
export async function renderAdvancedReports(container) {
  // Fetch users for the filter
  const { data: users } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .order('last_name');

  let selectedUserId = 'all';
  let startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  let endDate = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="bar-chart-big"></i> Reportes Avanzados</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button id="export-advanced-csv" style="width: auto; padding: 0.5rem 1rem; background: var(--surface);">
            <i data-lucide="download" style="width: 16px;"></i> CSV
          </button>
          <button id="export-advanced-pdf" style="width: auto; padding: 0.5rem 1rem; background: var(--secondary); color: white;">
            <i data-lucide="file-text" style="width: 16px;"></i> PDF
          </button>
        </div>
      </div>

      <div class="filters-bar card glass">
        <div class="form-group">
          <label>Usuario</label>
          <select id="filter-user">
            <option value="all">Todos los usuarios</option>
            ${users?.map(u => `<option value="${u.id}">${u.last_name}, ${u.first_name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Desde</label>
          <input type="date" id="filter-start" value="${startDate}">
        </div>
        <div class="form-group">
          <label>Hasta</label>
          <input type="date" id="filter-end" value="${endDate}">
        </div>
        <button id="apply-filters" style="width: auto; height: 42px; background: var(--accent-gradient);">Filtrar</button>
      </div>

      <div id="reports-stats-container" class="stats-grid">
        <!-- Stats will load here -->
      </div>

      <div id="license-usage-container" class="card glass" style="margin-bottom: 2rem; display: none;">
        <h3 class="card-title"><i data-lucide="info"></i> Resumen de Licencias (Mes Actual)</h3>
        <div id="license-stats" style="display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 1rem;">
          <!-- License counts here -->
        </div>
      </div>

      <div id="chart-section" class="card glass" style="margin-bottom: 2rem; min-height: 250px;">
        <h3 class="card-title">Tendencia de Asistencia</h3>
        <div id="main-chart" class="chart-container">
          <!-- Chart bars will load here -->
        </div>
      </div>

      <div class="card glass" style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: 1rem;">Fecha</th>
              <th style="padding: 1rem;">Personal</th>
              <th style="padding: 1rem;">Entrada</th>
              <th style="padding: 1rem;">Estado</th>
              <th style="padding: 1rem;">Doc</th>
              <th style="padding: 1rem;">Justificación</th>
              <th style="padding: 1rem;">Acción</th>
            </tr>
          </thead>
          <tbody id="reports-table-body">
            <!-- Rows will load here -->
          </tbody>
        </table>
      </div>

      <!-- Modal Justificación con Archivo -->
      <div id="justify-modal" class="modal-overlay" style="display: none;">
        <div class="card glass modal-content" style="max-width: 400px; width: 90%;">
          <h3>Justificar Inasistencia</h3>
          <p id="justify-user-name" style="color: var(--text-muted); font-size: 0.875rem;"></p>
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
    startDate = container.querySelector('#filter-start').value;
    endDate = container.querySelector('#filter-end').value;

    let query = supabase
      .from('attendance')
      .select('*, profiles(first_name, last_name)')
      .gte('check_in', startDate + 'T00:00:00')
      .lte('check_in', endDate + 'T23:59:59')
      .order('check_in', { ascending: false });

    if (selectedUserId !== 'all') {
      query = query.eq('user_id', selectedUserId);
    }

    const { data: records, error } = await query;

    if (error) {
      showNotification(error.message, 'error');
      return;
    }

    renderStats(records);
    renderTable(records);
    renderChart(records);
    
    if (selectedUserId !== 'all') {
      renderLicenseUsage(selectedUserId);
    } else {
      container.querySelector('#license-usage-container').style.display = 'none';
    }
  }

  async function renderLicenseUsage(userId) {
    const { data: auths } = await supabase
      .from('authorizations')
      .select('type')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .gte('start_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    const usage = {};
    auths?.forEach(a => usage[a.type] = (usage[a.type] || 0) + 1);

    const containerDiv = container.querySelector('#license-usage-container');
    const statsDiv = container.querySelector('#license-stats');
    
    containerDiv.style.display = 'block';
    statsDiv.innerHTML = Object.keys(usage).length ? 
      Object.keys(usage).map(type => `
        <div style="text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold; color: var(--secondary);">${usage[type]}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${type}</div>
        </div>
      `).join('') : '<p style="color: var(--text-muted);">Sin licencias usadas este mes.</p>';
    
    if (window.lucide) window.lucide.createIcons();
  }

  function renderStats(records) {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late' && !r.is_justified).length;
    const justified = records.filter(r => r.is_justified).length;

    const statsContainer = container.querySelector('#reports-stats-container');
    statsContainer.innerHTML = `
      <div class="card glass stat-card">
        <span class="stat-label">Total Registros</span>
        <span class="stat-value">${total}</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">A Tiempo</span>
        <span class="stat-value" style="background: var(--success); -webkit-background-clip: text;">${present}</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">Tardanzas Reales</span>
        <span class="stat-value" style="background: var(--secondary); -webkit-background-clip: text;">${late}</span>
      </div>
      <div class="card glass stat-card">
        <span class="stat-label">Justificadas</span>
        <span class="stat-value" style="background: #10b981; -webkit-background-clip: text;">${justified}</span>
      </div>
    `;
  }

  function renderTable(records) {
    const tbody = container.querySelector('#reports-table-body');
    tbody.innerHTML = records.map(r => `
      <tr style="border-bottom: 1px solid var(--glass-border);">
        <td style="padding: 1rem;">${new Date(r.check_in).toLocaleDateString()}</td>
        <td style="padding: 1rem;">${r.profiles.last_name}, ${r.profiles.first_name}</td>
        <td style="padding: 1rem;">${new Date(r.check_in).toLocaleTimeString()}</td>
        <td style="padding: 1rem;">
          <span class="badge ${r.status === 'present' ? 'badge-present' : (r.status === 'late' ? 'badge-late' : 'badge-absent')}">${r.status.toUpperCase()}</span>
        </td>
        <td style="padding: 1rem;">
          ${r.document_path ? `<a href="${supabase.storage.from('justificativos').getPublicUrl(r.document_path).data.publicUrl}" target="_blank" title="Ver comprobante"><i data-lucide="file-text" style="width: 18px; color: var(--secondary);"></i></a>` : '--'}
        </td>
        <td style="padding: 1rem;">
          ${r.is_justified ? 
            `<span class="badge badge-justified" title="${r.justification_note || ''}">JUSTIFICADO</span>` : 
            (r.status === 'late' ? `<span class="badge badge-pending">PENDIENTE</span>` : '--')
          }
        </td>
        <td style="padding: 1rem;">
          ${r.status === 'late' && !r.is_justified ? 
            `<button class="justify-btn" data-id="${r.id}" data-name="${r.profiles.last_name}, ${r.profiles.first_name}" style="width: auto; padding: 0.25rem 0.5rem; background: var(--secondary); font-size: 0.75rem;">Justificar</button>` : 
            '--'
          }
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.justify-btn').forEach(btn => {
      btn.onclick = () => {
        const { id, name } = btn.dataset;
        container.querySelector('#justify-record-id').value = id;
        container.querySelector('#justify-user-name').textContent = `Usuario: ${name}`;
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
        status: 'present'
      })
      .eq('id', id);

    if (error) {
      showNotification(error.message, 'error');
    } else {
      showNotification('Registro justificado correctamente', 'success');
      container.querySelector('#justify-modal').style.display = 'none';
      loadData();
    }
    btn.disabled = false;
    btn.textContent = 'Confirmar Justificación';
  };

  function renderChart(records) {
    const chartContainer = container.querySelector('#main-chart');
    const dayGroups = {};
    
    // Sort records to show trend correctly
    const sorted = [...records].reverse();
    
    sorted.forEach(r => {
      const day = new Date(r.check_in).toLocaleDateString('es-AR', { weekday: 'short' });
      dayGroups[day] = (dayGroups[day] || 0) + 1;
    });

    const days = Object.keys(dayGroups);
    const max = Math.max(...Object.values(dayGroups), 1);

    chartContainer.innerHTML = days.map(day => {
      const val = dayGroups[day];
      const height = (val / max) * 100;
      return `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
          <div class="chart-bar" style="height: ${height}%; width: 30px;" data-value="${val}"></div>
          <span class="chart-label">${day}</span>
        </div>
      `;
    }).join('');
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

  container.querySelector('#export-advanced-csv').onclick = () => {
    // Basic CSV export logic
    showNotification('Generando archivo...', 'info');
    // ... CSV logic similar to previous but with detail
  };

  // Initial load
  loadData();
  if (window.lucide) window.lucide.createIcons();
}
