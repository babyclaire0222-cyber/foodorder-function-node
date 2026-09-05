# Food Express — Azure Functions v4 + Cosmos DB + Entra ID

Rebuilt from scratch on the Azure Functions v4 programming model. What changed
from the original app, and why, is in `CHANGES.md`.

## Architecture

```
web/            static frontend (host on Azure Static Web Apps, App Service, or Blob Storage static site)
src/functions/  HTTP-triggered API (Azure Functions v4)
src/lib/        shared auth / Cosmos / menu / notification logic
```

API surface (all under `/api`):

| Method | Route                        | Auth                    | Purpose                              |
|--------|------------------------------|-------------------------|----------------------------------------|
| GET    | `/menu`                      | none                    | list sellable items + prices          |
| POST   | `/orders`                    | Bearer token            | place an order                        |
| GET    | `/orders/{orderId}`          | Bearer token (owner or staff) | check an order's status         |
| PATCH  | `/orders/{orderId}/acknowledge` | Bearer token (owner) | customer confirms receipt once "ready" |
| POST   | `/auth/token`                | none (uses PKCE)        | exchange Entra ID auth code           |
| GET    | `/stats/admin`               | `x-admin-key`           | order counts / system stats           |
| GET    | `/stall/orders`              | Bearer token + `StallStaff` role | list all orders (staff dashboard) |
| PATCH  | `/stall/orders/{orderId}/status` | Bearer token + `StallStaff` role | advance an order's status |
| POST   | `/stall/menu`                | Bearer token + `StallStaff` role | create or update a menu item |
| DELETE | `/stall/menu/{itemId}`       | Bearer token + `StallStaff` role | remove a menu item |

Notifications (Logic App) are fired **by the server** right after an order is
written — there's no longer a client-callable `/api/notify` a user could
spoof.

### Order lifecycle

```
pending -> preparing -> ready -> completed   (customer acknowledges "ready")
        \-> cancelled                        (staff can cancel from pending/preparing/ready)
```

Staff can move an order forward or cancel it via `/stall/orders/{id}/status`,
but can't jump straight to `completed` — only the customer who placed the
order can do that, via `/orders/{id}/acknowledge`, and only once it's
`ready`. This keeps "the customer got their food" as something only the
customer confirms.

### Menu editing

The menu now lives in Cosmos DB (`MenuItems` container, seeded with the
original three items on first run) instead of being hardcoded, so stall
staff can add/edit/remove items from the dashboard without a redeploy.
`GET /menu` (what customers see) always reflects the current contents.

## 1. Provision Azure resources

You said nothing is set up yet, so here's the full path. All of this can be
done in the Azure Portal or via `az cli` — commands shown for `az cli`.

### 1a. Resource group
```bash
az group create --name foodorder-rg --location eastus
```

### 1b. Cosmos DB (with TTL)
```bash
az cosmosdb create --name foodorder-cosmos --resource-group foodorder-rg --locations regionName=eastus
az cosmosdb sql database create --account-name foodorder-cosmos --resource-group foodorder-rg --name FoodOrderDB
az cosmosdb sql container create \
  --account-name foodorder-cosmos --resource-group foodorder-rg \
  --database-name FoodOrderDB --name Orders \
  --partition-key-path /id --ttl -1
```
`--ttl -1` turns TTL **on** at the container level; each order document then
carries its own `ttl: 86400` (24h) field, which the code already sets
(`src/lib/cosmosClient.js`). Grab the connection string:
```bash
az cosmosdb keys list --name foodorder-cosmos --resource-group foodorder-rg --type connection-strings
```

### 1c. Function App
```bash
az storage account create --name foodorderstorage --resource-group foodorder-rg --sku Standard_LRS
az functionapp create \
  --name foodorder-function-app --resource-group foodorder-rg \
  --storage-account foodorderstorage --consumption-plan-location eastus \
  --runtime node --runtime-version 20 --functions-version 4 --os-type Linux
```

### 1d. Microsoft Entra ID app registration
1. Portal → **Microsoft Entra ID** → **App registrations** → **New registration**.
   - Name: `Food Express`
   - Supported account types: single tenant (or per your needs)
   - Redirect URI: **Web** → `https://<your-frontend-domain>/` (and add
     `http://localhost:3000/` for local dev)
2. **Certificates & secrets** → new client secret → copy the value immediately.
3. **Expose an API**:
   - Set the Application ID URI (default `api://<client-id>` is fine).
   - Add a scope named `access_as_user`, admin+user consent, enabled.
   - This is the `AZURE_API_SCOPE` value: `api://<client-id>/access_as_user`.
