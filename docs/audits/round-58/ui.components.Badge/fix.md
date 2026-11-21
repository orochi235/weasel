All ten distinct findings are fixed, one commit each; the gate passes and no browser test was run.

- **"as=span" plus `onClick` drops the click on an unsplit badge** (A+B): fixed 83c0749f52
- **Undefined base and effect params override their defaults** (A): fixed fa38787b37
- **`padding` replaces the shape's insets, so `ownPadding` miscounts** (A+B): fixed dafc91f7de. I made the strict call that padding adds to the insets, and recorded it in `docs/unruled.md`.
- **Fitted insets go stale when only the padding changes** (A+B): fixed 23a470f167
- **Unsplit removable badge draws the focus ring when its × is focused** (A+B): fixed 4e2d1ab937
- **Negative `crawl` puts the phase outside 0..1** (A): fixed 4606dff86c
- **Unknown `shape`, `base` or effect keys resolve through the prototype chain** (A+B): fixed 489d11f0fb
- **`labelProps` `className` and `aria-label` overwritten on the label** (B): fixed 4562321354
- **The mask region clips a body pushed past 10% of the box** (B): fixed eec1cf1193
- **The `BadgeShape` doc says `square` is drawn in CSS** (B): fixed 5b3105e1dd

No extra defects. The fixed `.badge[data-shape='plain']` padding rule went into the `padding` fix (dafc91f7de).

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `Badge.props.test.tsx`: pass (10)
  - `Badge.test.tsx`: pass (40)
  - `composeSpec.test.ts`: pass (2)
  - `composeOutline.test.ts`: pass (8)
  - `useCrawlPhase.test.ts`: pass (2)
  - `useInsets.test.tsx`: pass (1)
  - `fittedOutline.test.ts`: pass (30)
- `npm run checks:gate`: "checks:gate: all 32 passed", after fixing `check:changesets` (three titles over 140 characters) and one root-lint `exhaustive-deps` error.
- `npm run lint -w @weasel-js/ui`: fail, `Missing script: "lint"`. The package has no lint script; the root `npm run lint`, which lints `packages/`, passed inside the gate.
- Unrun: none of the `*.browser.test.*` files were run. The padding change most needs `Badge.browser.test.tsx`, because jsdom cannot compute padding through CSS variables, so its new test only checks the stylesheet's text.

The tree is clean.

tally: 15 of 15 fixed, 0 extra fixed