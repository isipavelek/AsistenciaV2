const translations = {
  'Invalid login credentials': 'Credenciales de inicio de sesión inválidas.',
  'Email not confirmed': 'El correo electrónico no ha sido confirmado.',
  'User not found': 'Usuario no encontrado.',
  'New password should be different from the old password.': 'La nueva contraseña debe ser diferente a la anterior.',
  'Password should be at least 6 characters': 'La contraseña debe tener por lo menos 6 caracteres.',
  'Lock broken by another request with the \'steal\' option.': 'Conflicto de sesión (reintenta o refresca la página).',
  'Unable to validate email': 'No se pudo validar el correo electrónico.',
  'Failed to fetch': 'Error de conexión con el servidor.',
  'Network error': 'Error de red.',
  'Database error': 'Error de base de datos.',
  'User already registered': 'El usuario ya se encuentra registrado.'
};

export function showNotification(message, type = 'info') {
  // Translate if message starts with any key or exactly matches
  let translatedMessage = message;
  for (const [en, es] of Object.entries(translations)) {
    if (message.includes(en)) {
      translatedMessage = es;
      break;
    }
  }

  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Prevent duplicate messages being shown simultaneously
  const existingToasts = Array.from(container.querySelectorAll('.toast span'));
  if (existingToasts.some(t => t.textContent === translatedMessage)) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${icon}" style="color: var(--${type === 'info' ? 'primary-light' : type});"></i>
    <span>${translatedMessage}</span>
  `;

  container.appendChild(toast);
  
  try {
    if (window.lucide) {
      window.lucide.createIcons({
        attrs: { class: 'lucide-icon' },
        nameAttr: 'data-lucide'
      });
    }
  } catch (e) {
    console.warn('Lucide icons failed to render in notification', e);
  }

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Database Notifications
 */
export async function createNotification(supabase, userId, message, type = 'info') {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([{ user_id: userId, message, type }]);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error creating notification:', err);
    return false;
  }
}

export async function fetchUnreadNotifications(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return [];
  }
}

export async function markNotificationsAsRead(supabase, notificationIds) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', notificationIds);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    return false;
  }
}
