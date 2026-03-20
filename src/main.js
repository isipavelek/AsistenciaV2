import '../style.css';
import { supabase } from './lib/supabase.js';
import { calculateDistance, getCurrentPosition } from './lib/geo.js';
import { renderABM, renderAuthorizations, renderReports, renderLogs, renderSecurityPanel } from './components/admin.js';
import { renderAdvancedReports } from './components/advanced_reports.js';
import { renderProfile } from './components/profile.js';
import { renderAdminSettings } from './components/admin_settings.js';
import { renderAnalytics } from './components/analytics.js';
import { renderHolidays } from './components/holidays.js';
import { renderDailyReports } from './components/daily_reports.js';
import { renderUserStats } from './components/user_stats.js';
import { getSettings, resolveStandardHours } from './lib/settings.js'; 
import { showNotification } from './lib/notifications.js'; 
import { downloadICS } from './lib/calendar.js';
import { Html5Qrcode } from 'html5-qrcode';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Mostrar el botón de instalación si existe en el DOM
  const installBtn = document.querySelector('#install-pwa-btn');
  if (installBtn) installBtn.style.display = 'flex';
});

// Global Error Handling View
function showGlobalErrorScreen(errorMsg) {
  const appContainer = document.querySelector('#app');
  if (appContainer) {
    appContainer.innerHTML = `
      <div style="padding: 2rem; color: #f87171; background: #0f172a; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-family: sans-serif;">
        <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #f87171; margin-bottom: 1.5rem;"></i>
        <h1 style="font-size: 1.5rem; color: white; margin-bottom: 1rem;">Se ha producido un error técnico</h1>
        <p style="color: #94a3b8; max-width: 400px; margin-bottom: 2rem;">${errorMsg}</p>
        <button onclick="location.reload()" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: bold;">
          Recargar Aplicación
        </button>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

// Global Exception Handlers
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Fatal Application Error:', {message, source, lineno, colno, error});
  showGlobalErrorScreen(message || 'Error desconocido');
  return true;
};

window.onunhandledrejection = function(event) {
  console.error('Unhandled Promise Rejection:', event.reason);
  showGlobalErrorScreen(event.reason?.message || 'Error en proceso asíncrono');
};

const app = document.querySelector('#app');

// State management
let session = null;
let profile = null;
let settings = null;
let isResetModalOpen = false;
let isGeoLoading = false;
let isDashboardRendering = false; // Flag to prevent race conditions during init

/**
 * Initialize application
 */
async function init() {
  console.log('--- APP INIT START ---');

  // Register auth listener immediately to catch PASSWORD_RECOVERY even if init setup fails
  supabase.auth.onAuthStateChange(async (event, newSession) => {
    const oldSession = session;
    session = newSession;
    console.log('Auth event:', event, session ? 'Session active' : 'No session');
    
    // Handle specific events
    if (event === 'SIGNED_OUT') {
      profile = null;
      renderAuth();
      showNotification('Has cerrado sesión.', 'info');
      return;
    }

    if (event === 'PASSWORD_RECOVERY') {
      if (!isResetModalOpen) {
        renderAuth();
        showResetPasswordModal();
      }
      return;
    }

    // Skip if we are currently rendering the dashboard to avoid race conditions
    if (isDashboardRendering) return;

    if (session) {
      if (!window.location.hash.includes('type=recovery')) {
        // Only run if the session is actually "new" or refresh (avoid redundant renders)
        if (!oldSession || oldSession.access_token !== session.access_token) {
          console.log('Session updated/new, loading dashboard...');
          await fetchProfile();
          await renderDashboard();
        }
      }
    } else {
      profile = null;
      renderAuth();
    }
  });

  try {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    session = currentSession;

    // Load settings globally
    settings = await getSettings();

    if (app) {
      app.addEventListener('click', (e) => {
        // Delegate 'back-to-dash' clicks
        const backBtn = e.target.closest('#back-to-dash');
        if (backBtn) {
          renderDashboard();
        }
      });
    }

    if (session) {
      if (!window.location.hash.includes('type=recovery')) {
        await fetchProfile();
        await renderDashboard();
      }
    } else {
      renderAuth();
    }
  } catch (err) {
    console.error('INIT ERROR:', err);
    // Don't show hard error screen if it's a recovery attempt
    if (!window.location.hash.includes('type=recovery')) {
      showGlobalErrorScreen(err.message);
    }
  }
}

async function fetchProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  
  if (error) {
    console.warn('Profile not found in DB, using session info.', error);
    const isAdminEmail = session.user.email?.toLowerCase() === 'ipavelek@gmail.com';
    profile = { 
      id: session.user.id, 
      email: session.user.email,
      first_name: isAdminEmail ? 'Israel (Local)' : 'Usuario',
      role: isAdminEmail ? 'director' : 'user' 
    };
  } else {
    profile = data;
  }

  if (session.user.email?.toLowerCase() === 'ipavelek@gmail.com') {
    if (profile) {
      profile.role = 'director';
      if (profile.first_name === 'Usuario') profile.first_name = 'Israel';
    }
  }
}

function renderAuth() {
  console.log('--- RENDERING AUTH ---');
  if (!app) {
    console.error('CRITICAL: #app element not found!');
    return;
  }
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
      <div style="text-align: center; margin-top: 1rem;">
        <a href="#" id="forgot-password-link" style="font-size: 0.875rem; color: var(--secondary); text-decoration: none;">¿Olvidaste tu contraseña?</a>
      </div>
      <p id="auth-error" style="color: var(--danger); margin-top: 1rem; font-size: 0.875rem; display: none;"></p>
    </div>
  `;

  document.querySelector('#forgot-password-link').onclick = async (e) => {
    e.preventDefault();
    const email = document.querySelector('#email').value;
    if (!email) {
      showNotification('Por favor, ingresa tu correo institucional primero.', 'error');
      return;
    }
    if (confirm(`¿Enviar enlace de recuperación a ${email}?`)) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) showNotification(error.message, 'error');
      else showNotification('Correo de recuperación enviado.', 'success');
    }
  };

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
      showNotification(error.message, 'error'); 
    } else {
      showNotification('Sesión iniciada con éxito.', 'success'); 
    }
  });
  if (window.lucide) window.lucide.createIcons();
}

