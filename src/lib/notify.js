// The original app let the browser POST /api/notify with any orderId/email
// it liked, so any authenticated user could trigger notification spam for
// orders they didn't place. Here notification is only ever fired by the
// server, right after it writes an order it created itself, and failures
// never fail the order (notification is best-effort).
async function notifyOrderPlaced(order, context) {
  const logicAppUrl = process.env.LOGIC_APP_NOTIFICATION_URL;
  if (!logicAppUrl) {
    context.warn('LOGIC_APP_NOTIFICATION_URL not configured; skipping notification');
    return;
  }

  try {
    const response = await fetch(logicAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        customerEmail: order.customerEmail,
        notificationType: 'order_placed',
        timestamp: new Date().toISOString()
      })
    });
    if (!response.ok) {
      context.warn(`Notification call failed with status ${response.status}`);
    }
  } catch (err) {
    context.warn('Notification call threw:', err.message);
  }
}

module.exports = { notifyOrderPlaced };
