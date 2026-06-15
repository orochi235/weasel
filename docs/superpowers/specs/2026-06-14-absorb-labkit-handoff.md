# labkit absorption — handoff: unresolved issues

**Date:** 2026-06-14
**State:** labkit is merged into `main` (`packages/labkit`, `@weasel-js/labkit`)
and fully green (typecheck, lint, tests, build, dts). This doc lists everything
**not** done. Companion: `2026-06-14-absorb-labkit-into-weasel-design.md`.

## Context snapshot

- `main` contains the org refactor (`@orochi235/*` → `@weasel-js/*`, core is
  `@weasel-js/core`) + the labkit absorption. It is **local-only**: `main` is
  ~130 commits ahead of `origin/main` (which is still at the pre-refactor
  `ca00d8f8`).
- The dts pipeline is rename-robust: it resolves weasel specifiers via
  `scripts/vite-aliases.ts` (`weaselAliases()`), the single source of truth.
- The merged feature branch `feat/absorb-labkit` and its worktree
  `~/src/weasel-absorb-labkit` are now redundant.

---

## P0 — Publish / one-way doors (deliberately deferred; need a decision)

1. **Nothing is pushed.** `main` (refactor + labkit) is unpushed. Pushing makes
   the `@weasel-js` rename public. Coordinate before `git push` — `origin/main`
   is 130 commits behind and other clones/CI will see a huge jump.
2. **No changeset for labkit.** `@weasel-js/labkit` is `private: false`,
   `version: 0.0.1`, `access: public`, but no `.changeset/*` entry references it,
   so it won't publish. Add a changeset (and decide the initial version — core is
   at `0.3.0`).
3. **No labkit publish has happened** — first publish to npm `@weasel-js/labkit`
   is untested end-to-end. `prepublishOnly` runs `npm run build`; confirm the
   packed tarball (`npm pack`) contains `dist` + `src` and resolves.
