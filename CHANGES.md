# What changed from the original `foodorder-function-node` zip

## Added: stall staff role, menu editing, order status workflow

- **Entra ID App Role (`StallStaff`)** distinguishes stall staff from
  customers. Enforced server-side in `src/lib/auth.js` (`requireStallStaff`)
  by checking the `roles` claim on the verified access token — a customer
  can't fake staff access by editing the frontend, since every staff
  endpoint independently re-checks the role from the cryptographically
  verified token, not from anything the client claims.
- **Menu moved from a hardcoded object into Cosmos DB** (`MenuItems`
  container), so staff can add/edit/delete items from the dashboard without
  a code deploy. `src/functions/menuAdmin.js` (staff-only) handles writes;
  `getMenu()` in `src/lib/menu.js` (public) still just reads current prices
  — the "client never sends a price" rule from before is unchanged.
- **Order status lifecycle**: `pending -> preparing -> ready -> completed`,
  or `cancelled` at various points. Staff advance orders forward via
  `src/functions/orderAdmin.js` (`PATCH /stall/orders/{id}/status`), with
  transitions validated server-side (`ALLOWED_TRANSITIONS`) so staff can't,
  say, jump `pending -> completed` directly. Only the customer who placed
  the order can mark it `completed`, via `PATCH /orders/{id}/acknowledge`,
  and only once staff have set it to `ready` — this makes "the customer
  actually received their food" something the customer confirms, not
  something staff (or anyone else) can assert on their behalf.
- `GET /stall/orders` gives staff a dashboard view of all orders (optionally
  filtered by status); `GET /orders/{id}` now also allows staff to look up
  any single order, not just the owner.



## Fixed: wouldn't run at all
- `function.js` had invalid JSON (`;` instead of `:`) — removed. Azure
  Functions v4 doesn't use `function.json` files at all; triggers are
  registered in code via `app.http(...)` (see `src/functions/*.js`).
- `admin-api.json`, `notify-api.json`, `auth-api.json` sat loose in the repo
  root instead of inside per-function folders, so the runtime never loaded
  them. Not applicable anymore under v4 — routes are declared in code.
- `OrderTrigger/index.js` was a debug stub that only echoed the request. The
  real order logic (`src/functions/orders.js`) now validates input, prices
  the order server-side, and writes to Cosmos DB.
- Two incompatible frontends (`app-azure.js` + `index.html` vs. `app-local.js`
  + `server.js`) collapsed into one (`web/app.js` + `web/index.html`) that
  always uses real Entra ID auth.

## Fixed: security
- **JWT was decoded, never verified.** `jwt.decode()` reads claims without
  checking the signature, so anyone could forge a token. `src/lib/auth.js`
  now verifies signature, issuer, audience, and expiry against Entra ID's
  published JWKS.
- **Client-controlled price.** The order endpoint used to trust whatever
  `price` the browser sent. Now the client sends only an `itemId`, and
  `src/lib/menu.js` is the sole source of truth for prices.
- **Admin endpoint failed open.** `adminKey !== process.env.ADMIN_API_KEY`
  passes when both sides are `undefined` (key not configured). Now the
  endpoint requires the key to be set and compares it with
  `crypto.timingSafeEqual`.
- **Notification endpoint was client-triggerable** — any logged-in user could
  POST `/api/notify` with someone else's orderId/email. Notifications are now
  fired server-side, only right after the server itself writes an order.
- **No ownership check on order lookups** — any authenticated user could read
  any order by guessing its ID. `GET /orders/{orderId}` now checks
  `customerId` against the caller.
- `auth.js`'s old `validateToken` was Express-style `(req, res, next)`
  middleware, incompatible with the Azure Functions request signature, and
  wasn't wired into anything. Replaced with `requireUser(request)`, called
  explicitly at the top of each protected handler.

## Fixed: correctness
- **TTL didn't actually work.** The old code wrote an `expiryTime` string
  field, which Cosmos DB ignores. Real TTL requires a numeric `ttl` field on
  the item *and* TTL enabled on the container — both are now set
  (`src/lib/cosmosClient.js`).
- **Order status was always a hardcoded mock** (`"preparing", "15 minutes"`).
  `GET /orders/{orderId}` now reads the real document from Cosmos DB.
- Admin stats query used string interpolation for the timestamp filter;
  switched to a parameterized query.
- `node_modules` was committed but incomplete (missing the actual runtime
  deps). Removed from the deployable project; CI runs `npm ci` instead.

## Notes / things you still need to decide
- The frontend's PKCE flow assumes a **Web** app registration with a client
  secret held by the Function App (confidential client doing the code
  exchange). If you'd rather make this a pure SPA with no backend secret,
  register the app as **SPA** in Entra ID and do the code exchange entirely
  client-side with `@azure/msal-browser` instead of `auth/token`.
- CORS is enforced in code (`src/lib/http.js`) via `ALLOWED_ORIGIN`, not in
  Azure portal CORS settings — set it to your real frontend origin before
  going to production; it defaults to `*`.
