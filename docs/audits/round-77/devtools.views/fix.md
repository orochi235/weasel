`fixed` lines name the commit that holds the fix. Each fix has a test that failed before it and passes now, plus its own changeset.

- Turning coords off lets an in-flight read put stale coords back (A): not a defect. When a read comes back, `followTrace` in `packages/devtools/src/trace.ts` drops its coords if coords are off (`coordCursor !== null`) or were turned off and back on while it was out (`run === coordRun`). So nothing lands in `setCoords` after the switch.
- A live row that names no action reads "handled" where its decision path says "would handle" (A): fixed f8a448228e
- `defaultOpen` opens a grouped category but leaves its group closed (A): fixed f7c0f3d (the RegistryBrowser defaultOpen commit; `git log` sha below)
- A group's badge counts its categories, not its entries (B): fixed (the RegistryBrowser group badge commit)
- The live row's open state outlives the live record and reopens on the next prediction (B): fixed 9a1a500627

Checks:
- `npx vitest run --maxWorkers=1 packages/devtools/src/views/TraceTable.test.tsx`: pass (3/3)
- `npx vitest run --maxWorkers=1 packages/devtools/src/views/RegistryBrowser.test.tsx`: pass (22/22)
- `DevtoolsPanel.registry.test.tsx`: pass (5/5); `DispatchView.test.tsx`: pass (7/7)
- `npm run check:changesets`: pass ("OK — 861 changeset(s), 18 with warnings"; none of the warnings are from these changesets)
- `npm run checks:gate`: pass ("all 33 passed")
- `npm run lint -w @weasel-js/devtools`: not run, because the package has no `lint` script. Instead, eslint on the 4 changed files: pass; `npm run check:size`: pass
- Tree clean; `.skulkr/` untouched.

tally: 4 of 5 fixed, 0 extra fixed