import './style.css';
import { supabase } from './src/lib/supabase.js';
import { calculateDistance, getCurrentPosition } from './src/lib/geo.js';
import { getSettings, resolveStandardHours } from './src/lib/settings.js'; 
import { showNotification } from './src/lib/notifications.js'; 

const app = document.querySelector('#app');

// State management
let session = null;
let profile = null;
let settings = null;

/**
 * Initialize application
 */
async function init() {
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  session = currentSession;

  // Load settings globally
  settings = await getSettings();

  if (session) {
    await fetchProfile();
    renderDashboard();
  } else {
    renderAuth();
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    session = newSession;
    if (session) {
      await fetchProfile();
      renderDashboard();
    } else {
      profile = null;
      renderAuth();
      showNotification('Has cerrado sesión.', 'info'); // Added notification for logout
    }
  });
}

async function fetchProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  
  if (error) {
    console.warn('Profile not found in DB, using session info.', error);
    // Fallback to minimal profile if DB fetch fails
    profile = { 
      id: session.user.id, 
      email: session.user.email,
      first_name: 'Usuario',
      role: 'user' 
    };
  } else {
    profile = data;
  }

  // Force director role for Israel
  if (session.user.email?.toLowerCase() === 'ipavelek@gmail.com') {
    if (profile) profile.role = 'director';
  }
}

/**
 * Render Authentication View
 */
function renderAuth() {
  app.innerHTML = `
    <div class="auth-container glass animate-in">
      <h1 style="text-align: center; margin-bottom: 2rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
        <i data-lucide="clock" style="width: 32px; height: 32px; color: var(--secondary);"></i> UTN Asistencia
      </h1>
      <form id="login-form">
        <div class="form-group">
          <label for="email">Correo Institucional</label>
          <input type="email" id="email" required placeholder="usuario@utn.edu.ar">
        </div>
        <div class="form-group">
          <label for="password">Contraseña</label>
          <input type="password" id="password" required placeholder="••••••••">
        </div>
        <button type="submit" id="login-btn">Iniciar Sesión</button>
      </form>
      <p id="auth-error" style="color: var(--danger); margin-top: 1rem; font-size: 0.875rem; display: none;"></p>
    </div>
  `;

  document.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('#email').value;
    const password = document.querySelector('#password').value;
    const errorEl = document.querySelector('#auth-error');
    const btn = document.querySelector('#login-btn');

    btn.disabled = true;
    btn.textContent = 'Iniciando...';
    errorEl.style.display = 'none';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
      showNotification(error.message, 'error'); // Added notification for login error
    } else {
      showNotification('Sesión iniciada con éxito.', 'success'); // Added notification for successful login
    }
  });
}

/**
 * Render Main Dashboard
 */
import { renderABM, renderAuthorizations, renderReports } from './src/components/admin.js';
import { renderAdvancedReports } from './src/components/advanced_reports.js';
import { renderProfile } from './src/components/profile.js';
import { renderAdminSettings } from './src/components/admin_settings.js';
import { renderHolidays } from './src/components/holidays.js';

