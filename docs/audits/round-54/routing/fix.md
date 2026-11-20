- Main entry loads React through `isDev` (B): fixed 59d0d4390b. Five main-entry files took `isDev` from `@weasel-js/react`, whose barrel imports `react`. They now take it from `@weasel-js/registry`, and so does `useContributions.ts`. A test now imports `./index` with `react` mocked to throw.
- Settings submenu triggers without `world` (A+B): fixed cb82dffa76
- `siblingsOf` splits a map key at an escaped dot (A+B): fixed ed807e717b. The path helpers moved to `menus/paths.ts`, and a new `parentPath` there honors the escape.
- Held modifier trigger in another case gets no loosening (A+B): fixed b85a9e4b41. `offhandKeyFor`, `heldModifierOf` and `heldKeySpec`'s modifier test now ignore case.
- dlog: `*` inside a namespace list doesn't enable everything (A): fixed 6d85a0bf58
- An unmounting publisher clears a selection another live publisher still holds (A): fixed 35e32e1528. The check now covers both orders, the later or the earlier of two publishers going away.
- Route-conflict check skips late-registered actions and bindings changed under the same id (B): fixed ca9b1be134. The signature now covers each entry's eligibility and bindings, the registered actions, and the overrides. It is computed inside the dev-only effect, so production builds don't pay for it.

Extra defects: none.

Checks:
- Test files touched, one at a time with `--maxWorkers=1`: `noReact.test.ts`, `dlog.test.ts`, `resolveMenu.settings.test.ts`, `resolveMenu.compound.test.ts`, `heldModifier.test.ts`, `SelectionContext.test.tsx` and `useContributions.test.tsx` — pass.
- Neighbors also run: `resolveMenu.test.ts`, `resolveMenu.values.test.ts`, `menus.pbt.test.ts`, `contributions.pbt.test.ts`, `useContributions.offhandModifier.test.tsx`, `describeShortcuts.test.ts` and `useGestureDispatcher.keyScope.test.tsx` — pass.
- `npm run checks:gate` — "checks:gate: all 32 passed". The first run failed 4 of 32 (typecheck, typecheck:packages, check:changesets and check:part-caches). All four were fixed and folded into their fix commits.
- `npm run lint -w @weasel-js/routing` — fail: "Missing script: "lint"". Routing has no lint script, so I ran eslint on every changed routing file instead: pass.
- No `*.browser.test.*` files touched.
- Tree clean apart from `.skulk/`.

tally: 10 of 10 fixed, 0 extra fixed