4. **Standalone `orochi235/labkit` repo decommission** (one-way doors, from the
   design doc, untouched):
   - Replace its GitHub Pages with `index.html` + `404.html` meta-refresh to
     `orochi235.github.io/weasel/labkit/`.
   - Archive the repo with a README pointer (rename/transfer would redirect, but
     this isn't that — it becomes an archived pointer).
   - The local standalone checkout still lives at `~/src/labkit`.

---

## P1 — Coverage / quality gaps in the absorption

5. **`noUncheckedIndexedAccess` is OFF** in `packages/labkit/tsconfig.lib.json`
   and `tsconfig.dts.json`. ⚠️ **Re-scoped 2026-06-14:** the original "4 latent
   violations in `useReorderDragList.ts`" was a drastic undercount. Those 4 are
   now fixed in `packages/ui/src/useReorderDragList.ts`, but enabling the flag
   strict-checks everything labkit resolves to SOURCE: ~360 violations across all
   of `packages/ui` (via `@weasel-js/ui`), and via the dts config's
   `@weasel-js/core` source alias, **~1,659 across the entire weasel engine**
   (paths/Bezier/NURBS/spiro/tessellation/stroke, renderer math, pen tool,
   interactions, animation/color). `rollup-plugin-dts` runs no diagnostics, so the
   flag never gated anything — it was aspirational. **Decision: deferred.**
   Restoring it is a monorepo-wide hardening initiative (do it incrementally,
   likely per-package starting from leaves), NOT a labkit cleanup item. The config
   comments now document this so it isn't re-investigated as "4 spots."
6. ✅ **DONE (2026-06-14).** labkit's 27 stories are now in the unified root
   Storybook 10 instance. Changes: (a) migrated all `import … from
   '@storybook/react'` → `'@storybook/react-vite'`; (b) namespaced every CSF meta
   title under `labkit/…` (component/arg `title` props left alone); (c) added
   `'../packages/labkit/src/**/*.stories.@(ts|tsx)'` to `.storybook/main.ts`;
   (d) in `.storybook/preview.tsx`, added a **title-scoped** decorator that wraps
   only `labkit/…` stories in `.lk-root .lk-theme-* .lk-sb-frame`, a `lkTheme`
   toolbar (auto/light/interstellar) independent of the weasel `theme` toggle,
   labkit `.less` imports, and a re-declared Oswald `@font-face` (the dist CSS
   resolves its URL relative to the compiled stylesheet); (e) added
   `.storybook/types.d.ts` for `*.less`/`?url`. Verified: `build-storybook`
   succeeds and indexes all 27 under `labkit/`; labkit lint + tests + consumer
   smoke green. NOTE: labkit's now-redundant local `.storybook/` (SB8) +
   `storybook`/`build-storybook` scripts are dead but still present — fold their
   removal into #7 (they entangle with `build:site`).
7. ✅ **DONE (2026-06-14).** labkit's VitePress docs now build into weasel's Pages
   under `/labkit`. Changes: (a) added `vitepress@^1.6.4` to labkit devDeps (it
   wasn't carried over in the absorption, so the site couldn't build); (b) fixed
   `docs/.vitepress/config.ts` — `base: '/labkit/'` → `'/weasel/labkit/'`, Storybook
   nav link → `…/weasel/docs/ui/storybook/`, social link → `github.com/orochi235/weasel`;
   (c) added to `pages.yml`: `npm run docs:build -w @weasel-js/labkit` then copy
   `packages/labkit/docs/.vitepress/dist/` → `dist-demo/labkit/`; (d) retired the
   now-dead standalone tooling — removed labkit's `.storybook/` dir and its
   `storybook`/`build-storybook`/`build:site` scripts (Storybook is unified per #6;
   nothing in weasel referenced them). Kept `docs:dev`/`docs:build`/`docs:preview`.
   Verified `docs:build` succeeds with `/weasel/labkit/` baked into asset URLs.
   Won't deploy until `main` is pushed (P0 #1). This is the prerequisite for the
   standalone-repo decommission redirect (P0 #4).
8. **Examples are unverified.** `packages/labkit/examples/{minimal,drag-lab,weasel-lab}`
   are excluded from biome (`!examples`), not typechecked, not a vitest project,
   and not built in CI. Their `@orochi235/*` specifiers were renamed to
   `@weasel-js/*` but nothing compiles/runs them. They `import` `@weasel-js/core`
   and `@weasel-js/labkit`. (Design doc keeps them under `packages/labkit` for v1;
   promotion to `apps/` is later.)
9. ✅ **DONE (2026-06-14).** Added `packages/labkit/scripts/smoke-consumer-bundle.mjs`
   (`test:smoke:consumer` in labkit's package.json; CI step after the labkit build
   in `.github/workflows/ci.yml`). It does two checks: (1) relocates the built
   `dist` outside the repo and esbuild-bundles a consumer importing all 11 package
   entries — proving no `@weasel-js/*` specifier leaked into the runtime JS; and
   (2) statically greps every dist file (`.js` AND `.d.ts`) for leaked
   import/export/require/import() targeting `@weasel-js` — automating the manual
   "self-contained types" grep. Verified passing on real dist and verified it
   fails on an injected leak.

---

## P2 — dts pipeline residue & lint debt

10. **Benign `declare module` warning** on every `build:dts` run:
    `declare module ".../interactions/actions/depRegistry" could not be resolved
    to any output chunk`. It's an orphaned `DepSchema` augmentation
    (`src/interactions/actions/depSchema.ts`) that rollup-plugin-dts rewrites to a
    self-referential chunk; the public `.d.ts` is valid (consumer typecheck
    passes) and labkit doesn't even export `DepRegistry`. Harmless but noisy —
    investigate or suppress later.
11. **`tsconfig.dts.json` `paths` are a fallback only.** rollup-plugin-dts ignores
    them; the build resolves via the `@rollup/plugin-alias` table fed by
    `weaselAliases()`. The `paths` exist solely so a direct
    `tsc -p tsconfig.dts.json` (a diagnostic) still resolves against source. Keep
    them in sync with `weaselAliases` on a future rename, or delete them.
12. **~21 biome warnings** remain in labkit (`noExplicitAny`, `noNonNullAssertion`).
    Non-blocking (biome exits 0; CI gate is errors only). Tighten if desired.
13. **`check-class-prefix` now allows `is-`/`has-` state modifiers.** This session
    taught the script the BEM state convention (the classes are only ever used
    compounded under an `lk-` block, e.g. `.lk-effect-card.is-expanded`). If you
    prefer strict `lk-` prefixing instead, revert that and rename the classes.

---

## P3 — Housekeeping

14. ✅ **DONE (2026-06-14).** Removed the `~/src/weasel-absorb-labkit` worktree
    and deleted the merged `feat/absorb-labkit` branch (force-delete: it was
    merged to `main` but not to its stale `origin/feat/absorb-labkit` tracking
    branch). Unrelated `~/src/weasel-eric-pin` (detached HEAD) left in place.
15. **Resume the paused session.** The other `claude` (pid 24460) was paused so
    `main` would hold still for the fast-forward. `main` is now at the merge
    commit; resume it on the new `main`.
16. **`.hued`** was copied into `packages/labkit/.hued` (a termcolor background
    marker). It's gitignored — local-only, not committed. Informational.

---

## Notes / non-issues (so they aren't re-investigated)

- **labkit's `dist` bundles all transitively-used `@weasel-js/*` packages**
  (via tsup `noExternal: [/^@weasel-js\//]`) — intended, that's what makes it
  self-contained. Watch bundle size if more weasel packages get pulled in.
- **labkit tests are now enforced in CI** via a dedicated `labkit` vitest project
  (own setup + `css`). Before this session the broad `weasel-ui` glob swept labkit
  in with the wrong setup and produced 48 spurious failures; that's fixed by an
  exclude. The suite is jsdom with a stubbed canvas — real DnD / canvas rendering
  isn't exercised.
- **The one known test environment limitation:** `LayerStack`'s `weasel-ui` mock
  needed `dlog` added (fixed). Pattern to watch: any test that `vi.mock`s
  `passthrough/weasel-ui` must include every symbol the component imports.
