import { initTheme } from './utils/theme.js';
import { store } from './stores/state.js';
import { setAuth0Client, get, downloadCsv } from './api/client.js';
import * as header from './components/header.js';
import * as datePicker from './components/date-picker.js';
import * as summaryCards from './components/summary-cards.js';
import * as dailyChart from './components/daily-chart.js';
import * as modelChart from './components/model-chart.js';
import * as roleChart from './components/role-chart.js';
import * as userTable from './components/user-table.js';
import * as trendChart from './components/trend-chart.js';
import * as emptyState from './components/empty-state.js';

let auth0Client = null;
let loadingEl = null;
let personalSection = null;
let adminSection = null;
let debounceTimer = null;

async function init() {
  initTheme();

  const config = window.__DASHBOARD_CONFIG__;
  if (!config || !config.auth0ClientId) {
    showError('Dashboard not configured. AUTH0_DASHBOARD_CLIENT_ID is required.');
    return;
  }

  try {
    auth0Client = await auth0.createAuth0Client({
      domain: config.auth0Domain,
      clientId: config.auth0ClientId,
      authorizationParams: {
        audience: config.auth0Audience,
        redirect_uri: window.location.origin + '/dashboard/callback',
      },
    });

    setAuth0Client(auth0Client);

    // Handle callback redirect
    if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, '/dashboard');
    }

    const isAuthenticated = await auth0Client.isAuthenticated();
    if (!isAuthenticated) {
      await auth0Client.loginWithRedirect({
        appState: { returnTo: '/dashboard' },
      });
      return;
    }

    const user = await auth0Client.getUser();
    const token = await auth0Client.getTokenSilently();
    const claims = parseJwt(token);
    const namespace = config.auth0Audience;
    const role = claims[`${namespace}/role`] || claims.role || 'developer';

    store.dispatch('SET_USER', {
      sub: user.sub,
      email: user.email || user.name || 'Unknown',
      role,
    });

    mountApp();
    await loadData();

  } catch (err) {
    console.error('Auth init error:', err);
    showError(`Authentication failed: ${err.message}`);
  }
}

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

function mountApp() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  // Header
  header.mount(app);

  // Content wrapper
  const content = document.createElement('div');
  content.className = 'container dashboard-content';
  app.appendChild(content);

  // Date picker
  datePicker.mount(content);

  // Personal section
  personalSection = document.createElement('div');
  personalSection.id = 'personal-view';
  content.appendChild(personalSection);

  summaryCards.mount(personalSection);

  const chartsRow = document.createElement('div');
  chartsRow.className = 'charts-row';
  personalSection.appendChild(chartsRow);

  dailyChart.mount(chartsRow);
  modelChart.mount(chartsRow);

  // Admin section
  const { user } = store.state;
  if (user?.role === 'tech-lead') {
    adminSection = document.createElement('div');
    adminSection.id = 'admin-view';
    adminSection.style.display = 'none';
    content.appendChild(adminSection);

    const adminHeader = document.createElement('div');
    adminHeader.className = 'section-header';
    adminHeader.innerHTML = `
      <h2>Team Overview</h2>
      <button class="btn btn-primary" id="export-btn">Export CSV</button>
    `;
    adminSection.appendChild(adminHeader);

    adminHeader.querySelector('#export-btn').addEventListener('click', onExport);

    // Admin summary cards
    const adminCards = document.createElement('div');
    adminCards.id = 'admin-cards';
    adminSection.appendChild(adminCards);
    // Reuse summary-cards pattern inline for admin totals
    adminCards.className = 'cards-grid';

    const adminChartsRow = document.createElement('div');
    adminChartsRow.className = 'charts-row';
    adminSection.appendChild(adminChartsRow);

    roleChart.mount(adminChartsRow);
    trendChart.mount(adminChartsRow);

    userTable.mount(adminSection);
  }

  // Listen for state changes
  store.addEventListener('state-changed', onStateChanged);
  store.addEventListener('logout', onLogout);
}

function onStateChanged(e) {
  const { action } = e.detail;

  if (action === 'SET_VIEW') {
    updateViewVisibility();
  }

  if (action === 'SET_PERIOD') {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadData(), 300);
  }

  if (action === 'SET_PERSONAL_DATA') {
    const data = store.state.personalData;
    if (data) {
      summaryCards.update(data.summary);
      dailyChart.update(data.daily);
      modelChart.update(data.models);
    }
  }

  if (action === 'SET_ADMIN_DATA') {
    const data = store.state.adminData;
    if (data) {
      updateAdminCards(data.summary);
      roleChart.update(data.summary.by_role);
      userTable.update(data.users);
      trendChart.update(data.trend);
    }
  }

  if (action === 'SET_ERROR') {
    const err = store.state.error;
    if (err) showError(err);
  }
}

function updateViewVisibility() {
  const { view } = store.state;
  if (personalSection) personalSection.style.display = view === 'personal' ? '' : 'none';
  if (adminSection) adminSection.style.display = view === 'admin' ? '' : 'none';
}

function updateAdminCards(summary) {
  const container = document.getElementById('admin-cards');
  if (!container || !summary) return;

  const { total } = summary;
  const cards = [
    { label: 'Total Input', value: total.input_tokens },
    { label: 'Total Output', value: total.output_tokens },
    { label: 'Cache Creation', value: total.cache_creation_input_tokens },
    { label: 'Cache Read', value: total.cache_read_input_tokens },
    { label: 'Active Users', value: total.active_users },
    { label: 'Total Requests', value: total.request_count },
  ];

  container.innerHTML = cards.map(c => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value">${formatNum(c.value)}</div>
    </div>
  `).join('');
}

function formatNum(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

async function loadData() {
  const { period, user } = store.state;
  store.dispatch('SET_LOADING', true);
  store.dispatch('SET_ERROR', null);

  try {
    // Always load personal data
    const [summary, daily, models] = await Promise.all([
      get('/api/dashboard/me/summary', period),
      get('/api/dashboard/me/daily', period),
      get('/api/dashboard/me/models', period),
    ]);

    store.dispatch('SET_PERSONAL_DATA', {
      summary: summary?.summary,
      daily: daily?.days,
      models: models?.models,
    });

    // Load admin data if admin
    if (user?.role === 'tech-lead') {
      const [adminSummary, adminUsers, adminTrend] = await Promise.all([
        get('/api/dashboard/admin/summary', period),
        get('/api/dashboard/admin/users', { ...period, limit: 50 }),
        get('/api/dashboard/admin/trend', period),
      ]);

      store.dispatch('SET_ADMIN_DATA', {
        summary: adminSummary,
        users: adminUsers?.users,
        trend: adminTrend?.days,
      });
    }
  } catch (err) {
    console.error('Load data error:', err);
    store.dispatch('SET_ERROR', err.message);
  } finally {
    store.dispatch('SET_LOADING', false);
  }
}

async function onExport() {
  const { period } = store.state;
  try {
    await downloadCsv('/api/dashboard/admin/export', period);
  } catch (err) {
    console.error('Export error:', err);
    store.dispatch('SET_ERROR', `Export failed: ${err.message}`);
  }
}

async function onLogout() {
  if (auth0Client) {
    await auth0Client.logout({
      logoutParams: { returnTo: window.location.origin + '/dashboard' },
    });
  }
}

function showError(message) {
  const app = document.getElementById('app');
  const loading = app.querySelector('.loading-screen');
  if (loading) loading.remove();

  const existing = app.querySelector('.empty-state[data-type="error"]');
  if (existing) existing.remove();

  emptyState.mount(app, { type: 'error', message });
}

// Remove the await_format call — inline the formatNum function above
// Start the app
init();
