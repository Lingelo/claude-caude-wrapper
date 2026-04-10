import { formatNumber } from '../utils/format.js';

let el = null;
let chartInstance = null;

const MODEL_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#ef4444',
];

export function mount(container) {
  el = document.createElement('div');
  el.className = 'chart-container';
  el.innerHTML = `
    <h3>Usage by Model</h3>
    <div class="chart-wrapper"><canvas id="model-chart"></canvas></div>
  `;
  container.appendChild(el);
}

export function update(data) {
  if (!el || !data) return;

  if (chartInstance) chartInstance.destroy();

  if (data.length === 0) {
    el.querySelector('.chart-wrapper').innerHTML = `
      <div class="empty-state"><p class="empty-state-message">No model data</p></div>
    `;
    return;
  }

  el.querySelector('.chart-wrapper').innerHTML = '<canvas id="model-chart"></canvas>';
  const ctx = el.querySelector('#model-chart').getContext('2d');
  const style = getComputedStyle(document.documentElement);

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(m => m.model),
      datasets: [{
        data: data.map(m => m.input_tokens + m.output_tokens),
        backgroundColor: data.map((_, i) => MODEL_COLORS[i % MODEL_COLORS.length]),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: { label: ctx => `${ctx.label}: ${formatNumber(ctx.raw)} tokens` },
        },
        legend: {
          position: 'right',
          labels: { color: style.getPropertyValue('--chart-text').trim(), padding: 12 },
        },
      },
    },
  });
}

export function destroy() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  el?.remove();
  el = null;
}
