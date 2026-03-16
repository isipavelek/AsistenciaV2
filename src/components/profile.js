import { supabase } from '../lib/supabase.js';
import { showNotification } from '../lib/notifications.js';

/**
 * Renders the User Profile management view
 */
export async function renderProfile(container, profile) {
  const isDirector = profile.role === 'director';

  container.innerHTML = `
    <div class="animate-in" style="max-width: 600px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="user"></i> Mi Perfil</h2>
        <span class="badge" style="background: var(--accent-gradient);">${profile.role.toUpperCase()}</span>
      </div>

      <div class="card glass">
        <form id="profile-form">
          <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group" style="flex: 1;">
              <label>Nombre</label>
              <input type="text" id="profile-first-name" value="${profile.first_name || ''}" ${isDirector ? '' : 'disabled style="opacity: 0.7; cursor: not-allowed;"'}>
            </div>
            <div class="form-group" style="flex: 1;">
              <label>Apellido</label>
              <input type="text" id="profile-last-name" value="${profile.last_name || ''}" ${isDirector ? '' : 'disabled style="opacity: 0.7; cursor: not-allowed;"'}>
            </div>
          </div>

          <div class="form-group">
            <label>Correo Electrónico</label>
            <input type="email" id="profile-email" value="${profile.email}" ${isDirector ? '' : 'disabled style="opacity: 0.7; cursor: not-allowed;"'}>
          </div>

          <div style="display: flex; gap: 1rem;">
            <div class="form-group" style="flex: 1;">
              <label>Legajo UTN</label>
              <input type="text" id="profile-legajo" value="${profile.legajo_utn || ''}" ${isDirector ? '' : 'disabled style="opacity: 0.7; cursor: not-allowed;"'}>
            </div>
            <div class="form-group" style="flex: 1;">
              <label>Grupo / Sección</label>
              ${isDirector ? `
                <select id="profile-group">
                  <option value="Administrativo" ${profile.personnel_group === 'Administrativo' ? 'selected' : ''}>Administrativo</option>
                  <option value="Servicios Generales" ${profile.personnel_group === 'Servicios Generales' ? 'selected' : ''}>Servicios Generales</option>
                </select>
              ` : `
                <input type="text" value="${profile.personnel_group || '--'}" disabled style="opacity: 0.7; cursor: not-allowed;">
              `}
            </div>
          </div>

          <div class="form-group">
             <label>Categoría / Cargo</label>
             <input type="text" id="profile-category" value="${profile.category || ''}" ${isDirector ? '' : 'disabled style="opacity: 0.7; cursor: not-allowed;"'}>
          </div>

          <hr style="border: 0; border-top: 1px solid var(--glass-border); margin: 2rem 0;">
          <h4 style="margin-bottom: 1rem; color: var(--secondary);">Información Editable</h4>

          <div class="form-group">
            <label>Dirección Particular</label>
            <input type="text" id="profile-address" value="${profile.address || ''}" placeholder="Ej: Av. Rivadavia 123, Pilar">
          </div>

          <div class="form-group">
            <label>Fecha de Nacimiento</label>
            <input type="date" id="profile-birth" value="${profile.birth_date || ''}">
          </div>

          <div style="display: flex; gap: 1rem; margin-top: 2rem;">
            <button type="submit" id="save-profile-btn" style="background: var(--accent-gradient);">Guardar Cambios</button>
            <button type="button" id="back-to-dash" style="background: var(--surface);">Volver al Dashboard</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#profile-form');
  const saveBtn = container.querySelector('#save-profile-btn');

  form.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const updates = {
      id: profile.id, // Ensure ID is present for upsert
      address: container.querySelector('#profile-address').value,
      birth_date: container.querySelector('#profile-birth').value || null,
      updated_at: new Date().toISOString(),
    };

    if (isDirector) {
      updates.first_name = container.querySelector('#profile-first-name').value;
      updates.last_name = container.querySelector('#profile-last-name').value;
      updates.email = container.querySelector('#profile-email').value;
      updates.legajo_utn = container.querySelector('#profile-legajo').value;
      updates.personnel_group = container.querySelector('#profile-group').value;
      updates.category = container.querySelector('#profile-category').value;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(updates);

    if (error) {
      showNotification('Error al actualizar el perfil: ' + error.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar Cambios';
    } else {
      showNotification('¡Perfil actualizado con éxito!', 'success');
      // Update global profile object
      Object.assign(profile, updates);
      renderProfile(container, profile);
    }
  };

  if (window.lucide) window.lucide.createIcons();
}
