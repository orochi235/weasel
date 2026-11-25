- Reference fetch: a server error or a later `build:api` is never retried, because the "not built" result is cached (A+B) — fixed 17dfdf8168
- Export index: every group that lists a type-and-value name shows the first declaration's summary and deprecation (A+B) — fixed 9babce4382. Each group now records which kinds it lists a name as. A row is struck only when every declaration it stands for is deprecated.
- `CallDetails`: two destructured parameters get the same React key `options` (A) — fixed 7cbe9e1b3f
- Guides: a guide body is looked up through the prototype chain, so a `constructor` slug crashes `Prose` (B) — fixed 28ea6f6299
- Guides: two guide files with the same slug show one file's title over the other's body (B) — fixed 1dbbdce437. Strict call: the site build now throws and names both files. Recorded in `docs/unruled.md`.
- Reference: a root export named like a subpath entry has a page nobody can reach (B) — fixed 8179562ee1. Strict call: `readProject` throws on the collision. Recorded in `docs/unruled.md`. No package collides today: I checked each package's `exports` map against its root `index.ts`, and the one hit, labkit's `chrome`, was a false match on `export * from './chrome'`.

Extra defects:
- `ReferenceView` keyed a symbol page's declarations by kind, the same mistake as `CallDetails`; two re-exports of one name would share the key `alias` — fixed 7cbe9e1b3f, keyed by position. This rests on reading the code; no current export reproduces it.

Changesets: none written. Every change is in `apps/site`, `apps/shared`, or `scripts`, which ship no package a consumer installs.

Checks:
- `npx vitest run --maxWorkers=1 apps/site/__tests__/Packages.test.tsx` — pass (12/12)
- `npx vitest run --maxWorkers=1 apps/site/__tests__/CallDetails.test.tsx` — pass (1/1)
- `npx vitest run --maxWorkers=1 apps/site/__tests__/Guides.test.tsx` — pass (1/1)
- `npx vitest run --maxWorkers=1 apps/site/__tests__/ReferenceView.test.tsx` — pass (8/8)
- `npx vitest run --maxWorkers=1 scripts/vite-package-docs.test.ts` — pass (9/9)
- `npx vitest run --maxWorkers=1 scripts/lib/reference/project.test.ts` — pass (22/22)
- Each new test was watched failing against the code before its fix.
- `npm run typecheck:packages` — not applicable, no package changed.
- `npm run typecheck` — unrun. This machine's hook refused it as suite-sized and sent it to the fleet, which the brief rules out. The controller's gate covers it.
- eslint on the 14 changed files — pass
- `npm run check:size` — pass ("no file or function grew past its cap")
- `npm run check:changesets` — pass ("OK — 1676 changeset(s)")
- Tree clean apart from `.skulk/`.