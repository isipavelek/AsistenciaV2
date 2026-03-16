import { supabase, supabaseAdmin } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';
import { renderUserSchedules } from './schedules.js';

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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="users"></i> Gestión de Personal</h2>
        <button id="add-user-btn" style="width: auto; padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="user-plus" style="width: 18px;"></i> Nuevo Usuario
        </button>
      </div>

      <!-- Filters & Search Bar -->
      <div class="glass" style="padding: 1rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
        <div class="form-group" style="margin-bottom: 0; flex: 2; min-width: 200px;">
          <label style="font-size: 0.75rem;">Buscar por nombre o legajo</label>
          <input type="text" id="search-user" placeholder="Ej: Perez o 7655..." style="padding: 0.5rem;">
        </div>
        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 150px;">
          <label style="font-size: 0.75rem;">Filtrar por Rol</label>
          <select id="filter-role" style="padding: 0.5rem;">
            <option value="">Todos los Roles</option>
            <option value="user">Usuario</option>
            <option value="rrhh">RRHH</option>
            <option value="vicedirector">Vice-Director</option>
            <option value="director">Director</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 150px;">
          <label style="font-size: 0.75rem;">Filtrar por Grupo</label>
          <select id="filter-group" style="padding: 0.5rem;">
            <option value="">Todos los Grupos</option>
            <option value="Administrativo">Administrativo</option>
            <option value="Servicios Generales">Servicios Generales</option>
          </select>
        </div>
      </div>

      <div class="glass" style="overflow-x: auto;">
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
      const matchesSearch = (u.first_name + ' ' + u.last_name).toLowerCase().includes(query) || 
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
        <td style="padding: 1rem;">${u.last_name || '--'}</td>
        <td style="padding: 1rem;">${u.first_name || '--'}</td>
        <td style="padding: 1rem; font-size: 0.875rem;">${u.email}</td>
        <td style="padding: 1rem;">${u.legajo_utn || '--'}</td>
        <td style="padding: 1rem;"><span class="badge" style="background: rgba(255,255,255,0.1);">${u.role}</span></td>
        <td style="padding: 1rem;">${u.category || '--'}</td>
        <td style="padding: 1rem;">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="edit-user" data-id="${u.id}" style="width: auto; padding: 0.25rem 0.5rem; background: var(--surface);">Editar</button>
            <button class="manage-schedules" data-id="${u.id}" data-name="${u.first_name} ${u.last_name}" style="width: auto; padding: 0.25rem 0.5rem; background: var(--surface); border: 1px solid var(--secondary);">Horarios</button>
            <button class="reset-pass" data-email="${u.email}" style="width: auto; padding: 0.25rem 0.5rem; background: var(--surface); border: 1px solid var(--primary-light);">Reset Pass</button>
            <button class="delete-user" data-id="${u.id}" style="width: auto; padding: 0.25rem 0.5rem; background: rgba(239, 68, 68, 0.2); color: var(--danger);">Borrar</button>
          </div>
        </td>
      </tr>
    `).join('');
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
    } catch (err) {
      showNotification(err.message, 'error');
      btn.disabled = false;
      btn.textContent = id ? 'Guardar' : 'Crear';
    }
  };

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Renders the Authorizations management
 */
export async function renderAuthorizations(container) {
  const { data: reqs, error } = await supabase
    .from('authorizations')
    .select('*, profiles!user_id(first_name, last_name)')
    .eq('status', 'pending');

  if (error) {
    container.innerHTML = `<p style="color: var(--danger)">Error: ${error.message}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="animate-in">
      <h2 style="margin-bottom: 1.5rem;">Solicitudes Pendientes</h2>
      ${reqs.length === 0 ? '<p style="color: var(--text-muted)">No hay solicitudes pendientes.</p>' : ''}
      <div class="dashboard-grid">
        ${reqs.map(r => `
          <div class="card glass">
            <h3 class="card-title">${r.profiles.last_name}, ${r.profiles.first_name}</h3>
            <p><strong>Tipo:</strong> ${r.type}</p>
            <p><strong>Fecha:</strong> ${new Date(r.start_date).toLocaleDateString()}</p>
            <p style="margin: 1rem 0; font-size: 0.875rem; color: var(--text-muted);">${r.notes || 'Sin notas'}</p>
            <div style="display: flex; gap: 0.5rem;">
              <button class="approve-req" data-id="${r.id}" style="background: var(--success);">Aprobar</button>
              <button class="reject-req" data-id="${r.id}" style="background: var(--danger);">Rechazar</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button id="back-to-dash" style="margin-top: 2rem; background: var(--surface);">Volver al Dashboard</button>
    </div>
  `;

  container.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.classList.contains('approve-req')) {
      const { error: upError } = await supabase
        .from('authorizations')
        .update({ status: 'approved' })
        .eq('id', btn.dataset.id);
      if (upError) showNotification(upError.message, 'error');
      else {
        showNotification('Solicitud aprobada', 'success');
        renderAuthorizations(container);
      }
    }
    if (btn.classList.contains('reject-req')) {
      const { error: upError } = await supabase
        .from('authorizations')
        .update({ status: 'rejected' })
        .eq('id', btn.dataset.id);
      if (upError) showNotification(upError.message, 'error');
      else {
        showNotification('Solicitud rechazada', 'error');
        renderAuthorizations(container);
      }
    }
  };

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
        <button id="download-csv" style="width: auto; padding: 0.5rem 1rem;">Exportar CSV</button>
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
                <td style="padding: 1rem;">${new Date(a.check_in).toLocaleDateString()}</td>
                <td style="padding: 1rem;">${a.profiles.last_name}, ${a.profiles.first_name}</td>
                <td style="padding: 1rem;">${new Date(a.check_in).toLocaleTimeString()}</td>
                <td style="padding: 1rem;">${a.check_out ? new Date(a.check_out).toLocaleTimeString() : '--'}</td>
                <td style="padding: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                  <span class="badge badge-${a.status === 'present' ? 'present' : (a.status === 'late' ? 'late' : 'absent')}">${a.status}</span>
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
