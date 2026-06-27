# weasel — agent guide

Generic 2D scene-graph canvas library, published as `@weasel-js/core`. This
file is a map for any agent (Claude Code, Codex, Cursor, …) working in the
repo. It indexes the canonical docs rather than restating them.

## Read first

- **`CLAUDE.md`** — the canonical instruction set: terminology (workspace /
  canvas / document / scene / group), the gesture/action/interaction
  taxonomy rules, package-manager policy (npm is canonical), and reference
  implementations. **If anything here conflicts with `CLAUDE.md`, `CLAUDE.md`
  wins.**
- **`CONTRIBUTING.md`** — testing (fast TIA scripts vs. the full gate), visual
  regression baselines (must be captured on the pinned CI runner), and the
  rules for adding a bundled `@weasel-js/*` sub-package.

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

## Reference implementations (start here for new tools)

- `src/tools/builtin/useHandTool.ts` — simplest tool: scratch + drag channel +
  view mutation. No ops, no adapter.
- `src/tools/builtin/useRectTool.ts` — canonical scene-object-creating tool:
  `useDragRect` gesture + undoable `ctx.applyBatch([createInsertOp(...)])`.

## Layout

- `src/` — the kit (`@weasel-js/core`). Paths live under `src/features/paths/`.
- `packages/*` — bundled-into-core sub-packages (`svg`, `history`, `modes`,
  `ui`, `hud`, `theme`, `geom`, …). Not independently published; see
  `CONTRIBUTING.md`. Some carry their own scoped `AGENTS.md` (e.g. `labkit`).
- `demo/demos/` — terse single-feature demos. `apps/draw` — the WeaselDraw
  consumer app.
- `docs/specs/`, `docs/plans/`, `docs/superpowers/` — internal design notes and
  in-flight work; not part of the user-facing reference.

## Verifying changes

`npm test` runs the full vitest suite (the authoritative correctness gate).
The release gate is `prepublishOnly` = `typecheck && test && build &&
test:smoke:consumer && build:demo` — run it before pushing release-bound
changes. For tight loops, `npm run test:changed` / `test:related <file>`.
Don't update visual baselines locally — they're pinned to the CI runner.
