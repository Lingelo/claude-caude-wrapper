import { store } from '../stores/state.js';

let el = null;

export function mount(container) {
  el = document.createElement('div');
  el.className = 'date-picker';
  render();
  container.appendChild(el);
}

function render() {
  const { period } = store.state;

  el.innerHTML = `
    <input type="date" id="date-from" value="${period.from}" max="${period.to}">
    <span style="color:var(--color-text-muted)">to</span>
    <input type="date" id="date-to" value="${period.to}">
    <div class="date-presets">
      <button class="btn" data-preset="month">This month</button>
      <button class="btn" data-preset="30">Last 30 days</button>
      <button class="btn" data-preset="90">Last 90 days</button>
    </div>
  `;

  el.querySelector('#date-from').addEventListener('change', onDateChange);
  el.querySelector('#date-to').addEventListener('change', onDateChange);

  el.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });
}

function onDateChange() {
  const from = el.querySelector('#date-from').value;
  const to = el.querySelector('#date-to').value;
  if (from && to) {
    store.dispatch('SET_PERIOD', { from, to });
  }
}

function applyPreset(preset) {
  const now = new Date();
  const to = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  let from;

  if (preset === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  } else {
    const days = parseInt(preset, 10);
    from = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  }

  store.dispatch('SET_PERIOD', { from, to });
  render();
}

export function update() { render(); }

export function destroy() {
  el?.remove();
  el = null;
}
