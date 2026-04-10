const ICONS = {
  empty: '📊',
  loading: '',
  error: '⚠️',
};

const DEFAULT_MESSAGES = {
  empty: 'No usage recorded yet',
  loading: 'Loading data...',
  error: 'Something went wrong',
};

export function mount(container, { type = 'empty', message = null } = {}) {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.dataset.type = type;

  if (type === 'loading') {
    el.innerHTML = `
      <div class="loading-spinner"></div>
      <p class="empty-state-message">${message || DEFAULT_MESSAGES.loading}</p>
    `;
  } else {
    el.innerHTML = `
      <div class="empty-state-icon">${ICONS[type] || ICONS.empty}</div>
      <p class="empty-state-message">${message || DEFAULT_MESSAGES[type] || DEFAULT_MESSAGES.empty}</p>
    `;
  }

  container.appendChild(el);
  return el;
}

export function destroy(el) {
  el?.remove();
}
