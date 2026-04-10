const STORAGE_KEY = 'dashboard-theme';

export function getCurrentTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function initTheme() {
  document.documentElement.setAttribute('data-theme', getCurrentTheme());
}

export function toggleTheme() {
  const current = getCurrentTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.setAttribute('data-theme', next);
  return next;
}
