# Architecture decision records

Each record captures one decision: the context, what we chose, what it costs us, and what we rejected.
Write a new ADR instead of editing an accepted one; mark the old one "Superseded by ADR-xxxx".

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-serverless-functions.md) | Azure Functions (Consumption) for the API | Accepted, migration to Flex planned |
| [0002](0002-cosmos-db-and-partition-key.md) | Cosmos DB for NoSQL, partition key `/id` | Accepted |
| [0003](0003-entra-id-pkce-confidential-client.md) | Entra ID auth-code + PKCE, code exchanged by the API | Accepted |
| [0004](0004-app-role-and-admin-key.md) | `StallStaff` app role; static admin key for stats | Accepted, admin key to be replaced |
| [0005](0005-server-side-notifications-logic-app.md) | Server-side notifications through a Logic App | Accepted |
| [0006](0006-ttl-for-order-expiry.md) | 24-hour TTL on orders | Accepted |
