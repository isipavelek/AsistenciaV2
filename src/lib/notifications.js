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
 * Requests permission for browser push notifications
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("Este navegador no soporta notificaciones de escritorio.");
    return false;
  }
  
  if (Notification.permission === "granted") return true;
  
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * Sends a browser push notification
 */
export function sendBrowserNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  new Notification(title, {
    body: body,
    icon: '/vite.svg'
  });
}
