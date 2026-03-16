export function showNotification(message, type = 'info') {
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
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: { class: 'lucide-icon' },
      nameAttr: 'data-lucide'
    });
  }

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
