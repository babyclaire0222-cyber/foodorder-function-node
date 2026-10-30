# Food Express — Disaster recovery

## Targets (pilot)

| Scenario | RTO (back in service) | RPO (data we can lose) |
| --- | --- | --- |
| Bad deploy | 15 min | 0 |
| Data deleted or corrupted | 4 h | up to 4 h (periodic backup every 240 min, kept 8 h) |
| Azure region outage | 4 h | Today's orders (acceptable: they expire in 24 h anyway) |

These are business choices for a single food stall, not technical limits. Tighter targets cost more (see the last section).

## What protects what

| Asset | Protection today | Restore |
| --- | --- | --- |
| Code (API + frontend) | Git on GitHub | Re-run the deploy workflow |
| Configuration | Function App settings (not in Git) | No app settings configured yet. Required names are listed in `local.settings.json.example` (in Git, no values) |
| Infrastructure | `az` commands in the README | Manual re-run (slow) → **move to IaC** |
| Orders + menu | Cosmos DB built-in backup | Periodic mode: support request; continuous mode: self-service point-in-time restore |

Backup mode: Periodic, every 240 minutes, retention 8 hours. Restore requires an Azure support request (no self-service point-in-time restore).

## Runbook: region outage

1. Confirm on [Azure status](https://azure.status.microsoft/) that the region is down.
2. Create the resource group and resources in the secondary region (Southeast Asia, or East US if that's not primary) — from IaC once it exists, from the README `az` commands until then.
3. Restore Cosmos data into the new account (or start empty: orders are same-day only; re-seed the menu).
4. Update Function App settings, then re-run the API deploy workflow pointed at the new app.
5. Update `apiBaseUrl` in the frontend config and redeploy Static Web Apps.
6. Smoke test: sign in, place an order, staff marks it ready, customer acknowledges.

## Runbook: bad deploy

`git revert` the commit on `main`; the deploy workflow redeploys the previous version.

## To meet tighter targets

| Upgrade | Gets you | Cost trade-off |
| --- | --- | --- |
| Bicep/Terraform for all resources | RTO down to ~1 h | Time to write it; no running cost |
| Cosmos continuous backup | Self-service point-in-time restore | Check the retention tier price |
| Cosmos multi-region (read replica, service-managed failover) | Region RTO in minutes, RPO near zero | Roughly doubles Cosmos cost |
| Functions in two regions + Front Door | No manual API failover | Second app + Front Door fees |
