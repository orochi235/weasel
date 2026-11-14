# weasel — agent guide

Generic scene-graph engine, published as `@weasel-js/core` and its sibling
packages (2D in core, 3D in `@weasel-js/kernel3d`). This
file is a map for any agent (Claude Code, Codex, Cursor, …) working in the
repo. It indexes the canonical docs rather than restating them.

## Read first

- **`CLAUDE.md`** — the canonical instruction set: terminology (workspace /
  canvas / document / scene / group), the gesture/action/interaction
  taxonomy rules, package-manager policy (npm is canonical), and reference
  implementations. **If anything here conflicts with `CLAUDE.md`, `CLAUDE.md`
  wins.**
- **`CONTRIBUTING.md`** — scoped test scripts vs. the full suite, visual
  regression baselines (must be captured on the pinned CI runner), the site's
  package pages, and the rules for adding a `@weasel-js/*` package.

## Design stances & references

- **`docs/conventions.md`** — project-wide API-design rules. Read before adding
  or changing public API shape. Current stances: defaults stay explicitly
  declarable; geometry composes through a terse path language (**SVG `d`** via
  `pathFromD`) rather than a kit-invented DSL, with builders a co-equal choice.
- **`docs/taxonomy.md`** — the precise referents for *gesture* / *action* /
  *interaction* / *binding*. Read before any rename or new field in the
  dispatcher/routing layer.
- **`docs/README.md`** — reader's index into the reference docs
  (`concepts.md`, `hooks.md`, `adapters.md`, `extending.md`,
  `scene-serialization.md`).
- **`docs/TODO.md`** — the backlog. Consult before planning new work; it's
  organized by area with P1/P2/P3 priority tags.
- **`docs/PERF.md`** — the performance backlog: runtime costs, and test-suite and
  dev-server speed, under the same tags.

## Reference implementations (start here for new tools)

`CLAUDE.md` ("Reference implementations") says what each one teaches:

- `packages/core/src/tools/builtin/hand/useHandTool.ts` — the smallest declarative tool: one
  binding routing a drag to the `viewport.dragPan` action. No ops, no adapter.
- `packages/core/src/tools/builtin/rect/useRectTool.ts` — the canonical tool that creates scene
  objects: it declares a `drag → insert` binding, and the `insert` action and dep do the rest.
- `packages/core/src/tools/builtin/polygon/usePolygonTool.tsx` — the same, with thunked binding
  params and actions the tool owns.

## Layout

- `packages/core/src/` — the kit (`@weasel-js/core`). Paths live under `packages/core/src/domains/paths/`.
- `packages/*` — the other `@weasel-js/*` packages (`svg`, `history`, `modes`,
  `ui`, `hud`, `theme`, `geom`, …), each published on its own and released at
  one version; the root `README.md` lists them. labkit's agent guide is
  `packages/labkit/docs/guides/2-agents.md`.
- `apps/site/demos/` — terse single-feature demos. `apps/draw` — the WeaselDraw
  consumer app.
- `docs/specs/`, `docs/proposals/`, `docs/superpowers/` — internal design notes and
  in-flight work; not part of the user-facing reference.

## Verifying changes

`npm test` runs the full vitest suite (the authoritative correctness gate);
`CLAUDE.md` ("Worktrees and the fleet", "Test and typecheck commands") says
where and when it runs. The release gate is `prepublishOnly`, which chains the
changeset and repo checks, typecheck, lint, the suite, the build and
`test:smoke:consumer`. For tight loops, `npm run test:changed` /
`test:related <file>`. Don't update visual baselines locally — they're pinned
to the CI runner.
