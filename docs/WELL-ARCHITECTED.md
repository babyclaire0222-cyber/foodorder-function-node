# Food Express — Well-Architected review

Reviewed against the five pillars of the [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/). Priority: **H** = fix before real users, **M** = before scale-up, **L** = nice to have.

| Pillar | Finding | Risk | Recommendation | Priority |
| --- | --- | --- | --- | --- |
| Security | `web/app.js` builds HTML strings from data (`innerHTML`, inline `onclick`) in `loadMenu`, `loadStallMenu` and `loadStallOrders`; tokens live in `sessionStorage`. Tested in a browser: 4 injection points run attacker script | **Customer → staff:** a customer sets their Microsoft display name to a script; it runs on the staff dashboard and can steal a staff token. **Staff → customers:** a script in a menu name or item ID runs for every customer | Build DOM nodes with `textContent` and `addEventListener` (escaping alone fails inside `onclick`); add a Content-Security-Policy in `staticwebapp.config.json`; validate names server-side | **H** |
| Security | Cosmos accessed with the account key (connection string); client secret and admin key in app settings | Leaked setting = full database access; secrets expire silently | System-assigned **Managed Identity** + Cosmos RBAC (no keys); **Key Vault references** for the client secret and Logic App URL | **H** |
| Security | `ALLOWED_ORIGIN` defaults to `*` | Any site can call the API from a browser | Set it to the SWA domain; fail closed if unset | M |
| Security | Stats protected by a shared `x-admin-key` | No per-person audit; hard to rotate | `Admin` app role (ADR-0004) | M |
| Reliability | Single region; resources created by `az` commands in the README, not by IaC | Region outage or accidental deletion means a slow manual rebuild | Bicep or Terraform for every resource; documented restore (DR.md) | M |
| Reliability | Notification is called inside the order request; failures are dropped | Slow Logic App slows ordering; lost notifications | Queue + queue-triggered Function with retries (ADR-0005) | M |
| Reliability | Linux Consumption plan retires 30 Sep 2028 | Forced, rushed migration later | Plan the move to Flex Consumption | L |
| Reliability | Staff endpoints (`/stall/orders`, `/stall/menu`) are described in README and called by the frontend, but not implemented | Staff dashboard and menu editing return 404 | Implement `orderAdmin.js` and `menuAdmin.js` with tests for the 403 (non-staff) path | **H** |
| Cost | Cosmos capacity mode not chosen deliberately | Paying for idle throughput | Serverless or free tier for pilot (COST.md) | M |
| Cost | No total throughput limit on the Cosmos account | A bug or misconfiguration can provision unlimited RU/s and an unbounded bill | Set a total throughput limit as a safety cap; moot if recreated as serverless | L |
| Cost | No budget or credit alerts; subscription reached a Warned state and the app was disabled without notice | Outage caused by billing, not by a technical fault | Azure budget with 50/80/100% email alerts; check subscription state in a weekly ops review | M |
| Operational excellence | No unit tests in CI before deploy | Broken code reaches production | Run `npm test` in `deploy.yml` (tests exist in the Part A patch) | M |
| Operational excellence | No alerts | Failures noticed by customers first | App Insights alerts on 5xx rate, failed sign-ins, and the availability test below | M |
| Performance | API and Cosmos DB in East US 2; users in Singapore | ~200 ms extra round trip on every call | Deploy both to Southeast Asia | M |
| Performance | Cold starts on Consumption | Slow first order after idle | Flex Consumption with one always-ready instance at lunch | L |
| Performance | Staff list and stats are cross-partition queries | RU and latency grow with order volume | Partition on `/stallId` at multi-stall scale (ADR-0002) | L |

## What I'd do first

1. Fix the XSS and add a CSP (an hour, highest risk).
2. Managed Identity for Cosmos, Key Vault references for secrets.
3. Pick the Cosmos capacity mode from COST.md and add a budget alert.
