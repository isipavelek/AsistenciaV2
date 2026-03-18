import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';
import { renderUserSchedules } from './schedules.js';
import { logAction, getAuditLogs } from '../lib/logger.js';

/**
 * Renders the Personnel Management (ABM)
 */
export async function renderABM(container) {
  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .order('last_name', { ascending: true });

  if (error) {
    container.innerHTML = `<p style="color: var(--danger)">Error: ${error.message}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="animate-in">
      <div class="abm-header">
        <h2 class="section-title"><i data-lucide="users"></i> Gestión de Personal</h2>
        <div class="header-actions">
          <button id="import-users-btn" class="btn-secondary" title="Importar CSV">
            <i data-lucide="upload"></i> <span>Importar</span>
          </button>
          <button id="export-users-btn" class="btn-secondary" title="Exportar CSV">
            <i data-lucide="download"></i> <span>Exportar</span>
          </button>
          <button id="add-user-btn" class="btn-primary" title="Nuevo Usuario">
            <i data-lucide="user-plus"></i> <span>Nuevo</span>
          </button>
        </div>
      </div>
      <input type="file" id="csv-upload" accept=".csv" style="display: none;">

      <!-- Filters & Search Bar -->
      <div class="glass filters-bar">
        <div class="form-group search-group">
          <label>Buscar por nombre o legajo</label>
          <input type="text" id="search-user" placeholder="Ej: Perez o 7655...">
        </div>
        <div class="form-group filter-group">
          <label>Filtrar por Rol</label>
          <select id="filter-role">
            <option value="">Todos los Roles</option>
            <option value="user">Usuario</option>
            <option value="rrhh">RRHH</option>
            <option value="vicedirector">Vice-Director</option>
            <option value="director">Director</option>
          </select>
        </div>
        <div class="form-group filter-group">
          <label>Filtrar por Grupo</label>
          <select id="filter-group">
            <option value="">Todos los Grupos</option>
            <option value="Administrativo">Administrativo</option>
            <option value="Servicios Generales">Servicios Generales</option>
          </select>
        </div>
      </div>

      <div class="glass table-container">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th class="sortable" data-sort="last_name" style="padding: 1rem; cursor: pointer;">Apellido <i data-lucide="chevrons-up-down" style="width: 14px; vertical-align: middle;"></i></th>
              <th class="sortable" data-sort="first_name" style="padding: 1rem; cursor: pointer;">Nombre <i data-lucide="chevrons-up-down" style="width: 14px; vertical-align: middle;"></i></th>
              <th class="sortable" data-sort="email" style="padding: 1rem; cursor: pointer;">Email <i data-lucide="chevrons-up-down" style="width: 14px; vertical-align: middle;"></i></th>
              <th class="sortable" data-sort="legajo_utn" style="padding: 1rem; cursor: pointer;">Legajo <i data-lucide="chevrons-up-down" style="width: 14px; vertical-align: middle;"></i></th>
              <th class="sortable" data-sort="role" style="padding: 1rem; cursor: pointer;">Rol <i data-lucide="chevrons-up-down" style="width: 14px; vertical-align: middle;"></i></th>
              <th class="sortable" data-sort="category" style="padding: 1rem; cursor: pointer;">Categoría <i data-lucide="chevrons-up-down" style="width: 14px; vertical-align: middle;"></i></th>
              <th style="padding: 1rem;">Acciones</th>
            </tr>
          </thead>
          <tbody id="user-table-body">
            <!-- Table rows will be rendered here -->
          </tbody>
        </table>
      </div>
      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>

    <!-- User Modal (Remains the same as before) -->
    <div id="user-modal" class="modal-overlay" style="display: none;">
      <div class="card glass modal-content" style="max-width: 500px; width: 90%;">
        <h2 id="modal-title">Nuevo Usuario</h2>
        <form id="user-form">
          <!-- ... (modal content kept as is for brevity, will be in full file) ... -->
          <input type="hidden" id="user-id">
          <div class="form-group">
            <label>Correo Electrónico</label>
            <input type="email" id="user-email" required>
            <p id="email-note" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; display: none;">* Solo editable desde Auth</p>
          </div>
          <div id="password-group" class="form-group">
            <label>Contraseña Temporal</label>
            <input type="password" id="user-password" placeholder="Mínimo 6 caracteres">
          </div>
          <div style="display: flex; gap: 1rem;">
            <div class="form-group" style="flex: 1;">
              <label>Nombre</label>
              <input type="text" id="user-first-name" required>
            </div>
            <div class="form-group" style="flex: 1;">
              <label>Apellido</label>
              <input type="text" id="user-last-name" required>
            </div>
          </div>
          <div style="display: flex; gap: 1rem;">
            <div class="form-group" style="flex: 1;">
              <label>Legajo UTN</label>
              <input type="text" id="user-legajo">
            </div>
            <div class="form-group" style="flex: 1;">
              <label>Rol</label>
              <select id="user-role">
                <option value="user">Usuario</option>
                <option value="rrhh">RRHH</option>
                <option value="vicedirector">Vice-Director</option>
                <option value="director">Director</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Grupo / Sección</label>
            <select id="user-group">
              <option value="Administrativo">Administrativo</option>
              <option value="Servicios Generales">Servicios Generales</option>
            </select>
          </div>
          <div class="form-group">
            <label>Categoría / Cargo</label>
            <input type="text" id="user-category" placeholder="Ej: Jefe de Preceptores">
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button type="submit" style="background: var(--accent-gradient);">Guardar</button>
            <button type="button" id="close-modal" style="background: var(--surface);">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const tableBody = container.querySelector('#user-table-body');
  let currentSort = { column: 'last_name', direction: 'asc' };
  
  function updateTable() {
    const query = container.querySelector('#search-user').value.toLowerCase();
    const roleFilter = container.querySelector('#filter-role').value;
    const groupFilter = container.querySelector('#filter-group').value;

    let filtered = users.filter(u => {
      const firstName = u.first_name || '';
      const lastName = u.last_name || '';
      const fullName = (firstName + ' ' + lastName).toLowerCase();
      const matchesSearch = fullName.includes(query) || 
                            (u.legajo_utn || '').toLowerCase().includes(query);
      const matchesRole = roleFilter === '' || u.role === roleFilter;
      const matchesGroup = groupFilter === '' || u.personnel_group === groupFilter;
      
      return matchesSearch && matchesRole && matchesGroup;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      let valA = a[currentSort.column] || '';
      let valB = b[currentSort.column] || '';
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    tableBody.innerHTML = filtered.map(u => `
      <tr style="border-bottom: 1px solid var(--glass-border);">
        <td style="padding: 1rem;" data-label="Apellido">${u.last_name || '--'}</td>
        <td style="padding: 1rem;" data-label="Nombre">${u.first_name || '--'}</td>
        <td style="padding: 1rem; font-size: 0.875rem;" data-label="Email">${u.email}</td>
        <td style="padding: 1rem;" data-label="Legajo">${u.legajo_utn || '--'}</td>
        <td style="padding: 1rem;" data-label="Rol"><span class="badge" style="background: rgba(255,255,255,0.1);">${u.role}</span></td>
        <td style="padding: 1rem;" data-label="Categoría">${u.category || '--'}</td>
        <td style="padding: 1rem;" data-label="Acciones">
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; justify-content: flex-end;">
            <button class="edit-user btn-icon-sq" data-id="${u.id}" title="Editar Perfil" style="background: var(--surface);">
              <i data-lucide="user-cog" style="width: 16px;"></i>
            </button>
            <button class="manage-schedules btn-icon-sq" data-id="${u.id}" data-name="${u.first_name} ${u.last_name}" title="Gestionar Horarios" style="background: var(--surface); border-color: var(--secondary);">
              <i data-lucide="calendar-clock" style="width: 16px;"></i>
            </button>
            <button class="reset-pass btn-icon-sq" data-email="${u.email}" title="Resetear Contraseña" style="background: var(--surface); border-color: var(--primary-light);">
              <i data-lucide="key-round" style="width: 16px;"></i>
            </button>
            <button class="delete-user btn-icon-sq" data-id="${u.id}" title="Eliminar Usuario" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">
              <i data-lucide="trash-2" style="width: 16px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // Initial render
  updateTable();

  // Event listeners for filters
  container.querySelector('#search-user').oninput = updateTable;
  container.querySelector('#filter-role').onchange = updateTable;
  container.querySelector('#filter-group').onchange = updateTable;

  container.querySelectorAll('.sortable').forEach(th => {
    th.onclick = () => {
      const col = th.dataset.sort;
      if (currentSort.column === col) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = col;
        currentSort.direction = 'asc';
      }
      updateTable();
      if (window.lucide) window.lucide.createIcons();
    };
  });

  // Modal logic
  const modal = container.querySelector('#user-modal');
  const userForm = container.querySelector('#user-form');
  
  container.querySelector('#add-user-btn').onclick = () => {
    userForm.reset();
    container.querySelector('#user-id').value = '';
    container.querySelector('#modal-title').textContent = 'Nuevo Usuario';
    container.querySelector('#password-group').style.display = 'block';
    container.querySelector('#email-note').style.display = 'none';
    container.querySelector('#user-email').disabled = false;
    modal.style.display = 'flex';
  };

  container.querySelector('#close-modal').onclick = () => modal.style.display = 'none';

  container.onclick = async (e) => {
    if (e.target.classList.contains('edit-user')) {
      const id = e.target.dataset.id;
      const user = users.find(u => u.id === id);
      if (user) {
        container.querySelector('#user-id').value = user.id;
        container.querySelector('#user-email').value = user.email;
        container.querySelector('#user-first-name').value = user.first_name || '';
        container.querySelector('#user-last-name').value = user.last_name || '';
        container.querySelector('#user-legajo').value = user.legajo_utn || '';
        container.querySelector('#user-role').value = user.role;
        container.querySelector('#user-group').value = user.personnel_group || 'Administrativo';
        container.querySelector('#user-category').value = user.category || '';
        
        container.querySelector('#modal-title').textContent = 'Editar Usuario';
        container.querySelector('#password-group').style.display = 'none';
        container.querySelector('#email-note').style.display = 'block';
        container.querySelector('#user-email').disabled = true;
        modal.style.display = 'flex';
      }
    }

    if (e.target.classList.contains('reset-pass')) {
      const email = e.target.dataset.email;
      if (confirm(`¿Enviar correo de reseteo de contraseña a ${email}?`)) {
        const { error: resError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (resError) showNotification(resError.message, 'error');
        else showNotification('Correo de recuperación enviado con éxito', 'success');
      }
    }

    if (e.target.classList.contains('manage-schedules')) {
      const { id, name } = e.target.dataset;
      renderUserSchedules(container, id, name);
    }

    if (e.target.classList.contains('delete-user')) {
      if (confirm('¿Estás seguro de eliminar este usuario?')) {
        const { error: delError } = await supabase.from('profiles').delete().eq('id', e.target.dataset.id);
        if (delError) showNotification(delError.message, 'error');
        else {
          showNotification('Usuario eliminado correctamente', 'success');
          renderABM(container);
        }
      }
    }
  };

  userForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = container.querySelector('#user-id').value;
    const btn = userForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const userData = {
      first_name: container.querySelector('#user-first-name').value,
      last_name: container.querySelector('#user-last-name').value,
      legajo_utn: container.querySelector('#user-legajo').value,
      role: container.querySelector('#user-role').value,
      personnel_group: container.querySelector('#user-group').value,
      category: container.querySelector('#user-category').value,
    };

    try {
      if (id) {
        // Update
        const { error: upError } = await supabase.from('profiles').update(userData).eq('id', id);
        if (upError) throw upError;
        showNotification('Perfil actualizado correctamente', 'success');
      } else {
        // Create new (sign up) using isolated admin client
        const email = container.querySelector('#user-email').value;
        const password = container.querySelector('#user-password').value;
        
        if (!password || password.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }

        // Use supabaseAdmin to prevent the current admin session from being replaced
        const { data: signUpData, error: signError } = await supabaseAdmin.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: userData.first_name,
              last_name: userData.last_name,
              legajo_utn: userData.legajo_utn,
              role: userData.role,
              personnel_group: userData.personnel_group,
              category: userData.category
            }
          }
        });

        if (signError) throw signError;
        
        if (!signUpData?.user) {
          throw new Error('El usuario ya existe o no se pudo crear.');
        }

        const userId = signUpData.user.id;

        // Try a fallback update in case the trigger isn't updated in the DB yet
        // We do this silently or with a non-blocking check
        setTimeout(async () => {
          try {
            await supabase.from('profiles').update(userData).eq('id', userId);
          } catch (e) {
            console.warn('Fallback update failed, trigger might have handled it:', e);
          }
        }, 1000);
        
        showNotification('Usuario creado correctamente. Si no aparece en la lista, refresca la página.', 'success');
      }

      modal.style.display = 'none';
      renderABM(container);
      
      // Log Action
      logAction(id ? 'EDIT_USER' : 'CREATE_USER', { 
        email: id ? userData.email : container.querySelector('#user-email').value,
        name: `${userData.first_name} ${userData.last_name}`,
        role: userData.role
      });

    } catch (err) {
      showNotification(err.message, 'error');
      btn.disabled = false;
      btn.textContent = id ? 'Guardar' : 'Crear';
    }
  };

  // Bulk Actions
  container.querySelector('#export-users-btn').onclick = () => {
    const headers = ['ID', 'Email', 'Nombre', 'Apellido', 'Legajo', 'Rol', 'Grupo', 'Categoria'];
    const rows = users.map(u => [
      u.id, u.email, u.first_name, u.last_name, u.legajo_utn, u.role, u.personnel_group, u.category
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `personal_utn_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    logAction('EXPORT_USERS_CSV', { count: users.length });
  };

  const csvInput = container.querySelector('#csv-upload');
  container.querySelector('#import-users-btn').onclick = () => csvInput.click();
  
  csvInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',');
      const data = lines.slice(1).map(l => l.split(','));

      showNotification(`Procesando ${data.length} usuarios...`, 'info');
      
      let successCount = 0;
      let errorCount = 0;

      for (const row of data) {
        try {
          // Simplistic import: Assume structure [email, password, first_name, last_name, role, group, category]
          const [email, password, first_name, last_name, role, group, category] = row;
          
          const { error: signError } = await supabaseAdmin.auth.signUp({
            email, password,
            options: {
              data: { first_name, last_name, role, personnel_group: group, category }
            }
          });

          if (signError) throw signError;
          successCount++;
        } catch (err) {
          console.error('Error importing user:', err);
          errorCount++;
        }
      }

      showNotification(`Importación finalizada. Éxitos: ${successCount}, Errores: ${errorCount}`, successCount > 0 ? 'success' : 'error');
      logAction('IMPORT_USERS_CSV', { success: successCount, errors: errorCount });
      renderABM(container);
    };
    reader.readAsText(file);
  };

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Renders the Authorization Manager
 */
export async function renderAuthorizations(container) {
  // Get current user profile to check for Director role
  const { data: { session } } = await supabase.auth.getSession();
  let userProfile = null;
  if (session) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    userProfile = profile;
  }
  const isDirector = userProfile?.role === 'director';

  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="shield-check"></i> Gestión de Autorizaciones</h2>
        <button id="back-to-dash" class="btn-secondary" style="width: auto;">Volver al Dashboard</button>
      </div>

      <div class="card glass" style="margin-bottom: 2rem; padding: 1.5rem;">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 1rem; align-items: end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; margin-bottom: 0.3rem;">Buscar Personal</label>
            <input type="text" id="auth-search" placeholder="Nombre o legajo..." style="padding: 0.6rem;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; margin-bottom: 0.3rem;">Estado</label>
            <select id="auth-status-filter" style="padding: 0.6rem;">
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
              <option value="all">Todas</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; margin-bottom: 0.3rem;">Desde</label>
            <input type="date" id="auth-date-from" style="padding: 0.6rem;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; margin-bottom: 0.3rem;">Hasta</label>
            <input type="date" id="auth-date-to" style="padding: 0.6rem;">
          </div>
          <button id="clear-auth-filters" title="Limpiar Filtros" style="width: auto; padding: 0.6rem; background: var(--surface); border: 1px solid var(--glass-border); color: var(--text-muted);">
            <i data-lucide="filter-x" style="width: 18px;"></i>
          </button>
        </div>
      </div>

      <div class="card glass" style="padding: 0; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: rgba(255,255,255,0.05); border-bottom: 1px solid var(--glass-border);">
              <th class="admin-sortable" data-key="personal" style="padding: 1rem; cursor: pointer;">Personal <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th class="admin-sortable" data-key="type" style="padding: 1rem; cursor: pointer;">Tipo de Licencia <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th class="admin-sortable" data-key="start_date" style="padding: 1rem; cursor: pointer;">Desde <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th class="admin-sortable" data-key="end_date" style="padding: 1rem; cursor: pointer;">Hasta <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th class="admin-sortable" data-key="status" style="padding: 1rem; cursor: pointer;">Estado <i data-lucide="chevrons-up-down" style="width: 14px; opacity: 0.5;"></i></th>
              <th style="padding: 1rem;">Acciones</th>
            </tr>
          </thead>
          <tbody id="auths-table-body">
            <tr><td colspan="6" style="padding: 2rem; text-align: center;">Cargando solicitudes...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let allReqs = [];
  let currentFilter = 'pending';
  let searchTerm = '';
  let dateFrom = '';
  let dateTo = '';
  let sortConfig = { key: 'start_date', direction: 'desc' };

  async function loadAuths() {
    const { data, error } = await supabase
      .from('authorizations')
      .select('*, profiles!user_id(first_name, last_name, legajo_utn)')
      .order('created_at', { ascending: false });

    if (error) {
      showNotification('Error al cargar autorizaciones: ' + error.message, 'error');
      return;
    }
    allReqs = data;
    renderAuthTable();
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

  function renderAuthTable() {
    const tbody = container.querySelector('#auths-table-body');
    const filterEl = container.querySelector('#auth-status-filter');
    const searchEl = container.querySelector('#auth-search');
    const fromEl = container.querySelector('#auth-date-from');
    const toEl = container.querySelector('#auth-date-to');
    
    if (!tbody || !filterEl || !searchEl || !fromEl || !toEl) return;

    currentFilter = filterEl.value;
    searchTerm = searchEl.value.toLowerCase();
    dateFrom = fromEl.value;
    dateTo = toEl.value;

    let filtered = allReqs.filter(r => {
      const p = r.profiles || { first_name: 'Desconocido', last_name: '', legajo_utn: '???' };
      const nameMatch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm) || 
                        (p.legajo_utn || '').toLowerCase().includes(searchTerm);
      const statusMatch = currentFilter === 'all' || r.status === currentFilter;
      
      let dateMatch = true;
      const rDate = r.start_date || r.date;
      if (dateFrom && rDate < dateFrom) dateMatch = false;
      if (dateTo && rDate > dateTo) dateMatch = false;

      return nameMatch && statusMatch && dateMatch;
    });

    // Integrated Sorting Logic
    filtered.sort((a, b) => {
      let valA, valB;
      
      if (sortConfig.key === 'personal') {
        const pA = a.profiles || { last_name: 'zzz' };
        const pB = b.profiles || { last_name: 'zzz' };
        valA = pA.last_name.toLowerCase();
        valB = pB.last_name.toLowerCase();
      } else {
        valA = a[sortConfig.key] || '';
        valB = b[sortConfig.key] || '';
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">
        ${allReqs.length === 0 ? 'No hay solicitudes registradas en el sistema.' : 'No se encontraron solicitudes con esos filtros.'}
      </td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const p = r.profiles || { first_name: 'Desconocido', last_name: '', legajo_utn: '???' };
      const attachment = r.metadata?.attachment_path;

      return `
        <tr style="border-bottom: 1px solid var(--glass-border);">
          <td style="padding: 1rem;">
            <div style="font-weight: bold;">${p.last_name}, ${p.first_name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.legajo_utn || '---'}</div>
          </td>
          <td style="padding: 1rem;">${r.type}</td>
          <td style="padding: 1rem;">${safeFormatDate(r.start_date || r.date)}</td>
          <td style="padding: 1rem;">${safeFormatDate(r.end_date)}</td>
          <td style="padding: 1rem;">
            <span class="badge badge-${r.status}">${r.status.toUpperCase()}</span>
          </td>
          <td style="padding: 1rem;">
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
              ${r.status === 'pending' ? `
                <button class="approve-req" data-id="${r.id}" style="width: auto; padding: 0.25rem 0.5rem; background: var(--success); font-size: 0.75rem; border:none; color:white;">Aprobar</button>
                <button class="reject-req" data-id="${r.id}" style="width: auto; padding: 0.25rem 0.5rem; background: var(--danger); font-size: 0.75rem; border:none; color:white;">Rechazar</button>
              ` : `
                <button class="reset-req" data-id="${r.id}" style="width: auto; padding: 0.25rem 0.5rem; background: var(--surface); color: var(--text-muted); font-size: 0.75rem;">Revertir</button>
              `}
              ${attachment ? `
                <button class="view-attachment" data-path="${attachment}" title="Ver Comprobante" style="width: auto; padding: 0.25rem 0.5rem; background: var(--secondary); color: white; border: none; font-size: 0.75rem; border-radius: 4px; display: flex; align-items: center; gap: 0.25rem;">
                  <i data-lucide="paperclip" style="width: 14px;"></i> Ver Adjunto
                </button>
              ` : ''}
              ${isDirector ? `
                <button class="delete-req" data-id="${r.id}" title="Eliminar definitivamente" style="width: auto; padding: 0.25rem 0.5rem; background: rgba(239, 68, 68, 0.1); color: var(--danger); border: none; font-size: 0.75rem; border-radius: 4px; cursor: pointer;">
                  <i data-lucide="trash-2" style="width: 14px;"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
        ${r.notes ? `<tr><td colspan="6" style="padding: 0 1rem 0.5rem 1rem; font-size: 0.8rem; color: var(--text-dim);"><em>Nota Usuario: ${r.notes}</em></td></tr>` : ''}
        ${r.admin_notes ? `<tr><td colspan="6" style="padding: 0.2rem 1rem 1rem 1rem; font-size: 0.8rem; color: var(--secondary); font-weight: 500;"><em>Respuesta Admin: ${r.admin_notes}</em></td></tr>` : ''}
        <tr style="border-bottom: 1px solid var(--glass-border);"><td colspan="6" style="padding:0;"></td></tr>
      `;
    }).join('');

    // Attach events locally
    tbody.querySelectorAll('.approve-req').forEach(btn => btn.onclick = () => updateStatus(btn.dataset.id, 'approved'));
    tbody.querySelectorAll('.reject-req').forEach(btn => btn.onclick = () => updateStatus(btn.dataset.id, 'rejected'));
    tbody.querySelectorAll('.reset-req').forEach(btn => btn.onclick = () => updateStatus(btn.dataset.id, 'pending'));
    tbody.querySelectorAll('.delete-req').forEach(btn => btn.onclick = () => deleteAuth(btn.dataset.id));
    tbody.querySelectorAll('.view-attachment').forEach(btn => btn.onclick = () => {
      const path = btn.dataset.path;
      const { data } = supabase.storage.from('certificates').getPublicUrl(path);
      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      } else {
        showNotification('No se pudo obtener la URL del adjunto', 'error');
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function updateStatus(id, newStatus) {
    const actionLabel = newStatus === 'approved' ? 'Aprobar' : (newStatus === 'rejected' ? 'Rechazar' : 'Revertir');
    const adminNotes = (newStatus === 'approved' || newStatus === 'rejected') ? prompt(`Comentario opcional para ${actionLabel}:`, '') : null;
    
    // If user cancelled prompt, it returns null. We treat it as "no comment" but proceed with status change unless we decide otherwise.
    // In this case, we'll only cancel if we want a REASON for rejection, but user said "optional".
    
    const payload = { status: newStatus };
    if (adminNotes !== null) payload.admin_notes = adminNotes;

    const { error } = await supabase.from('authorizations').update(payload).eq('id', id);
    if (error) showNotification(error.message, 'error');
    else {
      showNotification('Estado actualizado', 'success');
      loadAuths();
    }
  }

  async function deleteAuth(id) {
    if (!confirm('¿Estás seguro de eliminar este pedido definitivamente? Esta acción no se puede deshacer.')) return;
    
    // Optimistic update
    const originalReqs = [...allReqs];
    allReqs = allReqs.filter(r => r.id !== id);
    renderAuthTable();

    const { error, count, status } = await supabase
      .from('authorizations')
      .delete()
      .eq('id', id);

    console.log('Delete result:', { error, count, status });

    if (error) {
      showNotification('Error al eliminar: ' + error.message, 'error');
      allReqs = originalReqs;
      renderAuthTable();
    } else {
      showNotification('Pedido eliminado con éxito', 'success');
      loadAuths();
    }
  }

  // Setup main listeners
  container.querySelector('#auth-search').oninput = renderAuthTable;
  container.querySelector('#auth-status-filter').onchange = renderAuthTable;
  container.querySelector('#auth-date-from').onchange = renderAuthTable;
  container.querySelector('#auth-date-to').onchange = renderAuthTable;
  container.querySelector('#clear-auth-filters').onclick = () => {
    container.querySelector('#auth-search').value = '';
    container.querySelector('#auth-status-filter').value = 'pending';
    container.querySelector('#auth-date-from').value = '';
    container.querySelector('#auth-date-to').value = '';
    renderAuthTable();
  };

  document.querySelectorAll('.admin-sortable').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.key;
      if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
      }
      renderAuthTable();
    };
  });

  loadAuths();
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Renders the Reports and Statistics view
 */