4. **API permissions** → add the scope you just created, plus
   `openid`, `profile`, `email` (Microsoft Graph, delegated) — grant admin
   consent.
5. Note the **Application (client) ID**, **Directory (tenant) ID**, and the
   client secret — these become `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
   `AZURE_CLIENT_SECRET`.

### 1d-2. Add the StallStaff app role and assign it to a staff account

This is what distinguishes stall staff from ordinary customers — enforced
server-side, not just hidden in the UI.

1. In your **Food Express** app registration, left sidebar → **App roles**
   → **Create app role**:
   - Display name: `Stall Staff`
   - Allowed member types: **Users/Groups**
   - Value: `StallStaff` (must match exactly — the backend checks for this
     literal string)
   - Description: `Can edit the menu and update order status`
   - State: **Enabled**
   - Click **Apply**
2. Go to **Enterprise applications** (a different top-level item in Entra
   ID than "App registrations") → find **Food Express** → **Users and
   groups** → **+ Add user/group**.
3. Select the Microsoft account that should have staff access (this can be
   the same account you use as a customer for testing, or a second test
   account — either works; the role is just a claim added to that user's
   tokens).
4. Under "Select a role", choose **Stall Staff** → **Assign**.

The next time that account logs in and gets a fresh access token, it'll
carry a `"roles": ["StallStaff"]` claim, and the frontend will show the
Stall Dashboard instead of the ordering screen. Log out and back in if
you'd assigned the role to an account that was already signed in — roles
are baked into the token at sign-in time, not re-checked live.

### 1e. Logic App for notifications (optional but referenced in code)
Create a Consumption Logic App with an **HTTP request** trigger and whatever
email/SMS action you want after it (Office 365 Outlook "Send an email",
Twilio, etc.). Copy its trigger URL into `LOGIC_APP_NOTIFICATION_URL`. If you
leave this unset, order placement still works — notification is just skipped
with a log line.

### 1f. Configure the Function App settings
```bash
az functionapp config appsettings set --name foodorder-function-app --resource-group foodorder-rg --settings \
  COSMOS_CONNECTION_STRING="<from 1b>" \
  COSMOS_DATABASE_NAME="FoodOrderDB" \
  COSMOS_CONTAINER_NAME="Orders" \
  AZURE_TENANT_ID="<tenant id>" \
  AZURE_CLIENT_ID="<client id>" \
  AZURE_CLIENT_SECRET="<client secret>" \
  AZURE_API_SCOPE="api://<client id>/access_as_user" \
  REDIRECT_URI="https://<your-frontend-domain>/" \
  LOGIC_APP_NOTIFICATION_URL="<logic app url, optional>" \
  ADMIN_API_KEY="<a long random string>" \
  ALLOWED_ORIGIN="https://<your-frontend-domain>"
```

## 2. Local development

```bash
npm install
cp local.settings.json.example local.settings.json   # fill in real values
func start
```

`func start` needs the [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local).
Serve `web/` with any static server (`npx serve web`) and point
`window.APP_CONFIG.apiBaseUrl` in `web/index.html` at `http://localhost:7071/api`.

Test without a browser once you have a token:
```bash
curl http://localhost:7071/api/menu

curl -X POST http://localhost:7071/api/orders \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"itemId":"pizza","quantity":1}'

curl http://localhost:7071/api/stats/admin -H "x-admin-key: <ADMIN_API_KEY>"
```

## 3. Deploy

Fill in the frontend config (`web/index.html`'s `window.APP_CONFIG` block)
with your real client ID, tenant ID, scope, and deployed API base URL, then
host `web/` on Static Web Apps / Blob static website / App Service.

For the API, either:
- `func azure functionapp publish foodorder-function-app`, or
- push to `main` and let `.github/workflows/deploy.yml` do it. That workflow
  needs three repo secrets for OIDC federated login:
  `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (a separate
  app registration used for CI, with federated credentials trusting your
  GitHub repo — see `az ad app federated-credential create`).

## 4. Security notes carried over from the audit

- Prices are always looked up server-side from `src/lib/menu.js` — the
  client only sends an `itemId`.
- Access tokens are cryptographically verified against Entra ID's JWKS
  (`src/lib/auth.js`), not just decoded.
- `/api/stats/admin` requires `ADMIN_API_KEY` to be set — it no longer
  fails open when the setting is missing.
- Order status lookups check `customerId` so one user can't read another's
  order by guessing an order ID.
