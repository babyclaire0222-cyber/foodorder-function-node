# ADR-0004: `StallStaff` app role for staff; static admin key for stats

- Status: Accepted (admin key to be replaced) · Date: 2026-09-05

## Context
Staff must be able to change order status and the menu; customers must not, even if they edit the frontend. Someone also needs order statistics.

## Decision
- Define an Entra ID **app role** `StallStaff`, assign it to staff accounts, and check `roles` on the verified token in every staff endpoint (`requireStallStaff`).
- Protect `GET /api/stats/admin` with a shared `x-admin-key`, compared in constant time and failing closed when unset.

## Consequences
- + Staff access is granted and revoked in Entra ID, with no code change; it can't be faked client-side.
- − Role changes apply only after the user signs in again (roles are baked into the token).
- − The admin key is a shared secret: no per-person audit trail, and rotation means updating every caller.

## Alternatives considered
- **An `Admin` app role for stats:** same mechanism as staff, per-user and auditable. Preferred next step.
- **Function-level keys (`authLevel: function`):** still shared secrets, just managed by the platform.
