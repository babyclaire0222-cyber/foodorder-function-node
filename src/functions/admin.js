const { app } = require('@azure/functions');
const crypto = require('crypto');
const { json, preflight } = require('../lib/http');
const { getOrdersContainer } = require('../lib/cosmosClient');

// Original bug: `adminKey !== process.env.ADMIN_API_KEY` fails OPEN when
// ADMIN_API_KEY is unset (undefined !== undefined is false, so the check
// silently passes). This version requires the key to be configured and
// compares it in constant time to avoid a timing side-channel.
function isAuthorizedAdmin(request) {
  const expected = process.env.ADMIN_API_KEY;
  const provided = request.headers.get('x-admin-key');
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

app.http('adminStats', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  // NOTE: Azure Functions reserves the `/admin/*` route prefix for the host's
  // own internal admin API, so `admin/stats` collides with it at startup
  // ("route conflicts with built-in routes"). Using `stats/admin` instead.
  route: 'stats/admin',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') return preflight();

    if (!isAuthorizedAdmin(request)) {
      return json(403, { error: 'Unauthorized - admin access required' });
    }

    try {
      const container = await getOrdersContainer();

      const { resources: totalResult } = await container.items
        .query('SELECT VALUE COUNT(1) FROM c')
        .fetchAll();

      const { resources: statusCounts } = await container.items
        .query('SELECT c.status, COUNT(1) as count FROM c GROUP BY c.status')
        .fetchAll();

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { resources: recentResult } = await container.items
        .query({
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.timestamp >= @since',
          parameters: [{ name: '@since', value: twentyFourHoursAgo }]
        })
        .fetchAll();

      return json(200, {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          orders: {
            total: totalResult[0] || 0,
            last24h: recentResult[0] || 0,
            byStatus: statusCounts.reduce((acc, item) => {
              acc[item.status] = item.count;
              return acc;
            }, {})
          }
        }
      });
    } catch (err) {
      context.error('Admin stats query failed:', err.message);
      return json(500, { success: false, error: 'Failed to retrieve admin data' });
    }
  }
});
