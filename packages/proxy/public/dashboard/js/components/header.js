import { toggleTheme, getCurrentTheme } from '../utils/theme.js';
import { store } from '../stores/state.js';

let el = null;

export function mount(container) {
  el = document.createElement('header');
  el.className = 'header';
  render();
  container.prepend(el);

  store.addEventListener('state-changed', onStateChanged);
}

function onStateChanged(e) {
  if (['SET_USER', 'SET_VIEW'].includes(e.detail.action)) render();
}

function render() {
  const { user, view } = store.state;
  const isAdmin = user?.role === 'tech-lead';
  const themeIcon = getCurrentTheme() === 'dark' ? '☀️' : '🌙';

  el.innerHTML = `
    <div class="container header-inner">
      <div class="header-brand">
        <h1>Claude Usage Dashboard</h1>
      </div>
      <div class="header-actions">
        ${isAdmin ? `
          <div class="view-switcher">
            <button data-view="personal" class="${view === 'personal' ? 'active' : ''}">My Usage</button>
            <button data-view="admin" class="${view === 'admin' ? 'active' : ''}">Team Overview</button>
          </div>
        ` : ''}
        <div class="user-info">
          <span>${user?.email || ''}</span>
          <span class="role-badge">${user?.role || ''}</span>
        </div>
        <button class="btn-icon" id="theme-toggle" title="Toggle theme">${themeIcon}</button>
        <button class="btn" id="logout-btn">Logout</button>
      </div>
    </div>
  `;

  el.querySelector('#theme-toggle')?.addEventListener('click', () => {
    toggleTheme();
    render();
  });

  el.querySelector('#logout-btn')?.addEventListener('click', () => {
    store.dispatchEvent(new CustomEvent('logout'));
  });

  el.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.dispatch('SET_VIEW', btn.dataset.view);
    });
  });
}

export function update() { render(); }

export function destroy() {
  store.removeEventListener('state-changed', onStateChanged);
  el?.remove();
  el = null;
}
