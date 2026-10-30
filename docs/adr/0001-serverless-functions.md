# ADR-0001: Azure Functions on the Consumption plan for the API

- Status: Accepted (migration to Flex Consumption planned) · Date: 2026-09-05

## Context
Orders arrive in a lunch-time spike and almost nothing overnight. One developer maintains the system, and the budget is close to zero.

## Decision
Run every HTTP endpoint as an Azure Functions v4 app (Node 20, Linux) on the Consumption plan, with routes declared in code via `app.http(...)`.

## Consequences
- + Pay per execution, with a monthly free grant; scales to zero when idle and out automatically at lunch.
- + No servers or OS patching.
- − Cold start after idle makes the first request noticeably slower.
- − Microsoft is retiring **Linux Consumption on 30 Sep 2028** and it gets no new language versions, so this needs a planned move to **Flex Consumption**.
- − `/admin/*` routes are reserved by the Functions host, so the stats route had to become `stats/admin`.

## Alternatives considered
- **App Service (B1):** always warm and predictable, but a fixed monthly cost even at zero orders.
- **Container Apps:** more control and scale-to-zero, but more to set up (containers, ingress) for a small API.
- **Flex Consumption now:** the long-term target; it adds always-ready instances to remove cold starts. Deferred until the migration is planned.
