let auth0Client = null;

export function setAuth0Client(client) {
  auth0Client = client;
}

export async function get(path, params = {}) {
  if (!auth0Client) throw new Error('Auth client not initialized');

  let token;
  try {
    token = await auth0Client.getTokenSilently();
  } catch {
    await auth0Client.loginWithRedirect({
      appState: { returnTo: window.location.pathname },
    });
    return;
  }

  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (res.status === 401) {
    await auth0Client.loginWithRedirect({
      appState: { returnTo: window.location.pathname },
    });
    return;
  }

  if (res.status === 403) {
    throw new Error('Admin access required');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return res.blob();
  }

  return res.json();
}

export async function downloadCsv(path, params = {}) {
  const blob = await get(path, params);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usage-export-${params.from || 'start'}-to-${params.to || 'end'}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
