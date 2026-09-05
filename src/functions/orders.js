const { app } = require('@azure/functions');
const crypto = require('crypto');
const { json, preflight } = require('../lib/http');
const { requireUser, isStallStaff } = require('../lib/auth');
const { getMenuItem, getMenu } = require('../lib/menu');
const { createOrder, getOrder, updateOrder } = require('../lib/cosmosClient');
const { notifyOrderPlaced } = require('../lib/notify');

function generateOrderId() {
  return 'ORD-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

app.http('placeOrder', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous', // auth is enforced in code via the bearer token, not the Functions key
  route: 'orders',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') return preflight();

    let user;
    try {
      user = await requireUser(request);
    } catch (err) {
      return json(err.status || 401, { error: err.message });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Request body must be valid JSON' });
    }

    const { itemId, quantity } = body || {};
    const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;

    const menuItem = await getMenuItem(itemId);
    if (!menuItem) {
      const menu = await getMenu();
      return json(400, { error: `Unknown itemId. Valid items: ${menu.map(m => m.itemId).join(', ')}` });
    }

    const orderId = generateOrderId();
    const now = new Date().toISOString();

    const order = {
      id: orderId,
      itemId,
      foodItem: menuItem.name,
      price: menuItem.price, // always server-computed, never trusts the client
      quantity: qty,
      total: Math.round(menuItem.price * qty * 100) / 100,
      customerEmail: user.email,
      customerName: user.name || 'Customer',
      customerId: user.userId,
      status: 'pending', // pending -> preparing -> ready -> completed, or cancelled
      timestamp: now
    };

    try {
      await createOrder(order);
    } catch (err) {
      context.error('Failed to write order to Cosmos DB:', err.message);
      return json(500, { error: 'Failed to place order' });
    }

    // Awaited (not fire-and-forget): the Functions host can freeze the process
    // right after the response is sent, which would kill an un-awaited
    // background promise. notifyOrderPlaced() already swallows its own
    // errors, so this never fails the order itself.
    await notifyOrderPlaced(order, context);

    return json(201, {
      success: true,
      orderId,
      status: 'pending',
      total: order.total
    });
  }
});

app.http('getOrderStatus', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'orders/{orderId}',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') return preflight();

    let user;
    try {
      user = await requireUser(request);
    } catch (err) {
      return json(err.status || 401, { error: err.message });
    }

    const orderId = request.params.orderId;
    const order = await getOrder(orderId);

    if (!order) {
      return json(404, { error: 'Order not found (it may have expired after 24 hours)' });
    }
    // Customers can only look up their own orders; stall staff can look up any.
    if (order.customerId !== user.userId && !isStallStaff(user)) {
      return json(403, { error: 'Not your order' });
    }

    return json(200, {
      orderId: order.id,
      status: order.status,
      foodItem: order.foodItem,
      total: order.total,
      timestamp: order.timestamp
    });
  }
});

// Lets the customer acknowledge their order once the stall has marked it
// "ready" — closes the loop without giving the customer any way to set their
// own order to an arbitrary status.
app.http('acknowledgeOrder', {
  methods: ['PATCH', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'orders/{orderId}/acknowledge',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') return preflight();

    let user;
    try {
      user = await requireUser(request);
    } catch (err) {
      return json(err.status || 401, { error: err.message });
    }

    const orderId = request.params.orderId;
    const order = await getOrder(orderId);
    if (!order) {
      return json(404, { error: 'Order not found' });
    }
    if (order.customerId !== user.userId) {
      return json(403, { error: 'Not your order' });
    }
    if (order.status !== 'ready') {
      return json(409, { error: `Order must be "ready" before it can be acknowledged (currently "${order.status}")` });
    }

    try {
      const updated = await updateOrder(orderId, {
        status: 'completed',
        acknowledgedAt: new Date().toISOString()
      });
      return json(200, { success: true, orderId: updated.id, status: updated.status });
    } catch (err) {
      context.error('Failed to acknowledge order:', err.message);
      return json(500, { error: 'Failed to acknowledge order' });
    }
  }
});

app.http('getMenu', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'menu',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') return preflight();
    try {
      const items = await getMenu();
      return json(200, { items });
    } catch (err) {
      context.error('Failed to load menu:', err.message);
      return json(500, { error: 'Failed to load menu' });
    }
  }
});
