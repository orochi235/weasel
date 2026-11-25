- disposed frame pool still hands out warm frames (A): fixed 0dbd372d70
- Get Info on an index-page or missing-route trial leaves `infoOpen` stuck true (A): fixed 3439fb314f
- a11y panel's in-flight count and pointed nodes carry over between trials (A): fixed e39dac845d
- changing one global writes every other global's fallback into storage (A): fixed d58e547935
- checkShellConfig rejects 'lab' but not 'app' on a declaration that `follows` (A): fixed c15a5deda7
- document trial audit runs axe on an empty out-of-view host, or hangs (A): fixed 1c2018b0be
- in-document a11y audit is empty out of view and hangs if never rendered (B): duplicate of A's document-trial audit finding (1c2018b0be)
- Get Info on an index page does nothing, then opens on its own (B): duplicate of A's Get Info finding (3439fb314f)
- a global's `shows` is asked with `App` unresolved while `opposite` gets it resolved (B): fixed 1f8e058f51
- frame pool retries a frame URL that never says hello every 30 s, forever (B): fixed d5fa684af3

No extra defects found.

Notes:
- The frame-pool retry cap was my own call: the pool stops after 3 hello misses in a row (`MAX_HELLO_MISSES`). It's a fix rather than a new policy, so I didn't record it in `docs/unruled.md`.
- Get Info now opens on index pages, and it closes itself on a trial with no entry. There's one changeset for each.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - framePool.test.ts: pass (8)
  - info/StoryInfo.test.tsx: pass (7)
  - trialFrames.test.tsx: pass (12)
  - globalsMenu.test.tsx: pass (7)
  - GlobalsToolbar.test.tsx: pass (4)
  - checkShellConfig.test.ts: pass (7)
  - TrialHost.test.tsx: pass (10)
  - globals.test.ts: pass (17)
  - Workshop.test.tsx: pass (16)
  - followLab.test.tsx: pass (3)
  - shell.pbt.test.ts: pass (8)
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run check:changesets`: "OK — 2239 changeset(s)."
- `npm run lint -w @weasel-js/forge`: not run. `@weasel-js/forge` has no `lint` script (npm error: missing script). The gate's root `npm run lint` passed.
- No browser tests touched.
- Tree clean apart from `.skulk/`.

tally: 10 of 10 fixed, 0 extra fixed