export async function renderReports(container) {
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('*, profiles(first_name, last_name, legajo_utn)')
    .order('check_in', { ascending: false });

  if (error) {
    container.innerHTML = `<p style="color: var(--danger)">Error: ${error.message}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h2>Reportes de Asistencia</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button id="download-csv" style="width: auto; padding: 0.5rem 1rem; background: var(--surface);">CSV</button>
          <button id="download-excel" style="width: auto; padding: 0.5rem 1rem; background: var(--success); color: white;">Excel (.xlsx)</button>
        </div>
      </div>
      <div class="glass" style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: 1rem;">Fecha</th>
              <th style="padding: 1rem;">Personal</th>
              <th style="padding: 1rem;">Entrada</th>
              <th style="padding: 1rem;">Salida</th>
              <th style="padding: 1rem;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${attendance.map(a => `
              <tr style="border-bottom: 1px solid var(--glass-border);">
                <td style="padding: 1rem;">${a.check_in ? new Date(a.check_in).toLocaleDateString() : '---'}</td>
                <td style="padding: 1rem;">${a.profiles?.last_name || 'N/A'}, ${a.profiles?.first_name || 'N/A'}</td>
                <td style="padding: 1rem;">${a.check_in ? new Date(a.check_in).toLocaleTimeString() : '--:--'}</td>
                <td style="padding: 1rem;">${a.check_out ? new Date(a.check_out).toLocaleTimeString() : '--:--'}</td>
                <td style="padding: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                  <span class="badge badge-${a.status}">${a.status === 'present' ? 'Presente' : (a.status === 'late' ? 'Tardanza' : (a.status === 'justified' ? 'Justificado' : 'Ausente'))}</span>
                  ${a.status === 'late' && !a.is_compensated ? `
                    <button class="compensate-btn" data-id="${a.id}" style="width: auto; padding: 0.15rem 0.4rem; font-size: 0.7rem; background: var(--secondary);">Compensar</button>
                  ` : (a.is_compensated ? '<span class="badge" style="background: var(--success); font-size: 0.6rem;">Compensado</span>' : '')}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  document.querySelector('#download-csv').onclick = () => {
    const csv = [
      ['Fecha', 'Legajo', 'Nombre', 'Entrada', 'Salida', 'Estado'].join(','),
      ...attendance.map(a => [
        new Date(a.check_in).toLocaleDateString(),
        a.profiles.legajo_utn,
        `"${a.profiles.last_name} ${a.profiles.first_name}"`,
        new Date(a.check_in).toLocaleTimeString(),
        a.check_out ? new Date(a.check_out).toLocaleTimeString() : '',
        a.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  document.querySelector('#download-excel').onclick = () => {
    const data = attendance.map(a => ({
      Fecha: a.check_in ? new Date(a.check_in).toLocaleDateString() : '---',
      Legajo: a.profiles?.legajo_utn || '---',
      Nombre: `${a.profiles?.last_name || ''}, ${a.profiles?.first_name || ''}`,
      Entrada: a.check_in ? new Date(a.check_in).toLocaleTimeString() : '--:--',
      Salida: a.check_out ? new Date(a.check_out).toLocaleTimeString() : '--:--',
      Estado: a.status.toUpperCase(),
      Compensado: a.is_compensated ? 'SÍ' : 'NO'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `Reporte_Asistencia_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  container.onclick = async (e) => {
    if (e.target.classList.contains('compensate-btn')) {
      const { error: upError } = await supabase
        .from('attendance')
        .update({ is_compensated: true, status: 'present' })
        .eq('id', e.target.dataset.id);
      if (upError) alert(upError.message);
      else renderReports(container);
    }
  };

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Renders the Audit Logs viewer
 */
export async function renderLogs(container) {
  const logs = await getAuditLogs(100);

  container.innerHTML = `
    <div class="animate-in">
      <h2 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="scroll-text"></i> Registro de Auditoría</h2>
      
      <div class="glass" style="max-height: 600px; overflow-y: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border); position: sticky; top: 0; background: var(--surface);">
              <th style="padding: 1rem;">Fecha</th>
              <th style="padding: 1rem;">Usuario</th>
              <th style="padding: 1rem;">Acción</th>
              <th style="padding: 1rem;">Detalles</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr style="border-bottom: 1px solid var(--glass-border);">
                <td style="padding: 1rem; font-size: 0.85rem; color: var(--text-muted);">${new Date(log.created_at).toLocaleString()}</td>
                <td style="padding: 1rem;">${log.profiles?.last_name || 'Sistema'}, ${log.profiles?.first_name || ''}</td>
                <td style="padding: 1rem;"><span class="badge" style="background: rgba(255,255,255,0.1); font-size: 0.75rem;">${log.action}</span></td>
                <td style="padding: 1rem; font-size: 0.75rem; color: var(--text-dim); max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${log.details}</td>
              </tr>
            `).join('')}
            ${logs.length === 0 ? '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay registros de auditoría.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      
      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Renders the Security/Emergency Panel (Who is in the building)
 */
export async function renderSecurityPanel(container) {
  container.innerHTML = `
    <div class="animate-in">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem; color: var(--danger);">
          <i data-lucide="shield-alert"></i> Panel de Emergencia
        </h2>
        <div id="security-stats" style="font-weight: bold; color: var(--text-muted);">
          Cargando recuento...
        </div>
      </div>

      <div class="card glass" style="border-left: 4px solid var(--danger); margin-bottom: 2rem;">
        <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">
          <strong>Atención:</strong> Esta lista muestra al personal que ha fichado entrada y **aún no ha fichado salida** en el día de hoy.
        </p>
        <button id="refresh-security" style="width: auto; padding: 0.5rem 1rem; background: var(--surface); border: 1px solid var(--glass-border); font-size: 0.8rem;">
          <i data-lucide="refresh-cw" style="width: 14px;"></i> Actualizar Lista
        </button>
      </div>

      <div class="card glass" style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--glass-border);">
              <th style="padding: 1rem;">Legajo</th>
              <th style="padding: 1rem;">Personal</th>
              <th style="padding: 1rem;">Hora de Ingreso</th>
              <th style="padding: 1rem;">Ubicación de Fichaje</th>
              <th style="padding: 1rem; text-align: center;">Estado</th>
            </tr>
          </thead>
          <tbody id="security-table-body">
            <tr><td colspan="5" style="padding: 2rem; text-align: center;">Cargando personal en planta...</td></tr>
          </tbody>
        </table>
      </div>

      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  async function loadPresentPersonnel() {
    const today = new Date().toISOString().split('T')[0];
    const tbody = container.querySelector('#security-table-body');
    const statsDiv = container.querySelector('#security-stats');

    const { data: attendance, error } = await supabase
      .from('attendance')
      .select(`
        id, 
        check_in, 
        metadata,
        profiles (
          first_name, 
          last_name, 
          legajo_utn
        )
      `)
      .gte('check_in', `${today}T00:00:00.000Z`)
      .lte('check_in', `${today}T23:59:59.999Z`)
      .is('check_out', null);

    if (error) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--danger);">Error: ${error.message}</td></tr>`;
      return;
    }

    if (!attendance || attendance.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay personal con fichaje activo actualmente.</td></tr>`;
      statsDiv.textContent = 'En planta: 0';
      return;
    }

    statsDiv.innerHTML = `En planta: <span style="color: var(--success); font-size: 1.2rem;">${attendance.length}</span>`;

    tbody.innerHTML = attendance.map(a => {
      const p = a.profiles;
      const entryTime = new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const location = a.metadata?.address || 'Ubicación validada';
      
      return `
        <tr style="border-bottom: 1px solid var(--glass-border);">
          <td style="padding: 1rem;">${p?.legajo_utn || '---'}</td>
          <td style="padding: 1rem; font-weight: 600;">${(p?.last_name + ' ' + p?.first_name).toUpperCase()}</td>
          <td style="padding: 1rem;">${entryTime}</td>
          <td style="padding: 1rem; font-size: 0.8rem; color: var(--text-muted);">${location}</td>
          <td style="padding: 1rem; text-align: center;">
            <span style="display: inline-flex; align-items: center; gap: 0.25rem; color: var(--success); font-weight: bold; font-size: 0.75rem;">
              <span style="width: 8px; height: 8px; background: var(--success); border-radius: 50%; display: inline-block; animation: pulse 2s infinite;"></span>
              PRESENTE
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  container.querySelector('#refresh-security').onclick = loadPresentPersonnel;
  loadPresentPersonnel();

  // Pulse animation for the "PRESENTE" indicator
  if (!document.getElementById('security-styles')) {
    const style = document.createElement('style');
    style.id = 'security-styles';
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.2); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
}
