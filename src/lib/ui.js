/**
 * Simple UI Utilities for the system
 */

let toastContainer = null;

function getToastContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

/**
 * Shows a toast notification
 * @param {string} message 
 * @param {'success' | 'error' | 'info'} type 
 */
export function showToast(message, type = 'info') {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${icon}" style="width: 20px; height: 20px;"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  if (window.lucide) window.lucide.createIcons();

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
