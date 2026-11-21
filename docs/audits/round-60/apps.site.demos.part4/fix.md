Indices slider re-sorts its thumbs mid-drag, so the held thumb's styling and focus jump to the neighbor (A) — fixed ddf3a6823f. The slider now uses `constraint="ordered"`, and the sort moved from `onInput` to `onChange`, so a newly added thumb still ends up in order.

Tightening the bounds mode can invert the ordered L range (B) — fixed 1ede8ad8fb.

A failed PDF write still offers the previous PDF for download (A+B) — fixed 77f0638d7d.

No extra defects. The sweep of this area for the same two mistakes (sorting inside `onInput`, and a `catch` that leaves a stale result showing) found nothing else. There are no changesets: `apps/site` is not a published package, and earlier demo fixes such as c4544f2bb5 shipped without one.

Checks:
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/PdfDemo.test.tsx`: pass (1 passed). It failed before the fix.
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/PerceptualColorSlidersDemo.test.tsx`: pass (2 passed). Both tests failed before their fixes.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed", which includes the root `npm run lint`).
- `npm run lint -w <pkg>`: not run. `apps/site` is not a workspace package, so there is none to run; the root lint inside the gate covers it, and eslint on the four changed files passed.

tally: 3 of 3 fixed, 0 extra fixed