async function renderDashboard() {
  const isAdminEmail = session?.user?.email?.toLowerCase() === 'ipavelek@gmail.com';
  const standardHours = resolveStandardHours(profile, settings);

  app.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <div>
        <h1 style="background: var(--accent-gradient); -webkit-background-clip: text; background-clip: text; -webkit-fill-color: transparent; display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="user-circle"></i> Hola, ${profile?.first_name || (isAdminEmail ? 'Israel' : 'Usuario')}
        </h1>
        <p style="color: var(--text-muted)">${profile?.category || (isAdminEmail ? 'Director' : 'Personal No Docente')} - ${profile?.personnel_group || ''}</p>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button id="profile-btn" style="width: auto; padding: 0.5rem 1rem; background: var(--surface); border: 1px solid var(--glass-border); display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="user" style="width: 18px;"></i> Mi Perfil
        </button>
        <button id="logout-btn" style="width: auto; padding: 0.5rem 1rem; background: var(--surface); border: 1px solid var(--glass-border); display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="log-out" style="width: 18px;"></i> Salir
        </button>
      </div>
    </header>

    <div id="main-content">
      <main class="dashboard-grid animate-in">
        <div class="card glass">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="map-pin" style="color: var(--secondary);"></i> Fichaje</h3>
          <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Verificando ubicación...</p>
          <button id="clock-in-btn" disabled>Cargando ubicación...</button>
        </div>

        <div class="card glass" id="stats-card">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="bar-chart-3" style="color: var(--primary-light);"></i> Resumen Mensual</h3>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: -0.5rem; margin-bottom: 2rem;">Objetivo: <strong>${standardHours}h</strong> diarias</p>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
            <div>
              <p class="stat-label">Asistencias</p>
              <p id="count-present" class="stat-value">--</p>
            </div>
            <div>
              <p class="stat-label">Tardanzas</p>
              <p id="count-late" class="stat-value" style="background: linear-gradient(135deg, #ff9900 0%, #ffcc00 100%); -webkit-background-clip: text;">--</p>
            </div>
            <div>
              <p class="stat-label">Faltas</p>
              <p id="count-absent" class="stat-value" style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); -webkit-background-clip: text;">--</p>
            </div>
          </div>
        </div>

        <div class="card glass">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="calendar" style="color: var(--success);"></i> Licencias y Permisos</h3>
          <div id="licenses-list" style="margin-bottom: 1rem;">
            <p style="color: var(--text-muted); font-size: 0.875rem;">Cargando...</p>
          </div>
          <button id="request-auth-btn" style="background: var(--surface); border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <i data-lucide="file-text" style="width: 18px;"></i> Solicitar Permiso
          </button>
        </div>
      </main>

      ${['director', 'vicedirector', 'rrhh'].includes(profile?.role) ? renderAdminSection() : ''}
    </div>
  `;

  document.querySelector('#logout-btn').addEventListener('click', () => supabase.auth.signOut());
  document.querySelector('#profile-btn').addEventListener('click', () => renderProfile(document.querySelector('#main-content'), profile));
  
  if (['director', 'vicedirector', 'rrhh'].includes(profile?.role)) {
    document.querySelector('#nav-abm')?.addEventListener('click', () => renderABM(document.querySelector('#main-content')));
    document.querySelector('#nav-auths')?.addEventListener('click', () => renderAuthorizations(document.querySelector('#main-content')));
    document.querySelector('#nav-holidays')?.addEventListener('click', () => renderHolidays(document.querySelector('#main-content')));
    document.querySelector('#nav-reports')?.addEventListener('click', () => renderAdvancedReports(document.querySelector('#main-content')));
    document.querySelector('#nav-settings')?.addEventListener('click', () => renderAdminSettings(document.querySelector('#main-content'), settings));
  }

  // Handle global "Back to Dashboard" clicks
  app.addEventListener('click', (e) => {
    if (e.target.id === 'back-to-dash') {
      renderDashboard();
    }
  });

  document.querySelector('#request-auth-btn').addEventListener('click', renderRequestForm);
  
  initClockIn();
  fetchStats();
  if (window.lucide) window.lucide.createIcons();
}

function renderRequestForm() {
  const container = document.querySelector('#main-content');
  container.innerHTML = `
    <div class="card glass animate-in" style="max-width: 600px; margin: 0 auto;">
      <h2 style="margin-bottom: 1.5rem;">Solicitar Permiso / Licencia</h2>
      <form id="auth-request-form">
        <div class="form-group">
          <label>Tipo de Permiso</label>
          <select id="auth-type" required style="width: 100%; padding: 0.75rem; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px;">
            <option value="Médico - Corto Tratamiento">Médico - Corto Tratamiento</option>
            <option value="Médico - Largo Tratamiento">Médico - Largo Tratamiento</option>
            <option value="Atención Familiar">Atención Familiar</option>
            <option value="Matrimonio">Matrimonio (10 días)</option>
            <option value="Fallecimiento Familiar">Fallecimiento Familiar</option>
            <option value="Examen">Examen / Estudio</option>
            <option value="Media Jornada">Media Jornada (Art. 87)</option>
            <option value="Salida Excepcional">Salida Excepcional (2hs max)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Fecha de Inicio</label>
          <input type="date" id="auth-start" required>
        </div>
        <div class="form-group">
          <label>Fecha de Fin (opcional)</label>
          <input type="date" id="auth-end">
        </div>
        <div class="form-group">
          <label>Observaciones / Justificación</label>
          <textarea id="auth-notes" placeholder="Detalles adicionales..." style="width: 100%; padding: 0.75rem; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; min-height: 100px;"></textarea>
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button type="submit" style="background: var(--accent-gradient);">Enviar Solicitud</button>
          <button type="button" id="back-to-dash" style="background: var(--surface);">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  document.querySelector('#auth-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    const type = document.querySelector('#auth-type').value;
    const notes = document.querySelector('#auth-notes').value;
    const date = document.querySelector('#auth-start').value; // Assuming 'auth-start' is the primary date field

    if (!date) {
      showNotification('Por favor ingresa una fecha.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const { error } = await supabase.from('authorizations').insert({
      user_id: session.user.id,
      type,
      notes,
      start_date: date,
      status: 'pending'
    });

    if (error) {
      showNotification('Error al enviar solicitud: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Enviar Solicitud';
    } else {
      showNotification('Solicitud enviada con éxito.', 'success');
      renderDashboard();
    }
  });
}

