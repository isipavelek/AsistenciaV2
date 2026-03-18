import { supabase } from '../lib/supabase.js';
import { clearSettingsCache } from '../lib/settings.js';
import { showNotification } from '../lib/notifications.js';

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

      <div class="dashboard-grid settings-grid">
        <!-- Location Settings -->
        <div class="card glass">
          <h3 class="card-title"><i data-lucide="map-pin"></i> Ubicación del Establecimiento</h3>
          <form id="location-form">
            <div class="form-group">
              <label>Buscar Dirección</label>
              <div class="search-box">
                <input type="text" id="loc-address-search" placeholder="Ej: Av. 123, Buenos Aires">
                <button type="button" id="search-addr-btn" class="btn-icon-sq">
                  <i data-lucide="search"></i>
                </button>
              </div>
            </div>
            <div class="form-group-row">
              <div class="form-group">
                <label>Latitud</label>
                <input type="number" step="any" id="loc-lat" value="${loc.lat}" required>
              </div>
              <div class="form-group">
                <label>Longitud</label>
                <input type="number" step="any" id="loc-lng" value="${loc.lng}" required>
              </div>
            </div>
            <div class="form-group">
              <label>Radio de Fichaje (metros)</label>
              <input type="number" id="loc-radius" value="${loc.radius_meters}" required>
            </div>
            <div id="settings-map"></div>
            <button type="submit" class="save-btn" style="background: var(--success); margin-top: 1rem;">Guardar Ubicación</button>
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
            
            <div class="rules-hours-container">
              <div class="form-group">
                <label>Horas: Administrativo</label>
                <input type="number" id="rule-hours-admin" value="${rules.hours_by_group?.Administrativo || 6}" required>
              </div>
              <div class="form-group">
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

        <!-- Attendance Period -->
        <div class="card glass">
          <h3 class="card-title"><i data-lucide="calendar-range"></i> Período de Control de Asistencia</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">
            Define el rango de fechas en el que se contabilizarán las inasistencias. 
            Fuera de este rango, el sistema no marcará ausencias automáticas.
          </p>
          <form id="period-form">
            <div class="form-group">
              <label>Fecha de Inicio del Ciclo</label>
              <input type="date" id="period-start" value="${settings.attendance_period?.start_date || ''}" required>
            </div>
            <div class="form-group">
              <label>Fecha de Fin del Ciclo</label>
              <input type="date" id="period-end" value="${settings.attendance_period?.end_date || ''}" required>
            </div>
            <button type="submit" class="save-btn" style="background: var(--accent-gradient);">Guardar Período</button>
          </form>
        </div>
      </div>

      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  // Initialize Map
  let map, marker, circle;
  const latInput = container.querySelector('#loc-lat');
  const lngInput = container.querySelector('#loc-lng');
  const radiusInput = container.querySelector('#loc-radius');

  setTimeout(() => {
    const startLat = parseFloat(latInput.value) || -34.5920;
    const startLng = parseFloat(lngInput.value) || -58.7266;
    const startRadius = parseInt(radiusInput.value) || 100;

    if (window.L) {
      map = L.map('settings-map').setView([startLat, startLng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
      circle = L.circle([startLat, startLng], { radius: startRadius }).addTo(map);

      // Map Click
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        latInput.value = lat.toFixed(7);
        lngInput.value = lng.toFixed(7);
      });

      // Marker Drag
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        circle.setLatLng([lat, lng]);
        latInput.value = lat.toFixed(7);
        lngInput.value = lng.toFixed(7);
      });

      // Input synchronization
      const updateFromInputs = () => {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        const radius = parseInt(radiusInput.value);
        if (!isNaN(lat) && !isNaN(lng)) {
          const pos = [lat, lng];
          marker.setLatLng(pos);
          circle.setLatLng(pos);
          map.panTo(pos);
        }
        if (!isNaN(radius)) {
          circle.setRadius(radius);
        }
      };

      // Address Search (Geocoding)
      const searchAddrBtn = container.querySelector('#search-addr-btn');
      const addressInput = container.querySelector('#loc-address-search');

      searchAddrBtn.onclick = async () => {
        const query = addressInput.value;
        if (!query) return;

        searchAddrBtn.disabled = true;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
          const results = await response.json();
          if (results.length > 0) {
            const { lat, lon } = results[0];
            const newLat = parseFloat(lat);
            const newLng = parseFloat(lon);
            
            latInput.value = newLat.toFixed(7);
            lngInput.value = newLng.toFixed(7);
            updateFromInputs();
            map.setZoom(17);
          } else {
            showNotification('No se encontró la dirección.', 'error');
          }
        } catch (e) {
          console.error('Geocoding error:', e);
          showNotification('Error al buscar la dirección.', 'error');
        } finally {
          searchAddrBtn.disabled = false;
        }
      };

      latInput.addEventListener('input', updateFromInputs);
      lngInput.addEventListener('input', updateFromInputs);
      radiusInput.addEventListener('input', updateFromInputs);
      
      // Fix map render issue in some containers
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, 100);

  // Handlers
  const handleSave = async (key, value, btn) => {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';

    try {
      console.log('Attempting Upsert...', key);
      const { error: upsertError } = await supabase
        .from('settings')
        .upsert({ 
          key, 
          value, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });
      
      if (upsertError) {
        console.error('Upsert failed:', upsertError);
        throw upsertError;
      }

      console.log('SUCCESS via UPSERT');
      showNotification('Configuración guardada correctamente.', 'success');
      clearSettingsCache();
      
      // Update local settings object if needed
      if (settings) settings[key] = value;

    } catch (err) {
      console.error('CRITICAL SAVE ERROR:', err);
      showNotification('Error al guardar: ' + (err.message || err.details || 'Error desconocido'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };

  container.querySelector('#location-form').onsubmit = (e) => {
    e.preventDefault();
    const val = {
      lat: parseFloat(container.querySelector('#loc-lat').value),
      lng: parseFloat(container.querySelector('#loc-lng').value),
      radius_meters: parseInt(container.querySelector('#loc-radius').value)
    };
    handleSave('school_location', val, container.querySelector('#location-form button[type=\"submit\"]'));
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
    handleSave('business_rules', val, container.querySelector('#rules-form button[type=\"submit\"]'));
  };
  
  container.querySelector('#period-form').onsubmit = (e) => {
    e.preventDefault();
    const val = {
      start_date: container.querySelector('#period-start').value,
      end_date: container.querySelector('#period-end').value
    };
    handleSave('attendance_period', val, container.querySelector('#period-form button[type=\"submit\"]'));
  };

  if (window.lucide) window.lucide.createIcons();
}
