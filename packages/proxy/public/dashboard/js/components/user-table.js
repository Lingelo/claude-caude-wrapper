import { formatNumber } from '../utils/format.js';

let el = null;

export function mount(container) {
  el = document.createElement('div');
  el.className = 'table-container';
  el.innerHTML = '<h3>Top Users by Consumption</h3><div class="table-body"></div>';
  container.appendChild(el);
}

export function update(data) {
  if (!el || !data) return;

  const body = el.querySelector('.table-body');

  if (data.length === 0) {
    body.innerHTML = '<div class="empty-state"><p class="empty-state-message">No user data</p></div>';
    return;
  }

  // Desktop table
  const tableHtml = `
    <table class="data-table">
      <thead>
        <tr>
          <th>#</th>
          <th>User</th>
          <th>Role</th>
          <th>Total Tokens</th>
          <th>Input</th>
          <th>Output</th>
          <th>Cache Create</th>
          <th>Cache Read</th>
          <th>Requests</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((u, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${u.user_email}</td>
            <td><span class="role-badge">${u.user_role}</span></td>
            <td>${formatNumber(u.total_tokens)}</td>
            <td>${formatNumber(u.input_tokens)}</td>
            <td>${formatNumber(u.output_tokens)}</td>
            <td>${formatNumber(u.cache_creation_input_tokens)}</td>
            <td>${formatNumber(u.cache_read_input_tokens)}</td>
            <td>${formatNumber(u.request_count)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Mobile cards
  const mobileHtml = `
    <div class="mobile-cards">
      ${data.map((u, i) => `
        <div class="mobile-card">
          <div class="mobile-card-header">
            <strong>#${i + 1} ${u.user_email}</strong>
            <span class="role-badge">${u.user_role}</span>
          </div>
          <div class="mobile-card-row"><span>Total</span><span>${formatNumber(u.total_tokens)}</span></div>
          <div class="mobile-card-row"><span>Input</span><span>${formatNumber(u.input_tokens)}</span></div>
          <div class="mobile-card-row"><span>Output</span><span>${formatNumber(u.output_tokens)}</span></div>
          <div class="mobile-card-row"><span>Cache Create</span><span>${formatNumber(u.cache_creation_input_tokens)}</span></div>
          <div class="mobile-card-row"><span>Cache Read</span><span>${formatNumber(u.cache_read_input_tokens)}</span></div>
          <div class="mobile-card-row"><span>Requests</span><span>${formatNumber(u.request_count)}</span></div>
        </div>
      `).join('')}
    </div>
  `;

  body.innerHTML = tableHtml + mobileHtml;
}

export function destroy() {
  el?.remove();
  el = null;
}