async function fetchStats() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', session.user.id)
    .gte('check_in', firstDay);

  if (attendance) {
    const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const late = attendance.filter(a => a.is_late).length;
    
    document.querySelector('#count-present').textContent = present;
    document.querySelector('#count-late').textContent = late;
    document.querySelector('#count-absent').textContent = '0'; // Logic for absences usually requires checking against workdays
  }

  const { data: licenses } = await supabase
    .from('authorizations')
    .select('*')
    .eq('user_id', session.user.id)
    .gte('start_date', now.toISOString())
    .limit(3);

  const licenseEl = document.querySelector('#licenses-list');
  if (licenses?.length > 0) {
    licenseEl.innerHTML = licenses.map(l => `
      <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 4px;">
        <p style="font-size: 0.875rem;">${l.type}</p>
        <p style="font-size: 0.75rem; color: var(--text-muted);">${new Date(l.start_date).toLocaleDateString()}</p>
      </div>
    `).join('');
  } else {
    licenseEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No tienes licencias programadas.</p>';
  }
}

function renderAdminSection() {
  return `
    <section style="margin-top: 3rem;">
      <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="shield-check"></i> Panel de Administración</h2>
      <div class="dashboard-grid">
        <div class="card glass" style="border-top: 4px solid var(--primary-light);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="users"></i> Gestión de Personal</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Alta, baja y modificación de usuarios.</p>
          <button id="nav-abm" style="margin-top: 1rem; background: var(--surface);">Abrir ABM</button>
        </div>
        <div class="card glass" style="border-top: 4px solid var(--secondary);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="clipboard-check"></i> Autorizaciones Pendientes</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Aprobar o rechazar permisos.</p>
          <button id="nav-auths" style="margin-top: 1rem; background: var(--surface);">Ver Solicitudes</button>
        </div>
        <div class="card glass" style="border-top: 4px solid var(--success);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="file-spreadsheet"></i> Reportes y Estadísticas</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Exportar resúmenes por día/mes.</p>
          <button id="nav-reports" style="margin-top: 1rem; background: var(--surface);">Generar Reporte</button>
        </div>
        <div class="card glass" style="border-top: 4px solid var(--text-muted);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="settings"></i> Configuración Global</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Ubicación, radio y reglas del sistema.</p>
          <button id="nav-settings" style="margin-top: 1rem; background: var(--surface);">Ajustes</button>
        </div>
      </div>
    </section>
  `;
}

