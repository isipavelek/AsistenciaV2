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

          <div class="form-group" style="margin: 1.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="profile-is-studying" style="width: auto; margin: 0;" ${profile.is_studying ? 'checked' : ''}>
            <label for="profile-is-studying" style="margin: 0; cursor: pointer; font-weight: 500;">¿Te encuentras estudiando actualmente?</label>
          </div>

          <div id="study-details-container" style="display: ${profile.is_studying ? 'block' : 'none'}; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--glass-border); padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem;">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label style="color: var(--secondary); font-weight: 600;">Nivel de Estudios</label>
              <select id="profile-study-level" style="background: var(--surface); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; width: 100%;">
                <option value="" ${!profile.study_level ? 'selected' : ''}>-- Selecciona el nivel --</option>
                <option value="secundario" ${profile.study_level === 'secundario' ? 'selected' : ''}>Secundario (Límite: 20 días hábiles por año, máx 4 continuos)</option>
                <option value="terciario" ${profile.study_level === 'terciario' ? 'selected' : ''}>Terciario / Profesorado (Límite: 24 días hábiles por año, máx 4 continuos)</option>
                <option value="universitario_posgrado" ${profile.study_level === 'universitario_posgrado' ? 'selected' : ''}>Universitario / Posgrado (Límite: 28 días hábiles por año, máx 5 continuos)</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label style="color: var(--secondary); font-weight: 600;">Certificado de Alumno Regular</label>
              <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                <input type="file" id="profile-certificate-file" accept=".pdf,.jpg,.jpeg,.png" style="background: rgba(255,255,255,0.03); color: white; border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.5rem; font-size: 0.85rem; flex: 1; min-width: 200px;">
                ${profile.student_certificate_url ? `
                  <a href="${profile.student_certificate_url}" target="_blank" class="btn-secondary" style="width: auto; padding: 0.5rem 1rem; text-decoration: none; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 8px; background: var(--surface);">
                    <i data-lucide="external-link" style="width: 14px; height: 14px;"></i> Ver Certificado
                  </a>
                ` : ''}
              </div>
              <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.35rem;">Formatos aceptados: PDF, JPG, PNG. Tamaño máximo: 5MB.</p>
            </div>
          </div>

          <div style="display: flex; gap: 1rem; margin-top: 2rem;">
            <button type="submit" id="save-profile-btn" style="background: var(--accent-gradient);">Guardar Cambios</button>
            <button type="button" id="back-to-dash" style="background: var(--surface);">Volver al Dashboard</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const isStudyingCheckbox = container.querySelector('#profile-is-studying');
  const studyDetailsContainer = container.querySelector('#study-details-container');
  isStudyingCheckbox.onchange = () => {
    studyDetailsContainer.style.display = isStudyingCheckbox.checked ? 'block' : 'none';
  };

  const form = container.querySelector('#profile-form');
  const saveBtn = container.querySelector('#save-profile-btn');

  form.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const isStudying = isStudyingCheckbox.checked;
    const studyLevel = container.querySelector('#profile-study-level').value;
    const fileInput = container.querySelector('#profile-certificate-file');
    let certificateUrl = profile.student_certificate_url || null;

    if (isStudying && fileInput && fileInput.files.length > 0) {
      saveBtn.textContent = 'Subiendo certificado...';
      const file = fileInput.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showNotification('El certificado no debe superar los 5MB.', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios';
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/student_certificate_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, file);

      if (uploadError) {
        console.warn('Storage upload failed:', uploadError);
        showNotification('No se pudo subir el certificado. Se guardará sin adjunto.', 'warning');
      } else {
        const { data: pubData } = supabase.storage.from('certificates').getPublicUrl(fileName);
        certificateUrl = pubData?.publicUrl || null;
      }
    }

    const updates = {
      id: profile.id, // Ensure ID is present for upsert
      address: container.querySelector('#profile-address').value,
      birth_date: container.querySelector('#profile-birth').value || null,
      is_studying: isStudying,
      study_level: isStudying ? studyLevel : null,
      student_certificate_url: isStudying ? certificateUrl : null,
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
