# ADR-0003: Entra ID sign-in, auth code + PKCE, code exchanged by the API

- Status: Accepted · Date: 2026-09-05

## Context
We need sign-in without storing passwords ourselves, and a reliable way to tell staff from customers.

## Decision
Register Food Express as a **Web** app in Entra ID. The browser starts the authorisation-code flow with PKCE; `POST /api/auth/token` exchanges the code using MSAL as a confidential client (with the client secret held in the Function App). Every API call then carries the access token, which the API verifies against Entra ID's JWKS.

## Consequences
- + Passwords, MFA and account recovery are Microsoft's problem.
- + Roles arrive as a signed `roles` claim (ADR-0004).
- + Token checks are cryptographic (signature, issuer, audience, expiry), not just decoding.
- − The API holds a **client secret** that must be rotated before expiry; better kept in Key Vault (see WELL-ARCHITECTED.md).
- − The access token is handed to browser JavaScript, so XSS on the frontend would expose it.

## Alternatives considered
- **SPA registration with msal-browser:** no backend secret at all; the browser does the exchange. Simpler secret management; a reasonable future move.
- **Static Web Apps built-in auth:** less code, but ties the API to SWA's linked backend model.