async function initClockIn() {
  const btn = document.querySelector('#clock-in-btn');
  const statusText = btn.previousElementSibling;
  
  try {
    const pos = await getCurrentPosition();
    const config = settings?.school_location;
    
    if (!config || !config.lat) {
      throw new Error('Configuración de ubicación no disponible.');
    }

    const distance = calculateDistance(pos.lat, pos.long, config.lat, config.lng);

    if (distance <= config.radius_meters) {
      statusText.textContent = `📍 Estás a ${Math.round(distance)}m. Ubicación validada.`;
      statusText.style.color = 'var(--success)';
      
      // Check if already clocked in today
      const { data: lastRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .is('check_out', null)
        .order('check_in', { ascending: false })
        .limit(1)
        .single();

      if (lastRecord) {
        btn.textContent = 'Fichar Salida';
        btn.onclick = () => handleClockOut(lastRecord.id);
      } else {
        btn.textContent = 'Fichar Entrada';
        btn.onclick = () => handleClockIn(pos);
      }
      btn.disabled = false;
    } else {
      statusText.textContent = `🚫 Estás a ${Math.round(distance)}m. Debes estar en las inmediaciones para fichar.`;
      statusText.style.color = 'var(--danger)';
      btn.textContent = 'Fuera de Rango';
      btn.disabled = true;
      showNotification('Estás fuera del rango permitido para marcar asistencia.', 'error'); // Added notification
    }
  } catch (err) {
    let msg = err.message;
    if (msg.includes('Secure Origins') || msg.includes('secure origin')) {
      msg = 'La geolocalización requiere una conexión segura (HTTPS). Usa Localhost o un túnel HTTPS para móviles.';
    }
    statusText.textContent = `❌ Error: ${msg}`;
    statusText.style.color = 'var(--danger)';
    btn.textContent = 'Error de Ubicación';
    showNotification('Error al obtener ubicación: ' + msg, 'error'); // Added notification
  }
}

async function handleClockIn(pos) {
  const btn = document.querySelector('#clock-in-btn');
  btn.disabled = true;
  btn.textContent = 'Fichando...';

  const entryTime = new Date();
  const dayOfWeek = entryTime.getDay();
  
  // Fetch user schedule for today
  const { data: schedule } = await supabase
    .from('user_schedules')
    .select('start_time')
    .eq('user_id', session.user.id)
    .eq('day_of_week', dayOfWeek)
    .single();

  let isLate = false;
  const rules = settings?.business_rules;
  const tolerance = rules?.tolerance_minutes || 15;

  if (schedule) {
    const [h, m] = schedule.start_time.split(':');
    const scheduledEntry = new Date();
    scheduledEntry.setHours(parseInt(h), parseInt(m), 0, 0);
    const toleranceLimit = new Date(scheduledEntry.getTime() + tolerance * 60000);
    isLate = entryTime > toleranceLimit;
  } else {
    // Fallback if no schedule is defined
    const standardHour = 8;
    const standardEntry = new Date();
    standardEntry.setHours(standardHour, 0, 0, 0);
    const toleranceLimit = new Date(standardEntry.getTime() + tolerance * 60000);
    isLate = entryTime > toleranceLimit;
  }

  const { error } = await supabase.from('attendance').insert({
    user_id: session.user.id,
    check_in: entryTime.toISOString(),
    lat: pos.lat,
    long: pos.long,
    is_late: isLate,
    status: isLate ? 'late' : 'present'
  });

  if (error) {
    showNotification('Error al fichar entrada: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Fichar Entrada';
  } else {
    showNotification('Entrada registrada con éxito.', 'success');
    initClockIn(); // Refresh state
    fetchStats();
  }
}

async function handleClockOut(id) {
  const btn = document.querySelector('#clock-in-btn');
  btn.disabled = true;
  btn.textContent = 'Fichando...';

  const { error } = await supabase.from('attendance')
    .update({ check_out: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    showNotification('Error al fichar salida: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Fichar Salida';
  } else {
    showNotification('Salida registrada con éxito.', 'success');
    initClockIn(); // Refresh state
  }
}

init();
