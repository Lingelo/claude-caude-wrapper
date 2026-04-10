import { formatDate, formatNumber } from '../utils/format.js';

let el = null;
let chartInstance = null;

export function mount(container) {
  el = document.createElement('div');
  el.className = 'chart-container';
  el.innerHTML = `
    <h3>Usage Trend</h3>
    <div class="chart-wrapper"><canvas id="trend-chart"></canvas></div>
  `;
  container.appendChild(el);
}

export function update(data) {
  if (!el || !data) return;

  if (chartInstance) chartInstance.destroy();

  if (data.length === 0) {
    el.querySelector('.chart-wrapper').innerHTML = `
      <div class="empty-state"><p class="empty-state-message">No trend data</p></div>
    `;
    return;
  }

  el.querySelector('.chart-wrapper').innerHTML = '<canvas id="trend-chart"></canvas>';
  const ctx = el.querySelector('#trend-chart').getContext('2d');
  const style = getComputedStyle(document.documentElement);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => formatDate(d.date)),
      datasets: [
        {
          label: 'Input Tokens',
          data: data.map(d => d.input_tokens),
          borderColor: style.getPropertyValue('--chart-input').trim(),
          backgroundColor: style.getPropertyValue('--chart-input').trim() + '20',
          fill: true,
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          label: 'Output Tokens',
          data: data.map(d => d.output_tokens),
          borderColor: style.getPropertyValue('--chart-output').trim(),
          backgroundColor: style.getPropertyValue('--chart-output').trim() + '20',
          fill: true,
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          label: 'Active Users',
          data: data.map(d => d.active_users),
          borderColor: style.getPropertyValue('--chart-cache-read').trim(),
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.dataset.yAxisID === 'y1') return `${ctx.dataset.label}: ${ctx.raw}`;
              return `${ctx.dataset.label}: ${formatNumber(ctx.raw)}`;
            },
          },
        },
        legend: { position: 'top', labels: { color: style.getPropertyValue('--chart-text').trim() } },
      },
      scales: {
        x: { ticks: { color: style.getPropertyValue('--chart-text').trim() }, grid: { color: style.getPropertyValue('--chart-grid').trim() } },
        y: {
          position: 'left',
          ticks: { color: style.getPropertyValue('--chart-text').trim(), callback: v => formatNumber(v) },
          grid: { color: style.getPropertyValue('--chart-grid').trim() },
        },
        y1: {
          position: 'right',
          ticks: { color: style.getPropertyValue('--chart-text').trim() },
          grid: { drawOnChartArea: false },
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
