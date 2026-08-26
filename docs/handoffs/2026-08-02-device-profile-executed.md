# Handoff — DeviceProfile + long-press, executed

**Date:** 2026-08-02
**Branch:** `device-profile-spec` (rebased onto `main` @ `70205932`)
**Spec:** `docs/superpowers/specs/2026-07-28-device-profile-design.md`
**Plan:** `2026-07-28-device-profile` (plan, deleted at merge)

---

## Status

**Done.** Tasks 1–3 were already committed when this picked up; Tasks 4–12 all
landed, plus a changeset and a lockfile resync. 15 commits ahead of `main`,
nothing pushed, nothing merged.

Gates, all observed: `npm run typecheck` clean, `npm run test` 581 files /
5769 tests passing, `npm run build` succeeds across all three tiers. The kit
project alone went 386 files / 3959 tests at baseline → 388 / 3971 after the
sizing work → 652 / 6027 across every project after long-press.

## Where the plan was wrong, and what was done instead

Four places. None changed the design; all are worth knowing if the plan gets
read again as if it were current.

1. **Stale import paths.** The plan predates commit `14d92630`, which made
   `core/device/types.ts` type-only and moved `DEFAULT_DEVICE_PROFILE`,
   `COARSE_TARGET_SCALE` and `resolveDeviceProfile` into `profile.ts`. Every
   plan snippet importing those from `types` was repointed at `profile`.

2. **Task 6's test could not go red as written.** It asserted
   `DEFAULT_HANDLE_SIZE === 8` and `=== HANDLE_BASE_PX`, which both already
   held — the repoint is a pure refactor. The behavior that *can* fail is the
   scaling, so the test was rewritten to drive
   `mergeLayersWithDefaults(undefined, targetScale)` (red: 8, expected 14) and
   to read paint size and hit radius off the *same* emitted affordance region
   rather than asserting `aff.id`. That last case is the one this task exists
   for; asserting an id proves nothing about the two numbers agreeing.

3. **Two exhaustiveness sites the plan did not list**, both caught by `tsc`
   the moment `longPress` joined `GestureSpec['kind']` /`GestureName`:
   `packages/gestures/src/grammar/describeRoute.ts`'s switch (now describes it
   as "presses and holds"), and `apps/draw/src/dev/registryProbe.tsx`, which
   carries its **own copy** of `SPEC_KIND_TO_GESTURE` alongside the kit's. The
   duplicate map in draw is a small trap for the next gesture kind — worth
   collapsing onto the kit's export at some point.

4. **Task 9's harness was heavier than it needed to be.** The plan built tools
   with `bindings` and a `Tool` cast; actions registered with a
   `defaultBinding` reach ambient scope directly, so the test registers two
   marker actions and passes `toolsById: new Map()`. Same coverage, no casts.

## What was deliberately not done

- `HANDLE_HIT_RADIUS` / `ANCHOR_HIT_RADIUS` stay internal (per the plan).
- Three follow-ups are filed in `docs/TODO.md` rather than fixed: two-finger
  pan (pinch zooms but never translates), world-unit hit radii being correct
  only at scale 1, and long-press having no press-is-registering feedback.
- The lockfile resync (`403e6c51`) is unrelated to this work — a plain
  `npm install` on `main` produces it, because the lock still carried 0.7.0
  workspace versions and a `node >=20` floor after the release commits. It is
  a separate commit so it can be dropped or cherry-picked alone.

## Verification checklist from the plan

Every item observed, not assumed:

| Item | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run test` | 5769 passed, 4 skipped |
| `npm run build` | all three tiers |
| `DEFAULT_HANDLE_SIZE === 8`, `DEFAULT_ROTATION_HANDLE_DISTANCE === 24` | pinned by `deviceSizing.test.tsx` |
| long-press does not fire for `pointerType: 'mouse'` | pinned by `longPress.integration.test.tsx` |
| long-press does not fire when a second finger lands | same file |
| a `contextMenu`-only binding is reachable by touch | same file |
| no new ambient `devicePixelRatio` read on the paint path | `Canvas.dpr.test.tsx` + `renderSceneToPixels.test.ts` pass |
| device surface reaches the built `.d.ts` | grepped `packages/core/dist/index.d.ts` |
