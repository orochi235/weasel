[r42-1] Nested scroll container hit where its clipping parent hides it (carried): fixed f6aa15ff8b. `scrollablesAt` no longer looks inside a container whose own clip leaves the point out.

[r42-2] `segmentUnder` tests the plane path while the affordance tests the camera one (carried): fixed e47a4a2729. `inPlane` already carried `run` and `start` into the plane but not `enabled`, so the gates in bend, convert, insert-anchor and tug tested the camera's point against the plane's path. `enabled` is now carried too.

[r42-3] A new drag-pan doesn't stop the previous coast (carried): fixed f702b1ee2a. `start` now calls `view.stopDecay`.

[r42-4] `buildToolActivateBindings` repeats an id on a third spec for one tool and key (carried): fixed 56a1e04ffc. Ids after the second get `.2`, `.3`; the first two keep their old ids.

[r42-5] Fit Content ignores `axis` (carried): fixed aedce457b7. This was a behavior nobody had ruled on, so I made the call and recorded it in `docs/unruled.md`: the fit holds to the axis, and content with no extent on that axis is centered at the current scale.

[r42-6] `container.scroll` drops the z scroll offset (carried): fixed 6f07dffc8d.

[r42-7] `container.scroll` moves a scaled container by world units (carried): fixed 1df3f92076. The world delta is converted to the container's own units, measured through the composition's own `scroll`.

Checks:
- `npm run checks:gate`: pass (all 32 passed)
- `npm run lint -w packages/core` and `-w packages/editing`: neither package has a `lint` script ("Missing script: lint"), so I ran eslint on every changed file instead: pass
- `npm run check:changesets`: pass
- `npx vitest run --maxWorkers=1` on each touched test file: all pass
  - `viewportDragPan.test.ts`: 32/32
  - `toolActivate.test.ts`: 13/13
  - `viewportZoom.fit.test.ts`: 7/7
  - `containerScroll.test.ts`: 13/13
  - `editing/.../planeInput.test.ts`: 25/25
- Also ran unchanged: `bendSegment.test.ts` 5/5, `insertPathAnchor.test.ts` 2/2, `convertSegments.test.ts` 4/4: pass

The tree is clean.

tally: 7 of 7 fixed, 0 extra fixed