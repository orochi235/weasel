Jumping to an inherited pin now goes to the page that lists it (A): fixed 3a17d621dd

Inspector cascade: a custom property set by an overridden or less specific rule was still followed (B): fixed 1f8bf20099

Inspector splitting a value at a `;` inside a string or url (B): fixed 2d88dcab7d. It also no longer counts a `var()` written inside a string as a read.

Semantic drawer took its Ramp options from the last derived draft but its rule and axes from the current one (B): fixed b52ae5b4db

No extra defects. No changesets: `apps/theme-editor` is an app, not a published package, and earlier commits to it carried none.

Checks:
- `npx vitest run --maxWorkers=1 apps/theme-editor/src/theme/model.test.ts`: pass (17 passed)
- `npx vitest run --maxWorkers=1 apps/theme-editor/src/theme/inspect.test.ts`: pass (6 passed)
- `npx vitest run --maxWorkers=1 apps/theme-editor/src/layers/SemanticsLayer.test.tsx`: pass (13 passed)
- `npx vitest run --maxWorkers=1 apps/theme-editor/src/ThemeWorkbench.test.tsx`: pass (17 passed)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w <pkg>`: not applicable, since `apps/theme-editor` has no `package.json`. eslint on every changed file: pass. The root `npm run lint` inside the gate: pass.
- Tree is clean.

tally: 4 of 4 fixed, 0 extra fixed