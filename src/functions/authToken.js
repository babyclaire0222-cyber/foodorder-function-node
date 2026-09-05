const { app } = require('@azure/functions');
const { json, preflight } = require('../lib/http');
const { acquireTokenByCode } = require('../lib/auth');

app.http('authToken', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/token',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') return preflight();

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Request body must be valid JSON' });
    }

    const { code, codeVerifier } = body || {};
    if (!code) {
      return json(400, { error: 'Authorization code is required' });
    }

    try {
      const tokenResponse = await acquireTokenByCode(code, codeVerifier);
      if (!tokenResponse || !tokenResponse.accessToken) {
        throw new Error('No access token returned');
      }

      return json(200, {
        success: true,
        token: tokenResponse.accessToken,
        expiresOn: tokenResponse.expiresOn,
        user: {
          name: tokenResponse.account.name,
          email: tokenResponse.account.username,
          userId: tokenResponse.account.localAccountId
        }
      });
    } catch (err) {
      context.error('Token exchange failed:', err.message);
      return json(401, { success: false, error: 'Authentication failed' });
    }
  }
});
