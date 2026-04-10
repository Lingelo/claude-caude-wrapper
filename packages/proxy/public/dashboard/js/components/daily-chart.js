import { formatDate, formatNumber } from '../utils/format.js';

let el = null;
let chartInstance = null;

export function mount(container) {
  el = document.createElement('div');
  el.className = 'chart-container';
  el.innerHTML = `
    <h3>Daily Token Usage</h3>
    <div class="chart-wrapper"><canvas id="daily-chart"></canvas></div>
  `;
  container.appendChild(el);
}

export function update(data) {
  if (!el || !data) return;

  const canvas = el.querySelector('#daily-chart');
  if (!canvas) return;

  if (chartInstance) chartInstance.destroy();

  if (data.length === 0) {
    el.querySelector('.chart-wrapper').innerHTML = `
      <div class="empty-state"><p class="empty-state-message">No data for selected period</p></div>
    `;
    return;
  }

  el.querySelector('.chart-wrapper').innerHTML = '<canvas id="daily-chart"></canvas>';
  const ctx = el.querySelector('#daily-chart').getContext('2d');
  const style = getComputedStyle(document.documentElement);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => formatDate(d.date)),
      datasets: [
        {
          label: 'Input',
          data: data.map(d => d.input_tokens),
          borderColor: style.getPropertyValue('--chart-input').trim(),
          backgroundColor: style.getPropertyValue('--chart-input').trim() + '20',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Output',
          data: data.map(d => d.output_tokens),
          borderColor: style.getPropertyValue('--chart-output').trim(),
          backgroundColor: style.getPropertyValue('--chart-output').trim() + '20',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        tooltip: {
          callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNumber(ctx.raw)}` },
        },
        legend: { position: 'top', labels: { color: style.getPropertyValue('--chart-text').trim() } },
      },
      scales: {
        x: { ticks: { color: style.getPropertyValue('--chart-text').trim() }, grid: { color: style.getPropertyValue('--chart-grid').trim() } },
        y: {
          ticks: { color: style.getPropertyValue('--chart-text').trim(), callback: v => formatNumber(v) },
          grid: { color: style.getPropertyValue('--chart-grid').trim() },
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
