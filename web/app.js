// ---- Config ----
const CONFIG = {
  clientId: window.APP_CONFIG?.clientId || 'REPLACE_WITH_CLIENT_ID',
  tenantId: window.APP_CONFIG?.tenantId || 'REPLACE_WITH_TENANT_ID',
  apiScope: window.APP_CONFIG?.apiScope || 'REPLACE_WITH_api://<client-id>/access_as_user',
  apiBaseUrl: window.APP_CONFIG?.apiBaseUrl || '/api',
  redirectUri: window.location.origin + window.location.pathname
};

let authToken = sessionStorage.getItem('authToken');
let currentUser = JSON.parse(sessionStorage.getItem('user') || 'null');
let currentOrderId = sessionStorage.getItem('currentOrderId') || null;
let isStaff = sessionStorage.getItem('isStaff') === 'true';

// ---- PKCE helpers ----
function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256(plain) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
}
function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr.buffer);
}

// Decodes a JWT's payload WITHOUT verifying it — fine here because this is
// only used to decide which UI to show (a "Stall Dashboard" tab). The server
// verifies the signature/roles independently on every request, so a forged
// token would just get 403'd by the API; it can't grant real access.
function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return {};
  }
}

// ---- Auth ----
async function login() {
  const codeVerifier = randomString();
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  const state = randomString(16);

  sessionStorage.setItem('pkce_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  const authUrl = `https://login.microsoftonline.com/${CONFIG.tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${encodeURIComponent(CONFIG.clientId)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(CONFIG.redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(`openid profile email ${CONFIG.apiScope}`)}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  window.location.href = authUrl;
}

function logout() {
  authToken = null;
  currentUser = null;
  isStaff = false;
  sessionStorage.clear();
  showLoginSection();
}

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const expectedState = sessionStorage.getItem('oauth_state');
  const codeVerifier = sessionStorage.getItem('pkce_verifier');

  window.history.replaceState({}, document.title, window.location.pathname);

  if (!code || returnedState !== expectedState) {
    alert('Login failed: invalid response from Microsoft. Please try again.');
    return;
  }

  try {
    const res = await fetch(`${CONFIG.apiBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, codeVerifier })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Token exchange failed');

    authToken = data.token;
    currentUser = data.user;
    isStaff = (decodeJwtPayload(authToken).roles || []).includes('StallStaff');

    sessionStorage.setItem('authToken', authToken);
    sessionStorage.setItem('user', JSON.stringify(currentUser));
    sessionStorage.setItem('isStaff', String(isStaff));

    showAppSection();
  } catch (err) {
    console.error(err);
    alert('Login failed. Please try again.');
  }
}

// ---- UI shell ----
function showLoginSection() {
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('app-section').style.display = 'none';
}

function showAppSection() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('app-section').style.display = 'block';
  document.getElementById('user-email').textContent = currentUser?.email || '';
  const h1 = document.querySelector('#app-section h1');
  if (currentUser?.name) h1.textContent = `Welcome to Food Express, ${currentUser.name}!`;

  document.getElementById('customer-view').style.display = isStaff ? 'none' : 'block';
  document.getElementById('stall-view').style.display = isStaff ? 'block' : 'none';

  if (isStaff) {
    loadStallMenu();
    loadStallOrders();
  } else {
    loadMenu();
    if (currentOrderId) refreshMyOrderStatus();
  }
}

function authedFetch(path, options = {}) {
  return fetch(`${CONFIG.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`
    }
  });
}

// ================= Customer view =================

async function loadMenu() {
  const res = await fetch(`${CONFIG.apiBaseUrl}/menu`);
  const { items } = await res.json();
  const grid = document.getElementById('food-grid');
  grid.innerHTML = items.map(item => `
    <div class="food-card">
      <div class="food-image"></div>
      <div class="food-info">
        <div class="food-name">${item.name}</div>
        <div class="food-price">$${item.price.toFixed(2)}</div>
        <button class="order-btn" onclick="placeOrder('${item.itemId}')">Order Now</button>
      </div>
    </div>
  `).join('');
}

async function placeOrder(itemId) {
  const statusEl = document.getElementById('status-display');
  statusEl.innerHTML = 'Placing order...';
  try {
    const res = await authedFetch('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, quantity: 1 })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Order failed');

    currentOrderId = data.orderId;
    sessionStorage.setItem('currentOrderId', currentOrderId);
    renderOrderStatus(data.orderId, data.status, data.total);
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Order failed: ${err.message}`;
  }
}

function renderOrderStatus(orderId, status, total) {
  const statusEl = document.getElementById('status-display');
  const totalText = typeof total === 'number' ? ` — total $${total.toFixed(2)}` : '';
  let html = `Order ${orderId}: ${status}${totalText}`;
  if (status === 'ready') {
    html += ` <button class="btn" onclick="acknowledgeOrder('${orderId}')">Acknowledge Receipt</button>`;
  }
  statusEl.innerHTML = html;
}

async function refreshMyOrderStatus() {
  if (!currentOrderId) {
    document.getElementById('status-display').textContent = 'No active orders.';
    return;
  }
  try {
    const res = await authedFetch(`/orders/${currentOrderId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to check order status');
    renderOrderStatus(data.orderId, data.status, data.total);
  } catch (err) {
    document.getElementById('status-display').textContent = `Failed to check order status: ${err.message}`;
  }
}

async function acknowledgeOrder(orderId) {
  try {
    const res = await authedFetch(`/orders/${orderId}/acknowledge`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to acknowledge order');
    renderOrderStatus(data.orderId, data.status);
  } catch (err) {
    document.getElementById('status-display').textContent = `Acknowledge failed: ${err.message}`;
  }
}

// ================= Stall staff view =================

async function loadStallMenu() {
  const res = await fetch(`${CONFIG.apiBaseUrl}/menu`);
  const { items } = await res.json();
  const list = document.getElementById('stall-menu-list');
  list.innerHTML = items.map(item => `
    <div class="stall-menu-row" data-item-id="${item.itemId}">
      <input type="text" value="${item.name}" class="menu-name-input" />
      <input type="number" step="0.01" min="0.01" value="${item.price}" class="menu-price-input" />
      <button class="btn" onclick="saveStallMenuItem('${item.itemId}')">Save</button>
      <button class="btn btn-secondary" onclick="deleteStallMenuItem('${item.itemId}')">Delete</button>
    </div>
  `).join('');
}

async function saveStallMenuItem(itemId) {
  const row = document.querySelector(`.stall-menu-row[data-item-id="${itemId}"]`);
  const name = row.querySelector('.menu-name-input').value;
  const price = row.querySelector('.menu-price-input').value;
  try {
    const res = await authedFetch('/stall/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, name, price })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save item');
    await loadStallMenu();
    await loadMenu(); // keep the (hidden) customer grid in sync too
  } catch (err) {
    alert(`Failed to save: ${err.message}`);
  }
}

async function deleteStallMenuItem(itemId) {
  if (!confirm('Delete this menu item?')) return;
  try {
    const res = await authedFetch(`/stall/menu/${itemId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete item');
    await loadStallMenu();
  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  }
}

async function addStallMenuItem() {
  const name = document.getElementById('new-item-name').value;
  const price = document.getElementById('new-item-price').value;
  if (!name || !price) return;
  try {
    const res = await authedFetch('/stall/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add item');
    document.getElementById('new-item-name').value = '';
    document.getElementById('new-item-price').value = '';
    await loadStallMenu();
  } catch (err) {
    alert(`Failed to add item: ${err.message}`);
  }
}

const NEXT_STATUS_OPTIONS = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['cancelled'],
  completed: [],
  cancelled: []
};

async function loadStallOrders() {
  const statusFilter = document.getElementById('stall-status-filter')?.value || '';
  try {
    const res = await authedFetch(`/stall/orders${statusFilter ? `?status=${statusFilter}` : ''}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load orders');

    const list = document.getElementById('stall-orders-list');
    if (!data.orders.length) {
      list.innerHTML = '<p>No orders to show.</p>';
      return;
    }
    list.innerHTML = data.orders.map(order => {
      const nextOptions = NEXT_STATUS_OPTIONS[order.status] || [];
      const controls = nextOptions.length
        ? nextOptions.map(s => `<button class="btn" onclick="setOrderStatus('${order.id}', '${s}')">${s}</button>`).join(' ')
        : '<em>final</em>';
      return `
        <div class="stall-order-row">
          <strong>${order.id}</strong> — ${order.foodItem} x${order.quantity} — $${order.total.toFixed(2)}
          <br>${order.customerName} (${order.customerEmail})
          <br>Status: <strong>${order.status}</strong> ${controls}
        </div>
      `;
    }).join('');
  } catch (err) {
    document.getElementById('stall-orders-list').textContent = `Failed to load orders: ${err.message}`;
  }
}

async function setOrderStatus(orderId, status) {
  try {
    const res = await authedFetch(`/stall/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status');
    await loadStallOrders();
  } catch (err) {
    alert(`Failed to update status: ${err.message}`);
  }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.search.includes('code=')) {
    handleAuthCallback();
    return;
  }
  if (authToken && currentUser) {
    showAppSection();
  } else {
    showLoginSection();
  }
});
