Last capture's object URL survives unmount, and a failed capture discards the good one (A+B): fixed e885359753

Effects map never pruned when cards are removed (A+B): fixed 8e2daf55b4

Weasel-mark load has no error path, so Ripple stays disabled on every later mount (A+B): fixed 714b4d06d9

Pinned Columns and Gap make cells negative, so bars run past the grid (A+B): fixed f29d6c97cc

AudioDemo voice readout shows the total across buses against a per-bus cap (B): fixed f2a31b8f46 (its new test is in `AudioDemo.browser.test.tsx`, which is unrun here)

No extra defects found. No changesets: `apps/site` is not a published package (it has no `package.json`), so a consumer sees none of these changes.

Checks:
- `npm run checks:gate`: all 33 passed
- `animationCardEffects.test.tsx`: 1 passed (1)
- `animationDemo.integration.test.tsx`: 7 passed (7)
- `CustomShaderDemo.textureError.test.tsx`: 1 passed (1)
- `CustomShaderDemo.texture.test.tsx`: 1 passed (1)
- `CustomShaderDemo.test.tsx`: 5 passed (5)
- `AnnotationCaptureDemo.test.tsx`: 2 passed (2)
- `AutoControlsDemo.test.ts`: 2 passed (2)
- `AudioDemo.browser.test.tsx`: unrun (browser)
- `npm run lint -w <pkg>`: not applicable, since no workspace package changed; the root `npm run lint` passed inside the gate

tally: 5 of 5 fixed, 0 extra fixed