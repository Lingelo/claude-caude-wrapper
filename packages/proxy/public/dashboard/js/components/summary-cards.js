import { formatNumber } from '../utils/format.js';

let el = null;

export function mount(container) {
  el = document.createElement('div');
  el.className = 'cards-grid';
  renderSkeleton();
  container.appendChild(el);
}

function renderSkeleton() {
  el.innerHTML = Array(5).fill(`
    <div class="card">
      <div class="card-label skeleton skeleton-text"></div>
      <div class="card-value skeleton skeleton-value"></div>
    </div>
  `).join('');
}

export function update(data) {
  if (!el || !data) return;

  const cards = [
    { label: 'Input Tokens', value: data.input_tokens, color: 'var(--chart-input)' },
    { label: 'Output Tokens', value: data.output_tokens, color: 'var(--chart-output)' },
    { label: 'Cache Creation', value: data.cache_creation_input_tokens, color: 'var(--chart-cache-create)' },
    { label: 'Cache Read', value: data.cache_read_input_tokens, color: 'var(--chart-cache-read)' },
    { label: 'Requests', value: data.request_count, color: 'var(--color-primary)' },
  ];

  el.innerHTML = cards.map(c => `
    <div class="card">
      <div class="card-label">${c.label}</div>
      <div class="card-value" style="color:${c.color}">${formatNumber(c.value)}</div>
    </div>
  `).join('');
}

export function destroy() {
  el?.remove();
  el = null;
}
