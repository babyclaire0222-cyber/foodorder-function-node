# Food Express — Cost model

> Fill the `$` cells from the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) for **your region**, then save the calculator estimate link at the bottom. Never quote prices from memory in an interview; quote this file.

## Usage assumptions

API calls per order, from `web/app.js`: sign-in token exchange (1) + menu load (1) + place order (1) + status check (~2) + acknowledge (1) ≈ **6 calls**.

| Driver | Pilot | Scale-up | How derived |
| --- | --- | --- | --- |
| Stalls | 1 | 50 | assumption |
| Orders per day | 200 | 10,000 | 200 per stall |
| API executions per month | ~36,000 | ~1,800,000 | orders/day × 6 × 30 |
| Cosmos writes per month | ~12,000 | ~600,000 | 2 per order (create + acknowledge) × orders × 30 |
| Cosmos point reads per month | ~18,000 | ~900,000 | ~3 per order (menu item, status, acknowledge check) |
| Data stored | < 1 GB | < 1 GB | orders expire after 24 h (ADR-0006) |

## Monthly cost by service

| Service | Billing basis | Pilot | Scale-up | Note |
| --- | --- | --- | --- | --- |
| Azure Functions (Consumption) | executions + GB-s, after a free grant of 1M executions and 400,000 GB-s per subscription | $ | $ | Pilot sits inside the free grant |
| Cosmos DB | **depends on capacity mode** — see below | $ | $ | Usually the biggest line |
| Static Web Apps | Free plan | $0 | $ | Standard plan if you need custom auth or SLA |
| Logic App (Consumption) | per action execution | $ | $ | 1 run per order |
| Application Insights / Log Analytics | GB ingested | $ | $ | Sampling is on in `host.json` |
| Storage account (Functions runtime) | GB + transactions | $ | $ | Small |
| **Total** | | **$** | **$** | |

## The Cosmos DB decision

The containers are created by code with no throughput setting, so the bill depends on how the **account** was created:

| Mode | You pay for | Fits |
| --- | --- | --- |
| Provisioned (manual) | Reserved RU/s per hour, even at zero traffic; storage | Steady, predictable load |
| Provisioned (autoscale) | Peak RU/s used each hour (scales 10%–100% of a max) | Spiky load with a known ceiling |
| Serverless | RUs actually consumed; storage | Low or intermittent traffic — **likely the pilot's best fit** |
| Free tier (one account per subscription) | First 1,000 RU/s and 25 GB free | Learning and pilots |

Current mode: **provisioned throughput, manual, free tier off** (no containers created yet; the code would create 2 containers).
Recommended for pilot: **serverless**, because traffic is near zero outside lunch and serverless bills only for requests used.
Recommended for scale-up: **provisioned autoscale**, because 50 stalls give a steady daily load with a predictable lunch peak.

## Biggest cost driver and how to cut it

Pricing Calculator comparison (provisioned vs serverless, East US 2) in progress.

