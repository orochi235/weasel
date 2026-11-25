Disclosure (A+B) — `Disclosure` ignored `<Disabled>` scopes and took no `disabledReason`: fixed 20b685b49c. I made a call here and wrote it in `docs/unruled.md`: a `<ReadOnly>` scope does not stop it, because folding a section changes no value.

EasingPicker (A+B) — "Convert to bezier" turned 21 of the 31 named curves into CSS `ease`: fixed f2123cec49. Quart, quint, expo, circ, and back now convert to their own standard control points. Elastic and bounce get no Convert button, since no single cubic draws them.

FillStrokeSwatch (A+B) — its chips ignored `<Disabled>`/`<ReadOnly>` scopes, so shift-click still toggled a paint to none, and it took no hold props: fixed 5726f413f5. My call, also in `docs/unruled.md`: read-only chips still pick the target slot but don't open the editor; disabled chips pick nothing.

EffectCard (A+B) — its name field and Duplicate/Remove buttons stayed focusable "to tell" a reason but never told it: fixed 0d932e835a.

EffectList CSS (B; A noted it too) — held Duplicate/Remove buttons kept the pointer cursor and hover color: fixed 0d932e835a, in the same commit as the reason fix.

EasingPicker read-only (B) — the Convert button had no read-only mark: fixed 31695c3281. This adds a `changes` option to `useNativeHold`, which marks a button that makes a change as disabled while read-only.

FitScope spent mark (A) — the scope kept `data-fit-spent` after its labels changed to ones that fit: fixed e7ad0770f5. The label-change path and the font-load path now reset the room through one shared helper (`forgetRoom`).

`--fit-natural` under a scaled ancestor (A) — the width was measured in transformed px on one branch and layout px on the other: fixed 280c4c568a.

Font loads (A+B) — the scale stage listened to the global `document.fonts` instead of the scope's own document: fixed 3e003920a3.

FloatingPanel (A+B) — an uncontrolled panel ignored a changed `anchor` before its first drag: fixed af1efad42e.

useHoldReason (A) — the tooltip stayed bound to a replaced element while the reason was unchanged: fixed 0fdac7e230.

No extra defects found. The sweep for the same mistakes elsewhere in the area found none.

Checks:
- Every touched test file, one at a time with `--maxWorkers=1`: pass. That covers HoldReason (1), Disclosure (15), EasingPicker (12), EasingPicker.label plus EffectList (20 together), EffectList.hold (4), FillStrokeSwatch (18), FitLabel (6), fitRoom (1), fitScale (9), and FloatingPanel (14). Each new test failed before its fix.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed on changeset titles (too long, and two at the wrong level) and on a hook-dependency lint error in `HoldReason.tsx`; both were fixed and folded into their commits.
- `npm run typecheck:packages -- ui`: "1/1 ui ok".
- `npm run lint -w @weasel-js/ui`: unrun, because the package has no `lint` script. Instead, eslint on every changed file: pass. The gate's `npm run lint` also passed.
- Browser tests: none touched.
- Tree clean.

tally: 17 of 17 fixed, 0 extra fixed