async function renderDashboard() {
  if (isDashboardRendering) return;
  isDashboardRendering = true;

  console.log('--- RENDERING DASHBOARD ---');
  if (!app) {
    console.error('CRITICAL: #app element not found!');
    isDashboardRendering = false;
    return;
  }
  const isAdminEmail = session?.user?.email?.toLowerCase() === 'ipavelek@gmail.com';
  const standardHours = resolveStandardHours(profile, settings);

  app.innerHTML = `
    <header class="dashboard-header">
      <div class="user-greeting">
        <h1 class="greeting-text">
          <i data-lucide="user-circle"></i> Hola, ${profile?.first_name || (isAdminEmail ? 'Israel' : 'Usuario')}
        </h1>
        <p class="user-role">${profile?.category || (isAdminEmail ? 'Director' : 'Personal No Docente')} - ${profile?.personnel_group || ''}</p>
      </div>
      <div class="header-actions">
        <div id="notif-bell" class="bell-icon">
          <i data-lucide="bell"></i>
          <span id="notif-count" style="display: none;">0</span>
        </div>
        <button id="install-pwa-btn" class="btn-header" style="display: none; background: var(--secondary); color: white;">
          <i data-lucide="download"></i> Instalar App
        </button>
        <button id="profile-btn" class="btn-header">
          <i data-lucide="user"></i> Mi Perfil
        </button>
        <button id="logout-btn" class="btn-header">
          <i data-lucide="log-out"></i> Salir
        </button>
      </div>
    </header>

    <div id="main-content">
      <main class="dashboard-grid animate-in">
        <div class="card glass">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="map-pin" style="color: var(--secondary);"></i> Fichaje</h3>
          <p style="margin-bottom: 1.5rem; color: var(--text-muted);"><span id="clock-in-status">Verificando ubicación...</span></p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button id="clock-in-btn" disabled>Cargando ubicación...</button>
            <button id="clock-in-qr-btn" class="btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);">
              <i data-lucide="qr-code"></i> Fichar con Código QR
            </button>
          </div>
        </div>

        <div class="card glass" id="stats-card">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="bar-chart-3" style="color: var(--primary-light);"></i> Resumen Mensual</h3>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: -0.5rem; margin-bottom: 2rem;">Objetivo: <strong>${standardHours}h</strong> diarias</p>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center; margin-bottom: 1rem;">
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
          <button id="view-stats-btn" style="background: var(--surface); border: 1px solid var(--glass-border); width: 100%; font-size: 0.8rem; padding: 0.5rem;">
            Ver Detalles e Historial
          </button>
        </div>

        <div class="card glass">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="calendar" style="color: var(--success);"></i> Licencias y Permisos</h3>
          <div id="licenses-list" style="margin-bottom: 1rem; max-height: 250px; overflow-y: auto; padding-right: 0.5rem;">
            <p style="color: var(--text-muted); font-size: 0.875rem;">Cargando...</p>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <button id="view-full-history-btn" style="background: var(--surface); border: 1px solid var(--glass-border); width: 100%; font-size: 0.8rem; padding: 0.5rem;">
              Ver Historial Detallado
            </button>
            <button id="request-auth-btn" style="background: var(--surface); border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.875rem;">
              <i data-lucide="file-text" style="width: 18px;"></i> Solicitar Permiso
            </button>
          </div>
        </div>
      </main>

      ${['director', 'vicedirector', 'rrhh'].includes(profile?.role) ? renderAdminSection() : ''}
    </div>
  `;

  document.querySelector('#logout-btn').addEventListener('click', () => supabase.auth.signOut());
  document.querySelector('#profile-btn').addEventListener('click', () => renderProfile(document.querySelector('#main-content'), profile));
  document.querySelector('#view-stats-btn').addEventListener('click', () => renderUserStats(document.querySelector('#main-content'), session.user.id));
  
  const installBtn = document.querySelector('#install-pwa-btn');
  if (installBtn && deferredPrompt) {
    installBtn.style.display = 'flex';
  }
  
  installBtn?.addEventListener('click', async () => {
    console.log('Click en Instalar App detectado');
    if (!deferredPrompt) {
      alert('El navegador aún no ha verificado que la app sea instalable de forma automática o estás en una conexión no segura (se requiere localhost o HTTPS).');
      return;
    }
    try {
      console.log('Disparando prompt de instalación...');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Respuesta del usuario: ${outcome}`);
      if (outcome === 'accepted') {
        installBtn.style.display = 'none';
      }
      deferredPrompt = null;
    } catch (err) {
      console.error('Fallo en el prompt:', err);
      alert('Error al intentar abrir el diálogo de instalación: ' + err.message);
    }
  });
  
  if (['director', 'vicedirector', 'rrhh'].includes(profile?.role)) {
    document.querySelector('#nav-abm')?.addEventListener('click', () => renderABM(document.querySelector('#main-content')));
    document.querySelector('#nav-auths')?.addEventListener('click', () => renderAuthorizations(document.querySelector('#main-content')));
    document.querySelector('#nav-holidays')?.addEventListener('click', () => renderHolidays(document.querySelector('#main-content')));
    document.querySelector('#nav-daily')?.addEventListener('click', () => renderDailyReports(document.querySelector('#main-content'), settings));
    document.querySelector('#nav-reports')?.addEventListener('click', () => renderAdvancedReports(document.querySelector('#main-content')));
    document.querySelector('#nav-settings')?.addEventListener('click', () => renderAdminSettings(document.querySelector('#main-content'), settings));
    document.querySelector('#nav-logs')?.addEventListener('click', () => renderLogs(document.querySelector('#main-content')));
    document.querySelector('#nav-security')?.addEventListener('click', () => renderSecurityPanel(document.querySelector('#main-content')));
    document.querySelector('#nav-analytics')?.addEventListener('click', () => renderAnalytics(document.querySelector('#main-content'), settings));
  }
  document.querySelector('#notif-bell')?.addEventListener('click', () => showNotificationsModal());
  
  // Auto-check notifications
  checkNotifications();

  try {
    initClockIn();
    fetchStats();
    fetchAuths();
    if (['director', 'vicedirector', 'rrhh'].includes(profile?.role)) {
      fetchAdminAlerts();
    }
  } catch (err) {
    console.error('Error post-render:', err);
  } finally {
    isDashboardRendering = false;
  }
  
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Fetches user authorizations/licenses
 */
async function fetchAuths() {
  const container = document.querySelector('#licenses-list');
  if (!container) return;

  const { data: auths, error } = await supabase
    .from('authorizations')
    .select('*')
    .eq('user_id', session.user.id)
    .order('start_date', { ascending: false })
    .limit(20);

  if (error) {
    container.innerHTML = `<p style="color: var(--danger); font-size: 0.8rem;">Error: ${error.message}</p>`;
    return;
  }

  if (!auths || auths.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem; padding: 1rem; text-align: center;">No tienes pedidos registrados.</p>';
    return;
  }

  function safeFormatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const isoStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? 'Invalid' : d.toLocaleDateString();
    } catch (e) {
      return 'Error';
    }
  }

  container.innerHTML = `
    ${auths.map(a => `
      <div class="card glass" style="padding: 0.75rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.03);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 600; font-size: 0.875rem;">${a.type}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${safeFormatDate(a.start_date || a.date)} ${a.end_date ? ' al ' + safeFormatDate(a.end_date) : ''}</div>
            ${a.admin_notes ? `<div style="font-size: 0.75rem; color: var(--secondary); margin-top: 0.25rem; font-style: italic;">R: ${a.admin_notes}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <span class="badge badge-${a.status}" style="font-size: 0.65rem;">${a.status.toUpperCase()}</span>
            ${a.status === 'pending' ? `
              <div style="margin-top: 0.5rem; display: flex; gap: 0.4rem; justify-content: flex-end;">
                <button class="edit-auth-btn" data-id="${a.id}" title="Editar" style="width: auto; padding: 0.3rem; background: var(--surface); border: none; font-size: 0.7rem; border-radius: 4px; color: var(--text); cursor: pointer;"><i data-lucide="edit-3" style="width: 14px;"></i></button>
                <button class="cancel-auth-btn" data-id="${a.id}" title="Cancelar" style="width: auto; padding: 0.3rem; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none; font-size: 0.7rem; border-radius: 4px; cursor: pointer;"><i data-lucide="trash-2" style="width: 14px;"></i></button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('')}
  `;

  // Attach events
  container.querySelectorAll('.cancel-auth-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm('¿Estás seguro de cancelar este pedido?')) {
        const { error: delErr } = await supabase.from('authorizations').delete().eq('id', btn.dataset.id);
        if (delErr) showNotification(delErr.message, 'error');
        else {
          showNotification('Pedido cancelado', 'success');
          fetchAuths();
        }
      }
    };
  });

  container.querySelectorAll('.edit-auth-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const auth = auths.find(a => a.id === btn.dataset.id);
      if (auth) {
        renderRequestForm();
        setTimeout(() => {
          document.querySelector('#auth-id').value = auth.id;
          document.querySelector('#auth-type').value = auth.type;
          document.querySelector('#auth-notes').value = auth.notes || '';
          document.querySelector('#auth-start').value = auth.start_date;
          document.querySelector('#auth-end').value = auth.end_date || '';
          document.querySelector('h2').textContent = 'Editar Solicitud de Permiso';
          document.querySelector('button[type="submit"]').textContent = 'Actualizar Pedido';
        }, 50);
      }
    };
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Fetches critical items for the Admin/Director dashboard
 */
async function fetchAdminAlerts() {
  const container = document.querySelector('#admin-alerts-container');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();

  // 1. Get all profiles + schedules for today
  const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name');
  const { data: schedules } = await supabase.from('user_schedules').select('user_id').eq('day_of_week', dayOfWeek);
  
  // 2. Get attendance and auths for today
  const { data: attendance } = await supabase.from('attendance')
    .select('user_id')
    .gte('check_in', `${today}T00:00:00.000Z`)
    .lte('check_in', `${today}T23:59:59.999Z`);
    
  const { data: auths } = await supabase.from('authorizations')
    .select('user_id, start_date, end_date')
    .eq('status', 'approved');

  const expectedIds = new Set(schedules?.map(s => s.user_id) || []);
  const attendingIds = new Set(attendance?.map(a => a.user_id) || []);
  
  // Custom filter for authorized IDs on 'today'
  const authorizedIds = new Set(
    auths?.filter(a => {
      const start = a.start_date;
      const end = a.end_date || a.start_date;
      return today >= start && today <= end;
    }).map(a => a.user_id) || []
  );
  // 3. Get pending authorizations count for badge (always run for admins)
  const { count: pendingCount } = await supabase.from('authorizations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  updateAdminBadge(pendingCount || 0);

  const missingIds = Array.from(expectedIds).filter(id => !attendingIds.has(id) && !authorizedIds.has(id));
  const missingProfiles = profiles?.filter(p => missingIds.includes(p.id)) || [];
  
  // 4. Advanced Alerts: Tardiness, missing checkouts, license limits
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  // 4a. Excessive Tardiness (>3 in last 30 days)
  const { data: recentLates } = await supabase.from('attendance')
    .select('user_id')
    .eq('status', 'late')
    .gte('check_in', oneMonthAgo.toISOString());
    
  const lateCounts = {};
  recentLates?.forEach(l => lateCounts[l.user_id] = (lateCounts[l.user_id] || 0) + 1);
  const excessiveLateUserIds = Object.keys(lateCounts).filter(id => lateCounts[id] >= 3);
  const excessiveLateProfiles = profiles?.filter(p => excessiveLateUserIds.includes(p.id)) || [];

  // 4b. Missing Check-outs (yesterday and before)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const { data: missingOuts } = await supabase.from('attendance')
    .select('user_id, check_in')
    .is('check_out', null)
    .lt('check_in', `${today}T00:00:00.000Z`)
    .order('check_in', { ascending: false });

  // 4c. Articlo 85 Limits (using 2024 as current year for calc or dynamic)
  const currentYear = new Date().getFullYear();
  const { data: art85Auths } = await supabase.from('authorizations')
    .select('user_id')
    .eq('status', 'approved')
    .eq('type', 'Razones Particulares (Art. 85)')
    .gte('start_date', `${currentYear}-01-01`);
  
  const art85Counts = {};
  art85Auths?.forEach(a => art85Counts[a.user_id] = (art85Counts[a.user_id] || 0) + 1);
  const nearLimitArt85UserIds = Object.keys(art85Counts).filter(id => art85Counts[id] >= 5);
  const nearLimitArt85Profiles = profiles?.filter(p => nearLimitArt85UserIds.includes(p.id)) || [];

  let alertsHtml = '';
  
  // 1. Missing Todays
  if (missingProfiles.length > 0) {
    alertsHtml += `
      <div class="card glass alert-card" style="border-left: 4px solid var(--danger); margin-bottom: 1rem;">
        <h4 style="color: var(--danger); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
          <i data-lucide="alert-circle"></i> Ausencias Críticas Hoy (${missingProfiles.length})
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${missingProfiles.map(p => `<span class="badge" style="background: rgba(239, 68, 68, 0.1); color: var(--danger);">${p.last_name}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // 2. Missing Check-outs
  if (missingOuts?.length > 0) {
    const uniqueMissingOutIds = new Set(missingOuts.map(m => m.user_id));
    const missingOutProfiles = profiles?.filter(p => uniqueMissingOutIds.has(p.id)) || [];
    alertsHtml += `
      <div class="card glass alert-card" style="border-left: 4px solid var(--warning); margin-bottom: 1rem;">
        <h4 style="color: var(--warning); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
          <i data-lucide="clock"></i> Olvidos de Salida (${missingOutProfiles.length})
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${missingOutProfiles.map(p => `<span class="badge" style="background: rgba(245, 158, 11, 0.1); color: var(--warning);">${p.last_name}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // 3. Excessive Tardiness
  if (excessiveLateProfiles.length > 0) {
    alertsHtml += `
      <div class="card glass alert-card" style="border-left: 4px solid var(--primary-light); margin-bottom: 1rem;">
        <h4 style="color: var(--primary-light); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
          <i data-lucide="timer"></i> Reincidencia en Tardanzas (${excessiveLateProfiles.length})
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${excessiveLateProfiles.map(p => `<span class="badge" style="background: rgba(94, 211, 243, 0.1); color: var(--primary-light);">${p.last_name} (${lateCounts[p.id]})</span>`).join('')}
        </div>
      </div>
    `;
  }

  // 4. License Limits
  if (nearLimitArt85Profiles.length > 0) {
    alertsHtml += `
      <div class="card glass alert-card" style="border-left: 4px solid var(--secondary); margin-bottom: 1rem;">
        <h4 style="color: var(--secondary); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
          <i data-lucide="shield-alert"></i> Próximos a Límite Art. 85 (${nearLimitArt85Profiles.length})
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${nearLimitArt85Profiles.map(p => `<span class="badge" style="background: rgba(167, 139, 250, 0.1); color: var(--secondary);">${p.last_name} (${art85Counts[p.id]}/6)</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (alertsHtml === '') {
    container.innerHTML = `
      <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; color: #4ade80; margin-bottom: 2rem;">
        <i data-lucide="check-circle" style="width: 20px;"></i>
        <span>No hay alertas RRHH pendientes.</span>
      </div>
    `;
  } else {
    container.innerHTML = `<div style="margin-bottom: 2rem;">${alertsHtml}</div>`;
  }
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Updates the visual badge for pending authorizations
 */
function updateAdminBadge(count) {
  const badge = document.querySelector('#pending-auths-badge');
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'flex';
    badge.classList.add('pulse');
  } else {
    badge.style.display = 'none';
    badge.classList.remove('pulse');
  }
}

/**
 * Renders a full-screen view of the user's authorization history with filters and sorting
 */
async function renderUserAuthHistory(container) {
  let allAuths = [];
  let sortConfig = { key: 'start_date', direction: 'desc' };
  
  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="history"></i> Mi Historial de Licencias</h2>
        <button id="back-to-dash" class="btn-secondary" style="width: auto;">Volver al Dashboard</button>
      </div>

      <div class="card glass" style="margin-bottom: 1.5rem; padding: 1.25rem;">
        <div style="display: grid; grid-template-columns: 1.5fr 1.5fr 1fr auto; gap: 1rem; align-items: end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; margin-bottom: 0.3rem;">Desde</label>
            <input type="date" id="history-from" style="padding: 0.6rem;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; margin-bottom: 0.3rem;">Hasta</label>
            <input type="date" id="history-to" style="padding: 0.6rem;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; margin-bottom: 0.3rem;">Estado</label>
            <select id="history-status" style="padding: 0.6rem;">
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
            </select>
          </div>
          <button id="clear-history-filters" title="Limpiar Filtros" style="width: auto; padding: 0.6rem; background: var(--surface); border: 1px solid var(--glass-border); color: var(--text-muted);">
            <i data-lucide="filter-x" style="width: 18px;"></i>
          </button>
        </div>
      </div>

      <div class="card glass" style="padding: 0; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: rgba(255,255,255,0.05); border-bottom: 1px solid var(--glass-border);">
              <th class="sortable" data-key="type" style="padding: 1rem; cursor: pointer;">Tipo <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th class="sortable" data-key="start_date" style="padding: 1rem; cursor: pointer;">Desde <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th class="sortable" data-key="end_date" style="padding: 1rem; cursor: pointer;">Hasta <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th class="sortable" data-key="status" style="padding: 1rem; cursor: pointer;">Estado <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th style="padding: 1rem;">Observaciones</th>
            </tr>
          </thead>
          <tbody id="user-history-body">
            <tr><td colspan="5" style="padding: 2rem; text-align: center;">Cargando historial...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const { data, error } = await supabase
    .from('authorizations')
    .select('*')
    .eq('user_id', session.user.id)
    .order('start_date', { ascending: false });

  if (error) {
    document.querySelector('#user-history-body').innerHTML = `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--danger);">Error: ${error.message}</td></tr>`;
    return;
  }
  allAuths = data;

  function renderTable() {
    const tbody = document.querySelector('#user-history-body');
    const from = document.querySelector('#history-from').value;
    const to = document.querySelector('#history-to').value;
    const status = document.querySelector('#history-status').value;

    let filtered = allAuths.filter(a => {
      const date = a.start_date || a.date;
      const statusMatch = status === 'all' || a.status === status;
      const dateMatch = (!from || date >= from) && (!to || date <= to);
      return statusMatch && dateMatch;
    });

    // Sorting logic
    filtered.sort((a, b) => {
      let valA = a[sortConfig.key] || '';
      let valB = b[sortConfig.key] || '';
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">No se encontraron registros.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(a => `
      <tr style="border-bottom: 1px solid var(--glass-border);">
        <td style="padding: 1rem; font-weight: 500;">${a.type}</td>
        <td style="padding: 1rem;">${safeFormatDate(a.start_date || a.date)}</td>
        <td style="padding: 1rem;">${safeFormatDate(a.end_date)}</td>
        <td style="padding: 1rem;">
          <span class="badge badge-${a.status}">${a.status.toUpperCase()}</span>
        </td>
        <td style="padding: 1rem; font-size: 0.8rem; color: var(--text-dim); max-width: 250px;">
        <div>${a.notes || '---'}</div>
        ${a.admin_notes ? `<div style="margin-top: 0.5rem; color: var(--secondary); font-weight: 500;">R: ${a.admin_notes}</div>` : ''}
      </td>
    </tr>
  `).join('');
  }

  function safeFormatDate(dateStr) {
    if (!dateStr) return '---';
    try {
      const isoStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? 'Invalid' : d.toLocaleDateString();
    } catch (e) {
      return 'Err';
    }
  }

  // Events
  document.querySelector('#history-from').onchange = renderTable;
  document.querySelector('#history-to').onchange = renderTable;
  document.querySelector('#history-status').onchange = renderTable;
  document.querySelector('#clear-history-filters').onclick = () => {
    document.querySelector('#history-from').value = '';
    document.querySelector('#history-to').value = '';
    document.querySelector('#history-status').value = 'all';
    renderTable();
  };

  document.querySelectorAll('.sortable').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.key;
      if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
      }
      renderTable();
    };
  });

  renderTable();
}

function renderRequestForm() {
  const container = document.querySelector('#main-content');
  container.innerHTML = `
    <div class="animate-in card glass" style="max-width: 500px; margin: 0 auto;">
      <h2 style="margin-bottom: 1.5rem;"><i data-lucide="file-text"></i> Nueva Solicitud de Permiso</h2>
      <form id="auth-request-form">
        <input type="hidden" id="auth-id" value="">
        <div class="form-group">
          <label>Motivo / Tipo</label>
          <select id="auth-type" required>
            <option value="Razones Particulares (Art. 85)">Razones Particulares (Art. 85)</option>
            <option value="Examen (Estudio)">Examen (Estudio)</option>
            <option value="Atención Familiar (Art. 75/76)">Atención Familiar (Art. 75/76)</option>
            <option value="Licencia Anual (Vacaciones)">Licencia Anual (Vacaciones)</option>
            <option value="Fallecimiento (Cónyuge/Padres/Hijos)">Fallecimiento (Cónyuge/Padres/Hijos)</option>
            <option value="Fallecimiento (Hermanos/Nietos)">Fallecimiento (Hermanos/Nietos)</option>
            <option value="Matrimonio">Matrimonio</option>
            <option value="Mudanza">Mudanza</option>
            <option value="Maternidad / Paternidad">Maternidad / Paternidad</option>
            <option value="Media Jornada (Art. 87)">Media Jornada (Art. 87)</option>
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
          <textarea id="auth-notes" placeholder="Detalles adicionales..." style="width: 100%; padding: 0.75rem; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; min-height: 80px;"></textarea>
        </div>
        <div class="form-group">
          <label>Adjuntar Certificado (Opcional)</label>
          <input type="file" id="auth-attachment" accept="image/*,.pdf" capture="environment" style="padding: 0.5rem; background: rgba(255,255,255,0.05);">
          <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">Formato admitido: PDF, JPG, PNG (Max 5MB)</p>
        </div>
        <div id="upload-status" style="display: none; font-size: 0.8rem; color: var(--secondary); margin-bottom: 1rem;">
          <i data-lucide="loader" class="spin" style="width: 14px; vertical-align: middle;"></i> Subiendo archivo...
        </div>
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
          <button type="submit" style="background: var(--accent-gradient);">Enviar Solicitud</button>
          <button type="button" id="back-to-dash" style="background: var(--surface);">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  document.querySelector('#auth-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const id = document.querySelector('#auth-id').value;
    const type = document.querySelector('#auth-type').value;
    const notes = document.querySelector('#auth-notes').value;
    const startDate = document.querySelector('#auth-start').value;
    const endDate = document.querySelector('#auth-end').value;

    const fileInput = document.querySelector('#auth-attachment');
    const uploadStatus = document.querySelector('#upload-status');
    const file = fileInput.files[0];

    if (!startDate) {
      showNotification('Por favor ingresa una fecha de inicio.', 'error');
      return;
    }

    // --- ART 85 VALIDATION ---
    if (type === 'Razones Particulares (Art. 85)') {
      const start = new Date(startDate);
      const startYear = start.getFullYear();
      const startMonth = start.getMonth(); // 0-indexed

      // Get all approved/pending Art 85 requests for this user in this year
      const { data: yearReqs } = await supabase
        .from('authorizations')
        .select('start_date')
        .eq('user_id', session.user.id)
        .eq('type', 'Razones Particulares (Art. 85)')
        .gte('start_date', `${startYear}-01-01`)
        .lte('start_date', `${startYear}-12-31`)
        .neq('status', 'rejected');

      if (yearReqs && yearReqs.length >= 6) {
        showNotification('Ya has utilizado el cupo anual de 6 días para Razones Particulares.', 'error');
        btn.disabled = false;
        btn.textContent = 'Enviar Solicitud';
        return;
      }

      const monthReqs = yearReqs?.filter(r => new Date(r.start_date).getMonth() === startMonth);
      if (monthReqs && monthReqs.length >= 2) {
        showNotification('Ya has utilizado el cupo mensual de 2 días para Razones Particulares.', 'error');
        btn.disabled = false;
        btn.textContent = 'Enviar Solicitud';
        return;
      }
    }

    btn.disabled = true;
    btn.textContent = 'Procesando...';

    let attachmentPath = null;
    
    // Handle File Upload
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('El archivo es demasiado grande (máx 5MB).', 'error');
        btn.disabled = false;
        btn.textContent = 'Enviar Solicitud';
        return;
      }

      uploadStatus.style.display = 'block';
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      const filePath = `certificates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, file);

      if (uploadError) {
        console.warn('Storage upload failed (bucket might not exist):', uploadError);
        // Fallback or warning: we'll continue but notify
        showNotification('No se pudo subir el adjunto (Servidor no configurado). Se enviará solo el texto.', 'warning');
      } else {
        attachmentPath = fileName;
      }
      uploadStatus.style.display = 'none';
    }

    const payload = {
      type,
      notes,
      start_date: startDate,
      end_date: endDate || null,
      status: 'pending',
      metadata: { 
        attachment_path: attachmentPath,
        updated_at: new Date().toISOString()
      }
    };

    let result;
    if (id) {
      result = await supabase.from('authorizations').update(payload).eq('id', id);
    } else {
      payload.user_id = session.user.id;
      result = await supabase.from('authorizations').insert(payload);
    }

    if (result.error) {
      showNotification(result.error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Enviar Solicitud';
    } else {
      showNotification(id ? 'Pedido actualizado' : 'Solicitud enviada con éxito', 'success');
      renderDashboard();
    }
  });

  if (window.lucide) window.lucide.createIcons();
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
    document.querySelector('#count-absent').textContent = '0';
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
      <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p style="font-size: 0.875rem;">${l.type}</p>
          <p style="font-size: 0.75rem; color: var(--text-muted);">${new Date(l.start_date).toLocaleDateString()}</p>
        </div>
        ${l.status === 'approved' ? `
          <button class="download-ics" data-title="${l.type}" data-date="${l.start_date}" data-notes="${l.notes || ''}" style="width: auto; padding: 0.25rem; background: transparent; border: none; color: var(--success);" title="Agregar al calendario">
            <i data-lucide="calendar-plus" style="width: 18px;"></i>
          </button>
        ` : `<span style="font-size: 0.65rem; color: var(--text-dim);">${l.status.toUpperCase()}</span>`}
      </div>
    `).join('');

    licenseEl.querySelectorAll('.download-ics').forEach(btn => {
      btn.onclick = () => {
        const { title, date, notes } = btn.dataset;
        downloadICS(`Licencia: ${title}`, notes, date);
      };
    });
  } else {
    licenseEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No tienes licencias programadas.</p>';
  }
}

function renderAdminSection() {
  return `
    <section style="margin-top: 3rem;">
      <div id="admin-alerts-container"></div>
      <h2 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="shield-check"></i> Panel de Administración</h2>
      <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
        
        <div class="card glass" style="border-top: 4px solid var(--accent);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="bar-chart-big"></i> Resumen por Usuario</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Estadísticas individuales, horas trabajadas y gestión de fichajes.</p>
          <button id="nav-reports" style="margin-top: 1rem; background: var(--surface);">Ver Resumen</button>
        </div>

        <div class="card glass" style="border-top: 4px solid var(--primary-light);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="trending-up"></i> Analitícas Avanzadas</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Estadísticas generales y tendencias de asistencia.</p>
          <button id="nav-analytics" style="margin-top: 1rem; background: var(--surface);">Ver Gráficos</button>
        </div>

        <div class="card glass" style="border-top: 4px solid var(--primary-light);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="users"></i> Gestión de Personal</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Alta, baja y modificación de usuarios.</p>
          <button id="nav-abm" style="margin-top: 1rem; background: var(--surface);">Abrir ABM</button>
        </div>

        <div class="card glass" style="border-top: 4px solid var(--secondary);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="clipboard-check"></i> Autorizaciones Pendientes</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Aprobar o rechazar permisos.</p>
          <div style="position: relative; display: inline-block; width: 100%;">
            <button id="nav-auths" style="margin-top: 1rem; background: var(--surface); width: 100%;">Ver Solicitudes</button>
            <span id="pending-auths-badge" class="badge-notification" style="display: none; position: absolute; top: 0; right: -5px; background: var(--danger); color: white; border-radius: 50%; width: 22px; height: 22px; font-size: 0.7rem; font-weight: bold; align-items: center; justify-content: center; border: 2px solid var(--surface); z-index: 10;">0</span>
          </div>
        </div>

        <div class="card glass" style="border-top: 4px solid var(--success);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="clipboard-list"></i> Partes Diarios</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Cierre y validación de asistencia diaria.</p>
          <button id="nav-daily" style="margin-top: 1rem; background: var(--surface);">Abrir Parte</button>
        </div>

        <div class="card glass" style="border-top: 4px solid var(--warning);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="calendar"></i> Gestión de Feriados</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Configura días no laborables y asuetos.</p>
          <button id="nav-holidays" style="margin-top: 1rem; background: var(--surface);">Calendario</button>
        </div>

        <div class="card glass" style="border-top: 4px solid var(--danger);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="shield-alert"></i> Área de Seguridad</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">¿Quién está en el edificio ahora?</p>
          <button id="nav-security" style="margin-top: 1rem; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2);">Abrir Panel</button>
        </div>

        <div class="card glass" style="border-top: 4px solid var(--secondary);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="scroll-text"></i> Auditoría</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Ver registro de acciones del sistema.</p>
          <button id="nav-logs" style="margin-top: 1rem; background: var(--surface);">Ver Logs</button>
        </div>

        <div class="card glass" style="border-top: 4px solid var(--primary);">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="settings"></i> Configuración</h3>
          <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0.5rem 0;">Ajustes globales, ubicación y reglas de negocio.</p>
          <button id="nav-settings" style="margin-top: 1rem; background: var(--surface);">Configurar Sistema</button>
        </div>
      </div>
    </section>
  `;
}

async function initClockIn() {
  if (isGeoLoading) return;
  isGeoLoading = true;

  const btn = document.querySelector('#clock-in-btn');
  const statusText = document.querySelector('#clock-in-status');
  
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
      
      const { data: lastRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .is('check_out', null)
        .order('check_in', { ascending: false })
        .limit(1)
        .single();

      const todayStr = new Date().toISOString().split('T')[0];
      const isLastRecordToday = lastRecord && lastRecord.check_in.split('T')[0] === todayStr;

      if (lastRecord && isLastRecordToday) {
        btn.textContent = 'Fichar Salida';
        btn.onclick = () => handleClockOut(lastRecord.id);
      } else {
        if (lastRecord && !isLastRecordToday) {
          statusText.innerHTML += `<br><span style="font-size: 0.75rem; color: var(--warning); opacity: 0.8;">⚠️ Olvido de salida detectado (${new Date(lastRecord.check_in).toLocaleDateString()}). Puedes fichar entrada hoy normalmente.</span>`;
        }
        btn.textContent = 'Fichar Entrada';
        btn.onclick = () => handleClockIn(pos);
      }
      btn.disabled = false;
      isGeoLoading = false;
    } else {
      statusText.textContent = `🚫 Estás a ${Math.round(distance)}m. Debes estar en las inmediaciones para fichar.`;
      statusText.style.color = 'var(--danger)';
      btn.textContent = 'Fuera de Rango';
      btn.disabled = true;
      isGeoLoading = false;
      showNotification('Estás fuera del rango permitido para marcar asistencia.', 'error');
    }
  } catch (err) {
    console.error('Geo error:', err);
    let msg = 'Error desconocido al obtener ubicación.';
    
    // Handle Geolocation PositionError codes
    if (err.code === 1) { // PERMISSION_DENIED
      msg = 'Permiso de ubicación denegado. Por favor, habilítalo en la configuración de tu navegador.';
    } else if (err.code === 2) { // POSITION_UNAVAILABLE
      msg = 'No se pudo determinar tu ubicación. Asegúrate de tener el GPS encendido.';
    } else if (err.code === 3) { // TIMEOUT
      msg = 'Tiempo de espera agotado. Asegúrate de aceptar el permiso rápidamente y tener buena señal.';
    } else if (err.message) {
      msg = err.message;
    }

    if (msg.includes('Secure Origins') || msg.includes('secure origin')) {
      msg = 'La geolocalización requiere una conexión segura (HTTPS).';
    }

    if (statusText) {
      statusText.innerHTML = `<span style="display:flex; align-items:center; gap:0.5rem;"><i data-lucide="help-circle" style="width:16px;"></i> ${msg}</span>`;
      statusText.style.color = 'var(--danger)';
    }

    if (btn) {
      btn.textContent = 'Reintentar Ubicación';
      btn.disabled = false;
      btn.onclick = () => {
        btn.disabled = true;
        btn.textContent = 'Cargando ubicación...';
        initClockIn();
      };
    }
    showNotification(msg, 'error');
    if (window.lucide) window.lucide.createIcons();
    isGeoLoading = false;
  }
}

async function handleClockIn(pos) {
  const btn = document.querySelector('#clock-in-btn');
  btn.disabled = true;
  btn.textContent = 'Fichando...';

  const entryTime = new Date();
  const dayOfWeek = entryTime.getDay();
  
  const { data: schedule } = await supabase
    .from('user_schedules')
    .select('start_time, end_time')
    .eq('user_id', session.user.id)
    .eq('day_of_week', dayOfWeek)
    .single();

  const rules = settings?.business_rules;
  const tolerance = rules?.tolerance_minutes || 15;
  let classification = null;
  let isLate = false;

  if (schedule) {
    const [h, m] = schedule.start_time.split(':');
    const scheduledEntry = new Date();
    scheduledEntry.setHours(parseInt(h), parseInt(m), 0, 0);
    
    const diffMins = (entryTime - scheduledEntry) / 60000;
    
    if (diffMins > tolerance) {
      classification = 'Entrada Tardía';
      isLate = true;
    } else if (diffMins < -tolerance) {
      classification = 'Entrada Temprana';
    }
  }

  if (classification) {
    showClockNotificationModal('Entrada', classification, async (note) => {
      await saveClockIn(pos, entryTime, isLate, classification, note);
    }, () => {
      btn.disabled = false;
      btn.textContent = 'Fichar Entrada';
    });
  } else {
    await saveClockIn(pos, entryTime, isLate, null, '');
  }
}

async function saveClockIn(pos, entryTime, isLate, classification, note) {
  const btn = document.querySelector('#clock-in-btn');
  const { error } = await supabase.from('attendance').insert({
    user_id: session.user.id,
    check_in: entryTime.toISOString(),
    lat: pos.lat,
    long: pos.long,
    is_late: isLate,
    status: isLate ? 'late' : 'present',
    justification_note: classification ? `${classification.toUpperCase()}: ${note}` : note,
    metadata: { classification }
  });

  if (error) {
    showNotification('Error al fichar entrada: ' + error.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Fichar Entrada';
  } else {
    showNotification('Entrada registrada con éxito.', 'success');
    initClockIn();
    fetchStats();
  }
}

function showClockNotificationModal(type, detectedClassification, onSubmit, onCancel) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay animate-in';
  modal.innerHTML = `
    <div class="card glass modal-content" style="max-width: 400px; width: 90%;">
      <h3 style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i data-lucide="alert-circle" style="color: var(--warning);"></i> Aviso de ${type}
      </h3>
      <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.5rem;">
        Se ha detectado una <strong>${detectedClassification}</strong> fuera de la tolerancia permitida.
      </p>
      
      <div class="form-group">
        <label>Tipo de Registro</label>
        <select id="clock-classification" style="width: 100%; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem;">
          <option value="Entrada Temprana" ${detectedClassification === 'Entrada Temprana' ? 'selected' : ''}>Entrada Temprana</option>
          <option value="Entrada Tardía" ${detectedClassification === 'Entrada Tardía' ? 'selected' : ''}>Entrada Tardía</option>
          <option value="Salida Anticipada" ${detectedClassification === 'Salida Anticipada' ? 'selected' : ''}>Salida Anticipada</option>
          <option value="Salida Después de Hora" ${detectedClassification === 'Salida Después de Hora' ? 'selected' : ''}>Salida Después de Hora</option>
        </select>
      </div>

      <div class="form-group">
        <label>Descripción / Motivo (Opcional)</label>
        <textarea id="clock-note" placeholder="Ej: Tráfico, compensación de horas..." style="width: 100%; min-height: 80px; background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; font-size: 0.875rem;"></textarea>
      </div>

      <div style="display: flex; gap: 1rem; margin-top: 2rem;">
        <button id="confirm-clock" style="flex: 1; background: var(--accent-gradient);">Confirmar y Fichar</button>
        <button id="cancel-clock" style="flex: 1; background: var(--surface);">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();

  modal.querySelector('#confirm-clock').onclick = () => {
    const classification = modal.querySelector('#clock-classification').value;
    const note = modal.querySelector('#clock-note').value;
    modal.remove();
    onSubmit(note, classification);
  };

  modal.querySelector('#cancel-clock').onclick = () => {
    modal.remove();
    if (onCancel) onCancel();
  };
}

async function handleClockOut(id) {
  const exitTime = new Date();
  const dayOfWeek = exitTime.getDay();

  const { data: schedule } = await supabase
    .from('user_schedules')
    .select('end_time')
    .eq('user_id', session.user.id)
    .eq('day_of_week', dayOfWeek)
    .single();

  const rules = settings?.business_rules;
  const tolerance = rules?.tolerance_minutes || 15;
  let classification = null;

  if (schedule && schedule.end_time) {
    const [h, m] = schedule.end_time.split(':');
    const scheduledExit = new Date();
    scheduledExit.setHours(parseInt(h), parseInt(m), 0, 0);

    const diffMins = (exitTime - scheduledExit) / 60000;

    if (diffMins > tolerance) {
      classification = 'Salida Después de Hora';
    } else if (diffMins < -tolerance) {
      classification = 'Salida Anticipada';
    }
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay animate-in';
  modal.innerHTML = `
    <div class="card glass modal-content" style="max-width: 450px; text-align: center;">
      <h3 style="margin-bottom: 0.5rem;">🎉 ¡Excelente jornada!</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">¿Cómo calificarías tu día hoy?</p>
      
      ${classification ? `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 0.75rem; margin-bottom: 1.5rem; text-align: left;">
          <p style="font-size: 0.8rem; color: var(--warning); font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="alert-triangle" style="width: 14px;"></i> Aviso de Salida
          </p>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Has fichado con una <strong>${classification}</strong>. Por favor, indica el motivo en el comentario.</p>
        </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; gap: 0.5rem; margin-bottom: 2rem;">
        <button class="mood-btn" data-mood="excellent" style="background: transparent; border: 2px solid transparent; flex: 1; padding: 0.5rem; border-radius: 12px; transition: all 0.3s;">
          <div style="font-size: 2rem;">🤩</div>
          <span style="font-size: 0.7rem; color: var(--text-dim);">Excelente</span>
        </button>
        <button class="mood-btn" data-mood="good" style="background: transparent; border: 2px solid transparent; flex: 1; padding: 0.5rem; border-radius: 12px; transition: all 0.3s;">
          <div style="font-size: 2rem;">😊</div>
          <span style="font-size: 0.7rem; color: var(--text-dim);">Bien</span>
        </button>
        <button class="mood-btn" data-mood="neutral" style="background: transparent; border: 2px solid transparent; flex: 1; padding: 0.5rem; border-radius: 12px; transition: all 0.3s;">
          <div style="font-size: 2rem;">😐</div>
          <span style="font-size: 0.7rem; color: var(--text-dim);">Normal</span>
        </button>
        <button class="mood-btn" data-mood="tired" style="background: transparent; border: 2px solid transparent; flex: 1; padding: 0.5rem; border-radius: 12px; transition: all 0.3s;">
          <div style="font-size: 2rem;">😫</div>
          <span style="font-size: 0.7rem; color: var(--text-dim);">Cansado</span>
        </button>
        <button class="mood-btn" data-mood="stressed" style="background: transparent; border: 2px solid transparent; flex: 1; padding: 0.5rem; border-radius: 12px; transition: all 0.3s;">
          <div style="font-size: 2rem;">🤯</div>
          <span style="font-size: 0.7rem; color: var(--text-dim);">Estresado</span>
        </button>
      </div>

      <div class="form-group" style="text-align: left;">
        <label style="font-size: 0.8rem; opacity: 0.7;">${classification ? 'Motivo de la salida y comentario' : 'Comentario opcional'}</label>
        <textarea id="mood-note" placeholder="${classification ? 'Ej: Finalización de tareas, permiso especial...' : 'Escribe aquí...'}" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); width: 100%; min-height: 80px; margin-top: 0.5rem; color: white;"></textarea>
      </div>

      <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
        <button id="skip-mood" style="flex: 1; background: var(--surface); border: 1px solid var(--glass-border);">Omitir y Fichar</button>
        <button id="save-mood" style="flex: 1; background: var(--accent-gradient);" disabled>Registrar Salida</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();
  let selectedMood = null;

  const moodBtns = modal.querySelectorAll('.mood-btn');
  moodBtns.forEach(btn => {
    btn.onclick = () => {
      moodBtns.forEach(b => b.style.borderColor = 'transparent');
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = 'rgba(255,255,255,0.05)';
      selectedMood = btn.dataset.mood;
      modal.querySelector('#save-mood').disabled = false;
    }
  });

  const performClockOut = async (mood = null, note = '') => {
    const btnMain = document.querySelector('#clock-in-btn');
    btnMain.disabled = true;
    btnMain.textContent = 'Fichando...';
    modal.remove();

    const fullNote = classification ? `${classification.toUpperCase()}: ${note}` : note;

    const { error } = await supabase.from('attendance')
      .update({ 
        check_out: new Date().toISOString(),
        mood: mood,
        mood_note: fullNote,
        metadata: { 
          ...((await supabase.from('attendance').select('metadata').eq('id', id).single()).data?.metadata || {}),
          clock_out_classification: classification 
        }
      })
      .eq('id', id);

    if (error) {
      showNotification('Error al fichar salida: ' + error.message, 'error');
      btnMain.disabled = false;
      btnMain.textContent = 'Fichar Salida';
    } else {
      showNotification('Salida registrada. ¡Que descanses!', 'success');
      initClockIn();
    }
  };

  modal.querySelector('#skip-mood').onclick = () => performClockOut();
  modal.querySelector('#save-mood').onclick = () => {
    const note = modal.querySelector('#mood-note').value;
    performClockOut(selectedMood, note);
  };
}

/**
 * Checks for recent status changes in user's authorizations
 */
async function checkNotifications() {
  if (!session) return;
  const lastCheck = localStorage.getItem(`last_notif_check_${session.user.id}`) || new Date(0).toISOString();
  
  const { data: recentChanges } = await supabase
    .from('authorizations')
    .select('*')
    .eq('user_id', session.user.id)
    .neq('status', 'pending')
    .gt('metadata->updated_at', lastCheck);

  const countEl = document.querySelector('#notif-count');
  if (recentChanges?.length > 0 && countEl) {
    countEl.textContent = recentChanges.length;
    countEl.style.display = 'flex';
    countEl.classList.add('pulse');
    
    showNotification(`Tienes ${recentChanges.length} novedades en tus solicitudes.`, 'info');
  }

  // Also run clock-out reminder
  clockOutReminder();
}

/**
 * Shows a modal with recent notification details
 */
async function showNotificationsModal() {
  const { data: recentChanges } = await supabase
    .from('authorizations')
    .select('*')
    .eq('user_id', session.user.id)
    .neq('status', 'pending')
    .order('metadata->updated_at', { ascending: false })
    .limit(5);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="card glass modal-content" style="max-width: 400px; width: 90%;">
      <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i data-lucide="bell"></i> Novedades Recientes
      </h3>
      <div id="notif-list" style="margin-bottom: 1.5rem; max-height: 400px; overflow-y: auto;">
        ${recentChanges?.length > 0 ? recentChanges.map(n => `
          <div style="padding: 1rem; border-bottom: 1px solid var(--glass-border); margin-bottom: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
            <p style="font-weight: bold; font-size: 0.9rem;">${n.type}</p>
            <p style="font-size: 0.8rem; margin: 0.25rem 0;">Estado: <span class="badge badge-${n.status}">${n.status.toUpperCase()}</span></p>
            ${n.admin_notes ? `<p style="font-size: 0.75rem; color: var(--secondary); margin-top: 0.25rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px;">"${n.admin_notes}"</p>` : ''}
            <p style="font-size: 0.65rem; color: var(--text-dim); margin-top: 0.5rem;">Resuelto el ${new Date(n.metadata?.updated_at).toLocaleString()}</p>
          </div>
        `).join('') : '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No hay novedades recientes.</p>'}
      </div>
      <button id="close-notif" style="width: 100%; background: var(--surface);">Cerrar y marcar como leídas</button>
    </div>
  `;

  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();

  document.querySelector('#close-notif').onclick = () => {
    localStorage.setItem(`last_notif_check_${session.user.id}`, new Date().toISOString());
    const countEl = document.querySelector('#notif-count');
    if (countEl) countEl.style.display = 'none';
    modal.remove();
  };
}

/**
 * Reminds the user if they forgot to clock out
 */
async function clockOutReminder() {
  if (!session) return;
  const now = new Date();
  const currentHour = now.getHours();
  
  if (currentHour < 13) return; 

  const { data: activeRecord } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', session.user.id)
    .is('check_out', null)
    .gte('check_in', new Date().toISOString().split('T')[0] + 'T00:00:00')
    .maybeSingle();

  if (activeRecord) {
    const entryTime = new Date(activeRecord.check_in);
    const hoursElapsed = (now - entryTime) / (1000 * 60 * 60);
    
    if (hoursElapsed > 9) {
      showNotification('⚠️ Recordatorio: Sigues con el fichaje de entrada activo. ¿Olvidaste fichar la salida?', 'warning');
    }
  }
}

function openQRScannerModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay animate-in';
  modal.innerHTML = `
    <div class="card glass modal-content" style="max-width: 450px; text-align: center;">
      <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
        <i data-lucide="qr-code"></i> Escanear Asistencia
      </h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">Enfoca el código QR de la terminal inteligente.</p>
      
      <div id="qr-reader" style="width: 100%; border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem; background: #000; min-height: 250px;"></div>
      
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
        <button id="switch-camera-btn" class="btn-secondary" style="flex: 1; display: none; font-size: 0.8rem; padding: 0.6rem; border: 1px solid var(--glass-border);">
          <i data-lucide="refresh-cw" style="width: 14px; vertical-align: middle;"></i> Cambiar cámara
        </button>
      </div>

      <p id="qr-status" style="color: var(--warning); font-size: 0.9rem; margin-bottom: 1.5rem; display: none;"></p>
      
      <button id="close-qr-modal" style="width: 100%; background: var(--surface); border: 1px solid var(--glass-border);">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();

  const html5QrCode = new Html5Qrcode("qr-reader");
  let isProcessing = false;
  let cameras = [];
  let currentCameraIndex = 0;

  const startScanning = async (deviceIdOrConstraints) => {
    try {
      const config = { fps: 15, qrbox: { width: 250, height: 250 } };
      await html5QrCode.start(deviceIdOrConstraints, config, async (decodedText) => {
        if (isProcessing) return;
        isProcessing = true;
        
        const cleanToken = decodedText.trim();
        const statusText = modal.querySelector('#qr-status');
        statusText.textContent = "Validando código...";
        statusText.style.color = 'var(--secondary)';
        statusText.style.display = 'block';

        console.log("🔍 Iniciando validación de QR:", cleanToken);

        try {
          // Timeout de 10 segundos para la validación
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout de conexión (10s)')), 10000)
          );

          const rpcPromise = supabase.rpc('registrar_fichaje_qr', { 
            p_user_id: session.user.id, 
            p_token: cleanToken 
          });

          const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

          if (error) {
            console.error("❌ Error de Supabase:", error);
            throw error;
          }
          
          console.log("✅ Respuesta de RPC:", data);

          if (data && data.exito) {
            showNotification(data.mensaje, 'success');
            if (html5QrCode.isScanning) await html5QrCode.stop();
            modal.remove();
            initClockIn();
            fetchStats();
          } else {
            console.warn("⚠️ RPC devolvió fallo:", data);
            const msg = data?.mensaje || 'QR inválido.';
            showNotification(msg, 'error');
            statusText.textContent = msg + ' Reintenta.';
            statusText.style.color = 'var(--danger)';
            setTimeout(() => { isProcessing = false; }, 2000); 
          }
        } catch (err) {
          console.error("🔥 Error crítico en validación QR:", err);
          showNotification(err.message || 'Error de validación', 'error');
          statusText.textContent = (err.message.includes('Timeout') ? 'Tiempo agotado.' : 'Error de conexión.') + ' Reintenta.';
          statusText.style.color = 'var(--danger)';
          setTimeout(() => { isProcessing = false; }, 3000);
        }
      });
    } catch (err) {
      console.error("Error al iniciar cámara:", err);
      const statusText = modal.querySelector('#qr-status');
      statusText.textContent = "Error de cámara: " + (err.message || "Permiso denegado");
      statusText.style.display = "block";
    }
  };

  // Inicialización secuencial: Listar cámaras -> Pedir permiso -> Iniciar
  Html5Qrcode.getCameras().then(results => {
    cameras = results;
    if (cameras && cameras.length > 0) {
      const switchBtn = modal.querySelector('#switch-camera-btn');
      if (cameras.length > 1) {
        switchBtn.style.display = 'block';
        switchBtn.onclick = async () => {
          currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
          if (html5QrCode.isScanning) {
            await html5QrCode.stop();
            startScanning(cameras[currentCameraIndex].id);
          }
        };
      }
      // Preferimos la cámara trasera inicialmente
      const backCamIndex = cameras.findIndex(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('trasera'));
      currentCameraIndex = backCamIndex !== -1 ? backCamIndex : 0;
      startScanning(cameras[currentCameraIndex].id);
    } else {
      // Intento fallback con facingMode si getCameras falla o devuelve vacío
      startScanning({ facingMode: "environment" });
    }
  }).catch(err => {
    console.warn("Fallo al listar cámaras, intentando modo directo:", err);
    startScanning({ facingMode: "environment" });
  });

  modal.querySelector('#close-qr-modal').addEventListener('click', async () => {
    try {
      if (html5QrCode.isScanning) await html5QrCode.stop();
    } catch(e) {}
    modal.remove();
  });
}

function showResetPasswordModal() {
  if (isResetModalOpen) return;
  isResetModalOpen = true;

  const modal = document.createElement('div');
  modal.id = 'reset-password-modal';
  modal.className = 'modal-overlay animate-in';
  modal.innerHTML = `
    <div class="card glass modal-content" style="max-width: 400px; width: 90%;">
      <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i data-lucide="key"></i> Nueva Contraseña
      </h3>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.5rem;">
        Por favor, ingresa tu nueva contraseña para completar el reseteo.
      </p>
      <div class="form-group">
        <label for="new-password">Nueva Contraseña</label>
        <input type="password" id="new-password" required placeholder="••••••••" style="width: 100%;">
      </div>
      <div class="form-group">
        <label for="confirm-password">Confirmar Contraseña</label>
        <input type="password" id="confirm-password" required placeholder="••••••••" style="width: 100%;">
      </div>
      <div style="display: flex; gap: 1rem; margin-top: 2rem;">
        <button id="cancel-reset" style="flex: 1; background: var(--surface);">Cancelar</button>
        <button id="confirm-reset" style="flex: 2; background: var(--accent-gradient);">Actualizar Contraseña</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();

  const confirmBtn = modal.querySelector('#confirm-reset');
  const cancelBtn = modal.querySelector('#cancel-reset');

  confirmBtn.onclick = async () => {
    const password = modal.querySelector('#new-password').value;
    const confirm = modal.querySelector('#confirm-password').value;

    if (!password || password.length < 6) {
      showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    if (password !== confirm) {
      showNotification('Las contraseñas no coinciden', 'error');
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Actualizando...';

    try {
      console.log('Attempting to update password...');
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error('Update password error:', error);
        showNotification('Error: ' + error.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Actualizar Contraseña';
      } else {
        console.log('Password updated successfully');
        showNotification('Contraseña actualizada con éxito', 'success');
        modal.remove();
        isResetModalOpen = false;
        await supabase.auth.signOut();
        renderAuth();
      }
    } catch (err) {
      console.error('Update password exception:', err);
      // Supabase sometimes throws a 'Lock broken' error even if the update succeeded
      if (err.message && err.message.includes('Lock broken')) {
        console.warn('Handling lock broken error as success...');
        showNotification('Contraseña actualizada (con advertencia de sesión)', 'success');
        modal.remove();
        isResetModalOpen = false;
        await supabase.auth.signOut();
        renderAuth();
      } else {
        showNotification('Error inesperado: ' + err.message, 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Actualizar Contraseña';
      }
    }
  };

  cancelBtn.onclick = async () => {
    modal.remove();
    isResetModalOpen = false;
    await supabase.auth.signOut();
    renderAuth();
  };
}

init();
