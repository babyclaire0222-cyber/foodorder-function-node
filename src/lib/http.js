const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function json(status, body) {
  return {
    status,
    jsonBody: body,
    headers: corsHeaders()
  };
}

function preflight() {
  return { status: 204, headers: corsHeaders() };
}

module.exports = { json, preflight, corsHeaders };
