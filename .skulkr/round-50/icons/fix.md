- Variant loads twice when a listener calls `loadVariant` during the `loading` notice (A): fixed 1d57ecaff1
- Glyphs move to the end of `entries()` when the provider's `icons` change identity (A): fixed 7521e58566. The registry now uses `holdPlace`.
- `toIconSpec` drops the whole spec when `mark` is `null` (A): fixed 67a3f23e55
- `add` registers a null or malformed glyph (A): fixed 21bd326044. My call: the batch is refused with a `TypeError` unless every glyph has a string `body` and `group`, an array of `tags`, and a `fill` that is absent or a string. I added this to the 2026-11-11 entry in `docs/unruled.md` (ce8aae7e6c).
- `useIconGlyph` and `useIconVariant` throw under server rendering because they have no `getServerSnapshot` (B): fixed 9167b7970b
- A failed variant stays failed after its loader is replaced, so a mounted `useIconVariant` never retries (B): fixed 41c9e6f1e9. A new loader for a failed variant now sets it back to `idle`. The other half of the finding, a new loader for a `loaded` variant being ignored, is not a defect: running it would add the variant's tables a second time. My call, recorded in `docs/unruled.md` (ce8aae7e6c). The variants property test's model was updated to match.

Extra defects (both were in the frozen tree, outside icons, and failed the gate):
- `check:numeric` failure: `apps/draw/src/dev/audits/Treemap.module.css` used a bare `font-variant-numeric`. It now uses the theme's `numeric` class instead (that class sets a font family too): fixed 4fea30a63c
- `lint -w @weasel-js/labkit` design-token failure: the `font-size` rule in `packages/ui/src/components/SpanStrip/SpanStrip.module.css` held a raw `22px` fallback. The stripe's line height now lives in one local property, with the same pixels: fixed b9f3dd30f1

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `registry.test.ts` pass (25), `registry.pbt.test.ts` pass (4), `spec.test.ts` pass (3), `react/iconRegistry.test.tsx` pass (10), `ui/.../SpanStrip.test.tsx` pass (15). I also ran the other icons test files (`isolation`, `names`, `names.pbt`, `registry.reentrant.pbt`, `registry.shrunk`), which I did not change: all pass.
- `npm run checks:gate`: the first run failed 2 of 32 (`check:numeric`, `lint -w @weasel-js/labkit`). After the two extra fixes: "checks:gate: all 32 passed".
- `npm run check:changesets`: OK
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run lint -w @weasel-js/icons` and `-w @weasel-js/ui`: neither package has a `lint` script. draw has no workspace `package.json` under `apps/draw`. eslint on the changed files is covered by the gate's `lint` step, which passed.
- No `*.browser.test.*` files were touched.
- Tree is clean apart from `.skulk/`.

tally: 6 of 6 fixed, 2 extra fixed