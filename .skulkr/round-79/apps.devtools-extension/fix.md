Probe stops at a `kitVersion` that throws when read (A): fixed e1afc59d9e

Popup title shows only the first frame's version (B): fixed 14e58a11ae

Popup writes the badge outside the background's per-tab latest gate (B): fixed edd92f0c3a. The popup now asks the background, which probes through its own gate and sends the answer back. If it gets no answer, the popup probes by itself and leaves the badge alone.

Replaced panel's errors for in-flight requests reject the new panel's requests (A): fixed be57fc1d54

Replaced panel reconnects and replaces its replacement forever (A): fixed d91efaf81b. The relay now tells the old panel it was replaced and stops hearing it, and the transport goes for good on that word.

Transport reconnects immediately and forever when the background drops its port at once (B): fixed d91efaf81b. The first drop of a port that carried nothing is called back at once. Each drop after that waits twice as long, starting at 250 ms, up to 30 s. A port that carried anything resets the wait.

Requests about a removed root stay in the transport's and the relay's request tables (A): fixed de9c46bb33

No changesets: the extension is not a published package, and none of its earlier fixes carried one. Nothing went to `docs/unruled.md`.

The relay leaves an old panel's port open after telling it it was replaced, and only stops reading from it. I reasoned this is safer than posting and then disconnecting, because it doesn't rely on the post arriving before the disconnect. I did not test that against a real browser.

Checks:
- `npx vitest run --maxWorkers=1` on each file, all pass:
  - `tabWeasel.test.ts` (15/15)
  - `popup/status.test.ts` (4/4)
  - `background/badge.test.ts` (6/6)
  - `background/relay.test.ts` (25/25)
  - `panel/portTransport.test.ts` (12/12)
  - `hookPresence.test.ts` (10/10)
  - `panel/PanelHost.test.tsx` (2/2)
  - `bridge.e2e.test.tsx` (1/1)
- `npm run checks:gate`: the first run failed on one `typecheck` error in `portTransport.ts`. I fixed it and amended the fix into de9c46bb33. The rerun printed "checks:gate: all 33 passed". That run includes the root `npm run lint` and `check:changesets`.
- `npm run check:size`: pass.
- `npm run lint -w <pkg>`: not applicable, since `apps/devtools-extension` is not a workspace package. The gate's root `npm run lint` covers it, and it passed.

tally: 7 of 7 fixed, 0 extra fixed