# ADR-0002: Cosmos DB for NoSQL, partition key `/id`

- Status: Accepted · Date: 2026-09-05

## Context
Orders and menu items are small JSON documents whose shape changed several times during development. Orders should disappear after a day. The hottest access pattern is "get this one order by ID" (customer tracking screen).

## Decision
Use Cosmos DB for NoSQL with two containers, `Orders` and `MenuItems`, both partitioned on `/id`.

## Consequences
- + Point reads by ID (`container.item(id, id).read()`) are the cheapest, fastest Cosmos operation, and that's the customer's main call.
- + `/id` spreads writes evenly: no hot partition.
- + Native TTL (ADR-0006) and schemaless documents.
- − Staff "list orders" and admin stats (`ORDER BY`, `GROUP BY`, `COUNT`) are **cross-partition queries** that fan out over all partitions. Fine at stall scale; at many stalls they'd cost more RUs and latency.
- − Containers are created by code with no explicit throughput. On a provisioned-throughput account each gets its own dedicated throughput, a fixed hourly cost even when idle. This account is provisioned (free tier off), so once the app creates its two containers, each will bill for dedicated throughput even at zero traffic. Planned: recreate the account as serverless before go-live; it holds no data, so nothing is lost.

## Alternatives considered
- **Partition key `/stallId`:** the right choice once there are many stalls, since each stall's dashboard query stays in one partition. Needs `stallId` on every order.
- **Partition key `/status`:** rejected — very few distinct values creates hot partitions and items move between partitions on every status change, which Cosmos can't do in place.
- **Azure SQL Database:** better for reporting queries, but needs schema migrations and has no native per-row TTL.
