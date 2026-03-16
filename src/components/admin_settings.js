import { supabase } from '../lib/supabase.js';
import { clearSettingsCache } from '../lib/settings.js';
import { showToast } from '../lib/ui.js';

/**
 * Renders the Admin Settings view
 */
export async function renderAdminSettings(container, settings) {
  const loc = settings.school_location;
  const rules = settings.business_rules;

  container.innerHTML = `
    <div class="animate-in">
      <h2 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem;">
        <i data-lucide="settings"></i> Configuración del Sistema
      </h2>

      <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
        <!-- Location Settings -->
        <div class="card glass">
          <h3 class="card-title"><i data-lucide="map-pin"></i> Ubicación del Establecimiento</h3>
          <form id="location-form">
            <div class="form-group">
              <label>Latitud</label>
              <input type="number" step="any" id="loc-lat" value="${loc.lat}" required>
            </div>
            <div class="form-group">
              <label>Longitud</label>
              <input type="number" step="any" id="loc-lng" value="${loc.lng}" required>
            </div>
            <div class="form-group">
              <label>Radio de Fichaje (metros)</label>
              <input type="number" id="loc-radius" value="${loc.radius_meters}" required>
            </div>
            <button type="submit" class="save-btn" style="background: var(--success);">Guardar Ubicación</button>
          </form>
        </div>

        <!-- Business Rules -->
        <div class="card glass">
          <h3 class="card-title"><i data-lucide="clock"></i> Reglas de Negocio</h3>
          <form id="rules-form">
            <div class="form-group">
              <label>Tolerancia de Llegada (minutos)</label>
              <input type="number" id="rule-tolerance" value="${rules.tolerance_minutes}" required>
            </div>
            
            <div style="display: flex; gap: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem; margin-top: 1rem;">
              <div class="form-group" style="flex: 1;">
                <label>Horas: Administrativo</label>
                <input type="number" id="rule-hours-admin" value="${rules.hours_by_group?.Administrativo || 6}" required>
              </div>
              <div class="form-group" style="flex: 1;">
                <label>Horas: Serv. Grales</label>
                <input type="number" id="rule-hours-sg" value="${rules.hours_by_group?.['Servicios Generales'] || 7}" required>
              </div>
            </div>

            <div class="form-group">
              <label>Max. Justificaciones de Tardanza / Mes</label>
              <input type="number" id="rule-max-late" value="${rules.max_late_justifications_month}" required>
            </div>
            <button type="submit" class="save-btn" style="background: var(--secondary); color: white;">Guardar Reglas</button>
          </form>
        </div>
      </div>

      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  // Handlers
  const handleSave = async (key, value, btn) => {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';

    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) {
      showToast('Error: ' + error.message, 'error');
    } else {
      showToast('Configuración actualizada con éxito.', 'success');
      clearSettingsCache();
      // Update local object
      settings[key] = value;
    }
    btn.disabled = false;
    btn.textContent = originalText;
  };

  container.querySelector('#location-form').onsubmit = (e) => {
    e.preventDefault();
    const val = {
      lat: parseFloat(container.querySelector('#loc-lat').value),
      lng: parseFloat(container.querySelector('#loc-lng').value),
      radius_meters: parseInt(container.querySelector('#loc-radius').value)
    };
    handleSave('school_location', val, e.target.querySelector('button'));
  };

  container.querySelector('#rules-form').onsubmit = (e) => {
    e.preventDefault();
    const val = {
      tolerance_minutes: parseInt(container.querySelector('#rule-tolerance').value),
      max_late_justifications_month: parseInt(container.querySelector('#rule-max-late').value),
      hours_by_group: {
        'Administrativo': parseInt(container.querySelector('#rule-hours-admin').value),
        'Servicios Generales': parseInt(container.querySelector('#rule-hours-sg').value)
      }
    };
    handleSave('business_rules', val, e.target.querySelector('button'));
  };

  if (window.lucide) window.lucide.createIcons();
}
