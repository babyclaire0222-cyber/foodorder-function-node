const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { ConfidentialClientApplication } = require('@azure/msal-node');

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;

const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 12 * 60 * 60 * 1000, // 12h
  rateLimit: true
});

function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

// Verifies signature, issuer, audience and expiry against Entra ID. This
// replaces the original code's `jwt.decode()`, which read the claims but
// never checked whether the token was genuine — anyone could forge one.
async function verifyAccessToken(token) {
  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader) {
    throw new Error('Malformed token');
  }

  const publicKey = await getSigningKey(decodedHeader.header);

  // An access token's `aud` claim is the App ID URI itself (e.g.
  // "api://<guid>"), NOT the full scope string ("api://<guid>/access_as_user")
  // — the scope name only shows up in the `scp` claim. AZURE_API_SCOPE holds
  // the full scope string, so derive the App ID URI by stripping the last
  // path segment.
  const appIdUri = process.env.AZURE_API_SCOPE
    ? process.env.AZURE_API_SCOPE.replace(/\/[^/]+$/, '')
    : null;

  const expectedAudience = appIdUri ? [appIdUri, clientId] : clientId;

  const claims = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: [
      `https://login.microsoftonline.com/${tenantId}/v2.0`,
      `https://sts.windows.net/${tenantId}/`
    ],
    audience: expectedAudience
  });

  return {
    userId: claims.oid || claims.sub,
    email: claims.preferred_username || claims.email || claims.upn,
    name: claims.name,
    // App roles assigned to the signed-in user/group in Entra ID show up
    // here (see "App roles" + "Enterprise application > Users and groups").
    // Absent entirely for a user with no roles assigned.
    roles: Array.isArray(claims.roles) ? claims.roles : []
  };
}

// Pulls the bearer token out of an Azure Functions v4 HttpRequest and
// verifies it. Throws on any failure — callers should catch and return 401.
async function requireUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing bearer token');
    err.status = 401;
    throw err;
  }
  const token = authHeader.substring(7);
  try {
    return await verifyAccessToken(token);
  } catch (e) {
    // Log the real reason server-side (audience mismatch, expired, bad
    // signature, etc.) — the client only ever sees the generic message below.
    console.error('Token verification failed:', e.message);
    const err = new Error('Invalid or expired token');
    err.status = 401;
    throw err;
  }
}

const STALL_STAFF_ROLE = 'StallStaff';

function isStallStaff(user) {
  return Array.isArray(user?.roles) && user.roles.includes(STALL_STAFF_ROLE);
}

// Like requireUser, but also rejects anyone without the StallStaff app role.
// Use for every menu-editing / order-status-updating endpoint.
async function requireStallStaff(request) {
  const user = await requireUser(request);
  if (!isStallStaff(user)) {
    const err = new Error('Stall staff access required');
    err.status = 403;
    throw err;
  }
  return user;
}

const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET
  }
};
const cca = new ConfidentialClientApplication(msalConfig);

async function acquireTokenByCode(code, codeVerifier) {
  return cca.acquireTokenByCode({
    code,
    codeVerifier,
    scopes: [process.env.AZURE_API_SCOPE || 'openid profile email'],
    redirectUri: process.env.REDIRECT_URI
  });
}

module.exports = { requireUser, requireStallStaff, isStallStaff, verifyAccessToken, acquireTokenByCode, STALL_STAFF_ROLE };
