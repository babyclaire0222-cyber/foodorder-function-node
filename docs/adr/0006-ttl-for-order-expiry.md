# ADR-0006: Orders expire after 24 hours (Cosmos DB TTL)

- Status: Accepted · Date: 2026-09-05

## Context
Orders are only useful on the day; keeping them forever grows storage and query cost, and holds customer emails longer than needed.

## Decision
Enable TTL on the `Orders` container (`defaultTtl: -1`) and give each order `ttl: 86400`. Cosmos deletes expired orders in the background using spare throughput; we write and run no cleanup code.

## Consequences
- + Storage stays small; less personal data kept (data minimisation).
- + No cleanup job to write or run.
- − No order history for reporting: the stats endpoint only ever sees the last 24 hours.
- − A customer checking an order after 24 hours gets "not found".

## Alternatives considered
- **Keep everything and archive nightly:** needed if reporting matters; e.g. change feed → Blob storage/Fabric before expiry.
- **A scheduled cleanup Function:** more code, and it spends RUs.
