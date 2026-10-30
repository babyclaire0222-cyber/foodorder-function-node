# ADR-0005: Notifications sent by the server through a Logic App

- Status: Accepted · Date: 2026-09-05

## Context
The original app exposed `/api/notify`, so any signed-in user could send notifications about anyone's order. We also want email or SMS without writing connector code.

## Decision
After the API itself writes a new order, it POSTs to a Logic App HTTP trigger (`LOGIC_APP_NOTIFICATION_URL`). The call is awaited (so the host doesn't freeze it mid-flight) but best-effort: failures are logged and never fail the order.

## Consequences
- + Users can't trigger notifications; only real orders do.
- + The email/SMS action is configured in the Logic App designer, not in code.
- − The notification call sits **inside the order request**, so a slow Logic App makes ordering slower.
- − Best-effort means a failed notification is lost, with no retry.
- − The trigger URL contains a SAS signature, so it's a secret.

## Alternatives considered
- **Storage queue + queue-triggered Function, or Event Grid:** decouples ordering from notifying and gives automatic retries. The better design if notifications become important.
- **Cosmos DB change feed trigger:** reacts to every order write without touching the order code.
