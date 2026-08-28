# weasel-den (stale scaffold)

This directory holds no package — no `package.json`, no `src/`. It marks a design
(`docs/specs/2026-05-03-weasel-den-design.md`) that was approved, then partly
overtaken by work that landed elsewhere, and never built. Read this before acting
on that spec.

## What shipped instead

**The pack shape was superseded.** The den's central abstraction was a hook
returning `{ registry, alwaysOn, keybindings }`. Core's contribution system
replaced it: `alwaysOn` became `ambient`, and the binary registry/ambient split
became a four-condition eligibility *set* — `focus | offhand | always | claimed` —
on `Contribution`, composed with `mergeContributions`
(`packages/core/src/contributions/`).

**The convenience layer shipped inside core.** `ToolBundle`
(`minimal | standard | exhaustive`) plus `defaultTools` / `toolOptions` on
`SceneCanvas` cover what `useStandardTools` and `useStandardCanvasSetup` were for.

**The `{ adapter }` threading is obsolete** — and obsolete for exactly the tools the
spec was migrating. Delete, duplicate, nudge, and undo/redo are actions that read
deps by name; they no longer take adapters. See `docs/adapters.md`.

**The stated blocker is gone.** The repo is an npm-workspaces monorepo and core
lives at `packages/core`, so the spec's first two migration steps ("stand up
workspaces", "move core into `packages/weasel/`") are done.

## What is still open

Moving finished, stable tools out of core for test-surface separation. That was the
den's one motivation nothing has absorbed — and it does not need a new package;
core's own workspace layout can hold them.

Domain bundles are `Contribution` bundles, not packs. The diagram one is designed
separately and ships as `@weasel-js/diagram` — see
`docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`.
