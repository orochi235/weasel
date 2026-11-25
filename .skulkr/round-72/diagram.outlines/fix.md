[A] Outlines built with a bare `PathBuilder` lost precision far from the origin (Float32 coordinates, no origin): fixed 03c01cbac8

[A] `subprocess.boxForContent` returned a box narrower than the content asked for: fixed fe2ad3e9af

[A+B] `bpmn.ts` defined its own `KAPPA`: fixed 191818fd9a. It now imports the outlines' shared constant. A test can't catch this one, because the two values differ by less than Float32 can resolve, and no consumer sees a change, so it has no changeset. B also wanted the end event's ring built from `ellipsePath`. I didn't do that: the ring needs its inner ellipse wound the other way, and `ellipsePath` has no option for that.

[A] The component glyph stayed full size and was drawn outside a narrow box: duplicate of [B] "component glyph keeps its fixed size"

[A] The globe's ring had no `Z`, and neither did `bpmn.ts`'s ring: fixed 60d652af3f. The three ring helpers (in participants, network, and bpmn) are now one `ringD` in `fromD.ts`, which always closes the circle.

[B] A folder narrower than its tab depth folded its outline through itself: fixed 534ff5e12e

[B] `parseUnitD` accepted path data that only moves: fixed 7c0c2cc87e. A drawn mark given such data now warns too, since marks share this parser.

[B] KAPPA and the hand-built ellipse in `bpmn.ts`: duplicate of [A] "bpmn.ts redefines KAPPA"

[B] The component glyph kept its fixed size in a narrow box: fixed 97fe4fe412. The glyph now scales to fit a narrow or short box. The content box keeps its w/4 side clamp, so in a box that small the rows can still run under the glyph; that box has no room for both.

[B] `outlineFromD` checked `content`'s size but not its position: fixed 5eae7b8cd3. It now throws a `RangeError`, and the README says so.

Checks run:
- Each touched or affected test file, one at a time with `--maxWorkers=1`: farOrigin (10), bpmn (1), modeling (4), rings (2), storage (2), fromD (9), builtins (113), participants (7), roundRect (5) and marks (8). All pass. `marks.browser.test.tsx` is unrun, since browser tests can't run here.
- `npm run checks:gate`: all 33 passed.
- `npm run check:changesets`: pass, exit 0.
- `npm run lint -w @weasel-js/diagram`: can't run, because the package has no `lint` script. Eslint on the changed files passed, exit 0, and the gate's root `npm run lint` passed.
- Tree: clean.

tally: 8 of 10 fixed, 0 extra fixed