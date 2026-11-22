followScheme listener never released across a frame-config reload (A): fixed 99a6209784. It now watches the OS only while it follows a root, and `forge.frame.tsx` releases it on `import.meta.hot.dispose`.

csf.mjs waits on a different host than the one it checks (A): fixed f66f15b1f7. The check now waits for `frame` itself to lose `data-pending`. There's no committed test, because this is a top-level Playwright script. I reproduced it with a throwaway Chromium probe: the old wait returned in 16 ms while the checked host was still pending, and the new one held until it painted (489 ms).

Focus-ring sweep skips Tab stops its FOCUSABLE selector doesn't name (B): fixed c56f9ae3be. The before snapshot now covers every element in the host, and a stop with no snapshot is judged by pixels.

Focus-ring sweep stops at the first Tab stop outside the host (B): fixed b52dc438e8. A stop in a portal is skipped and the sweep carries on. It ends at the body, at the start button, at a repeated stop, or at `max`.

`settled` waits forever on a paused finite animation (B): fixed 1e7898de7f. `finishing` waits only on running, finite animations on the document timeline. The same filter now applies to the ring's fade-in wait in `unringed`.

Prep commit 4dc6f03f71 (no behavior change): moves the sweep into `apps/forge/a11y.ring.ts` with a jsdom test, `a11y.ring.test.ts`, so these fixes could be tested outside a browser.

No changesets: `apps/forge` is not a published package.

Checks:
- `npx vitest run --maxWorkers=1 apps/forge/mode.test.tsx`: pass (8 passed)
- `npx vitest run --maxWorkers=1 apps/forge/a11y.ring.test.ts`: pass (4 passed)
- `npx vitest run --maxWorkers=1 apps/forge/e2e.test.ts`: pass (3 passed)
- `apps/forge/a11y.*.browser.test.tsx` (they import the changed suite): unrun, browser only
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w <pkg>`: not applicable, no package changed; eslint on the touched files is clean

tally: 5 of 5 fixed, 0 extra fixed