- The `transform` op kind's detail and each shape kind's op-factory links named `createTransformOp`, which no longer exists (A+B): fixed 629c2e06c8
- The Assets page's bundles asset filed editing's presets under `@weasel-js/core` (A): fixed 484662d82e. `registryData.collectBundles` had the same wrong keying, so both now read one shared list in `drawPresets.ts`.
- The Assets page left out text-tools: no `text` preset and no `node:text` properties dialog (B): fixed 7940e83874. It now reads draw's mounted features through the same `DRAW_NODE_PROPERTIES` the registry inspector uses, which moved to `drawPresets.ts`.
- The Toolkit Builder's URL parser accepted any preset as the base, and non-`tools:` presets as tools (A+B; B added the tools half): fixed 58595a7939
- The registry probe's re-render signature left out ambient tools (A): fixed 921b9c6e15. The probe and `useToolReflection` now share one `toolSlotsSignature`. Its test checks the shared signature, not the probe's re-render, because the probe's canvas can't change its ambient tools in jsdom.
- ToolkitBuilder's `.scene` rule lacks the `aspect-ratio` its comment describes (B): fixed db91b7b73e, by deleting the comment rather than restoring the CSS. The ratio was removed on purpose in 28924383fc (2026-10-13): core's `SurfaceCanvas` now sets the canvas to 520×360 from its props, so nothing squishes. Only the comment was wrong. No test, since only a comment changed.
- The icon detail's "file" row could never render, because the source index is keyed by export name and was searched with the glyph ref (B): fixed 7ca76a25f5, by removing the dead row. Pointing it at the glyph's `icons/*.mjs` file would need a glyph index the source-index plugin doesn't build. No failing-first test was possible: nothing visible changed.

No extra defects found.

No changesets were written: every fix is in `apps/draw`, which has no `package.json` and isn't published.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, all pass: AssetsPage.test.tsx 9/9, RegistryDetail.test.tsx 18/18, ToolkitBuilder.test.tsx 6/6, drawAssetSet.test.ts 2/2, toolkit/useToolReflection.test.ts 4/4, registryData.test.tsx 17/17, registryProbe.test.tsx 7/7, RegistryInspector.test.tsx 4/4.
- Unrun: ToolkitBuilder.browser.test.tsx (browser project). I didn't change it, but it mounts ToolkitBuilder.
- `typecheck:packages`: not applicable, because no package under `packages/` changed. Instead I ran TypeScript 7's `tsc -p apps/draw/tsconfig.json --noEmit --singleThreaded --rootDir .`. It reports errors, all in files I didn't touch: missing `.css` side-effect declarations and missing `ImportMeta.env`, both from vite client types this standalone program lacks. None are in a changed file.
- eslint on the 14 changed TS/TSX files: pass (exit 0)
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1676 changeset(s).")
- Tree clean; `.skulk/` untouched.