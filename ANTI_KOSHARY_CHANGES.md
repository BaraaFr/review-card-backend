# Anti-koshary changes — September 13, 2026

Twelve of the original thirteen findings are addressed, including ten of the eleven remaining after the first fixing pass. One dependency decision remains.

## Completed

| Finding | Result |
| --- | --- |
| Cross-business analytics access | Resource-derived business context is checked; conflicting business/store/card IDs are rejected. |
| Auth logic in controllers | Login and activation rules now live in one service. The active `usedAt` invitation claim and HTTP response contracts are preserved. |
| Duplicated calculations | Reporting services share percentage calculations. Named compatibility functions preserve the overview API's two decimals and empty-period behavior, and engagement's floating-point operation order. |
| Large weekly-report function | Queries, pure calculations, and orchestration are separate. Location ranking, card ranking, timing patterns, and warnings each have a function. Populated and empty outputs match fixtures captured before extraction. |
| Dead code | Removed compiler-confirmed unused date helpers, types, and imports. Unused-declaration checks pass. |
| Duplicate PDF queries | PDF assembly computes card performance once and reuses it when building Action Center warnings. |
| Lost weekly deliveries after Redis failure | Pending deliveries are reconciled in batches independently of the original schedule window. Queue job IDs remain deterministic. Disabled automatic reports and unusable subscriptions are skipped. Top-level scan errors are handled and overlapping scans within a process are prevented. |
| Inconsistent errors | A final Express handler returns JSON for invalid analytics ranges, validation failures, malformed bodies, and unexpected errors without exposing exception details. |
| Loading all interactions | Engagement patterns process 1,000-row batches using timestamp/ID pagination. Local dates and exact visitor counts are preserved. Exact visitor sets still grow with unique visitors; this does not make total memory usage constant. |
| Sessions surviving password changes | Password updates and all-session revocation share a transaction. Cookies are cleared. Protected requests check session revocation and expiry, so already-issued JWTs cannot continue until their expiry. |
| Unthrottled login | Redis atomically enforces 10 attempts per account and 100 per IP/subnet per 15 minutes across API instances. Keys contain hashes and expire. Rejected requests return 429 plus Retry-After; unavailable Redis returns 503 instead of bypassing the limits. |
| Runtime qs advisories | Updated qs to 6.16.0. |

Password changes now require signing in again on every device. Logout also invalidates the associated access JWT immediately because authentication checks its session record.

## Dependency updates

| Package | Before | After |
| --- | --- | --- |
| @bull-board/api | 9.10.0 | 9.10.1 |
| @bull-board/express | 9.10.0 | 9.10.1 |
| @prisma/adapter-pg | 7.9.1 | 7.10.0 |
| @types/node | 26.2.0 | 26.5.1 |
| nodemailer | 10.0.6 | 10.0.9 |
| tsx | 4.23.12 | 4.23.13 |
| zod | 4.4.3 | 4.6.4 |
| qs (transitive) | 6.15.3 | 6.16.0 |

The test harness now declares its existing esbuild 0.28.2 dependency directly. No major-version upgrade or database migration was applied.

## Pending: Prisma/deepmerge-ts

`prisma@6.19.3 → @prisma/config@6.19.3 → deepmerge-ts@7.1.5` remains flagged. npm reports three High package entries for this one chain. It also appears with `npm audit --omit=dev`, because `@prisma/client` has an optional peer dependency on Prisma. It must not be described as a clean production audit.

The [deepmerge-ts advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) concerns recursive object graphs and identifies 8.0.0 as patched. Inspection found the merge library used by Prisma's config loader, not a demonstrated request-input path in this application. The current scanner proposes a Prisma 6.12.0 downgrade and labels it breaking; that was not applied.

An explicit major-version decision is needed before testing/applying this narrowly scoped candidate override:

```json
{
  "overrides": {
    "@prisma/config": {
      "deepmerge-ts": "8.0.0"
    }
  }
}
```

This candidate is not installed or compatibility-verified. If approved, validate Prisma configuration loading and client generation, inspect the upstream merge changes, run all checks, and rescan the resulting dependency graph before retaining it. An alternative is to wait for a compatible Prisma release that updates its own pinned dependency.

## Verification and recovery

- `npm test`: 23 passing regression tests.
- `npm run build`: passes.
- `tsc --noEmit --noUnusedLocals --noUnusedParameters`: passes.
- `prisma validate`: passes.
- Express integration smoke test: passes on a temporary localhost port, with external services and application routes replaced by test boundaries.
- Redis integration test: passes against an isolated Redis Unix socket, exercising concurrent account limits across two module instances, IP limits, and counter expiration. The isolated Redis process was shut down afterward.
- Database-dependent tests use mocks; no live application database or SMTP service was used. These checks do not constitute an end-to-end production deployment test.

The workspace has no `.git` directory. Recovery checkpoints are stored separately at `/private/tmp/review-card-anti-koshary.5J9AsQ/history.git`; the original source and lockfile baseline is commit `669c25f`. Each verified group has its own commit. This temporary history should be copied to durable storage if it is needed beyond this session. Environment secrets were excluded from it.

Integration tests can be rerun with:

```sh
node --test tests/integration/app-smoke.test.cjs
TEST_REDIS_SOCKET=/private/tmp/your-isolated-redis.sock node --test tests/integration/login-rate-limit.test.cjs
```

Use a fresh, isolated Redis socket for the latter test. The normal `npm test` suite does not connect to external services.
