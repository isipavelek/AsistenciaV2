import { StatsEngine } from '../lib/stats_engine.js';

/**
 * Renders the User Statistics and History view
 */
export async function renderUserStats(container, userId) {
  container.innerHTML = `
    <div class="animate-in">
      <h2 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem;">
        <i data-lucide="bar-chart-2"></i> Mis Estadísticas e Historial
      </h2>
      
      <div id="stats-loading" class="card glass" style="text-align: center; padding: 3rem;">
        <p>Cargando estadísticas...</p>
      </div>

      <div id="stats-content" style="display: none;">
        <!-- Summary Cards -->
        <div class="stats-grid">
          <div class="stat-box">
            <span class="value" id="stat-present">-</span>
            <span class="label">Presentes</span>
          </div>
          <div class="stat-box">
            <span class="value" id="stat-late" style="color: var(--warning);">-</span>
            <span class="label">Tardanzas</span>
          </div>
          <div class="stat-box">
            <span class="value" id="stat-absent" style="color: var(--error);">-</span>
            <span class="label">Ausentes</span>
          </div>
        </div>

        <div class="dashboard-grid">
          <!-- Convention Limits -->
          <div class="card glass">
            <h3 class="card-title"><i data-lucide="shield-check"></i> Control de Convenio (Anual)</h3>
            <div id="limits-container">
              <p class="text-dim">Calculando saldos...</p>
            </div>
          </div>

          <!-- History Table -->
          <div class="card glass">
            <h3 class="card-title"><i data-lucide="history"></i> Mi Historial Reciente</h3>
            <div class="table-container">
              <table style="width: 100%;">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody id="history-body">
                  <!-- History rows -->
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  try {
    const stats = await StatsEngine.getUserStats(userId);
    
    // Fill Cards
    container.querySelector('#stat-present').textContent = stats.present;
    container.querySelector('#stat-late').textContent = stats.late;
    container.querySelector('#stat-absent').textContent = stats.absent;

    // Fill Limits
    const limitsContainer = container.querySelector('#limits-container');
    limitsContainer.innerHTML = '';
    
    Object.entries(stats.limits_usage).forEach(([type, data]) => {
      const percentage = Math.min(100, (data.used / data.max_year) * 100);
      const colorClass = percentage > 80 ? 'danger' : (percentage > 50 ? 'warning' : '');
      
      const item = document.createElement('div');
      item.className = 'limit-item';
      item.innerHTML = `
        <div class="limit-header">
          <span>${type}</span>
          <span class="text-dim">${data.used} / ${data.max_year}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${colorClass}" style="width: ${percentage}%"></div>
        </div>
        <div style="text-align: right; font-size: 0.75rem; margin-top: 0.25rem;">
          Quedan: ${data.remaining}
        </div>
      `;
      limitsContainer.appendChild(item);
    });

    // Fill History
    const historyBody = container.querySelector('#history-body');
    historyBody.innerHTML = stats.history.length ? '' : '<tr><td colspan="4" style="text-align:center">No hay registros este año</td></tr>';
    
    stats.history.slice(0, 10).forEach(rec => {
      const row = document.createElement('tr');
      const dateStr = new Date(rec.check_in).toLocaleDateString();
      const checkIn = new Date(rec.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const checkOut = rec.check_out ? new Date(rec.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
      
      let statusHtml = `<span class="badge badge-${rec.status === 'present' ? 'success' : (rec.status === 'late' ? 'warning' : 'danger')}">${rec.status}</span>`;
      if (rec.is_justified) statusHtml += ' <span class="badge" style="background: var(--primary);">Justificado</span>';
      if (rec.is_compensated) statusHtml += ' <span class="badge" style="background: var(--secondary);">Compensado</span>';

      row.innerHTML = `
        <td>${dateStr}</td>
        <td>${checkIn}</td>
        <td>${checkOut}</td>
        <td>${statusHtml}</td>
      `;
      historyBody.appendChild(row);
    });

    container.querySelector('#stats-loading').style.display = 'none';
    container.querySelector('#stats-content').style.display = 'block';

  } catch (error) {
    console.error('Error loading stats:', error);
    container.querySelector('#stats-loading').innerHTML = `<p style="color:var(--error)">Error al cargar estadísticas: ${error.message}</p>`;
  }

  if (window.lucide) window.lucide.createIcons();
}
