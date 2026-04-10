import { formatNumber } from '../utils/format.js';

let el = null;
let chartInstance = null;

const ROLE_COLORS = {
  developer: '#6366f1',
  'tech-lead': '#10b981',
  po: '#f59e0b',
  default: '#9ca0b0',
};

export function mount(container) {
  el = document.createElement('div');
  el.className = 'chart-container';
  el.innerHTML = `
    <h3>Usage by Role</h3>
    <div class="chart-wrapper"><canvas id="role-chart"></canvas></div>
  `;
  container.appendChild(el);
}

export function update(data) {
  if (!el || !data) return;

  if (chartInstance) chartInstance.destroy();

  if (data.length === 0) {
    el.querySelector('.chart-wrapper').innerHTML = `
      <div class="empty-state"><p class="empty-state-message">No role data</p></div>
    `;
    return;
  }

  el.querySelector('.chart-wrapper').innerHTML = '<canvas id="role-chart"></canvas>';
  const ctx = el.querySelector('#role-chart').getContext('2d');
  const style = getComputedStyle(document.documentElement);

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(r => r.role),
      datasets: [
        {
          label: 'Input Tokens',
          data: data.map(r => r.input_tokens),
          backgroundColor: style.getPropertyValue('--chart-input').trim(),
        },
        {
          label: 'Output Tokens',
          data: data.map(r => r.output_tokens),
          backgroundColor: style.getPropertyValue('--chart-output').trim(),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        tooltip: {
          callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNumber(ctx.raw)}` },
        },
        legend: { position: 'top', labels: { color: style.getPropertyValue('--chart-text').trim() } },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: style.getPropertyValue('--chart-text').trim(), callback: v => formatNumber(v) },
          grid: { color: style.getPropertyValue('--chart-grid').trim() },
        },
        y: {
          stacked: true,
          ticks: { color: style.getPropertyValue('--chart-text').trim() },
          grid: { display: false },
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
