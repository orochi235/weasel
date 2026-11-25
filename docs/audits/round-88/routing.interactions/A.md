# Audit round 88 — routing.interactions (blind reviewer)

## useHandleDrag's scroll compensation misses containing blocks made by `will-change`, `backdrop-filter` and `container-type`
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:59 (holdsFixed, used by scrollersOf)
- scenario: a `position: fixed` (or absolute-under-fixed) handle sits inside a scrolling panel styled `will-change: transform` (or `backdrop-filter: blur(..)`, or `container-type: inline-size`). Each of those makes the panel the fixed box's containing block, so scrolling the panel moves the handle. `holdsFixed` checks only `transform`, `filter`, `perspective` and `contain`, so `scrollersOf` walks past the panel, finds no holder, and returns no scrollers. A wheel scroll of the panel mid-drag then shifts the handle on screen while `localOf` keeps the press-time box, so every reported point is off by the scroll distance. It should treat those properties as making a containing block too.
- evidence: read
- severity: low

## startThresholdDrag reports a release past the threshold as a click when no move crossed it
- where: packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:79 (onEnd)
- scenario: a press at (0,0) followed by a `pointerup` at (40,0) with no `pointermove` that crossed the threshold first (a synthesized or replayed sequence, or a pointer whose last move came below the threshold and whose release is reported farther along). `maybeActivate` runs only in `onMove`, so `activated` is still false and `opts.onClick(ev)` fires for a 40 px drag. `useHandleDrag` answers the same question at release (`moved || away(ev)`), so the two primitives disagree about one input. It should test the release point against the threshold before choosing `onClick`.
- evidence: read
- severity: low

## Alt-letter and Alt+Shift chords say "on Windows and Linux" but are marked reserved on every platform
- where: packages/routing/src/interactions/browserReservedKeys.ts:38-39 (BROWSER_RESERVED_CHORDS)
- scenario: `chord('fevsbthd', { alt: true }, 'menu accelerators and address bar on Windows and Linux')` and the `ita` Alt+Shift entry carry no `platform: 'other'`, unlike every other entry whose `use` names a platform. On a Mac, `browserReservedChord({ kind: 'key', key: 'f', mods: { alt: true } }, true)` returns this entry and calls Option+F reserved, which no Mac browser takes. The `use` text and the `platform` field give two answers for one chord. The entry should carry `platform: 'other'`, or the text should say it holds everywhere.
- evidence: read
- severity: low

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
packages/routing/src/interactions/elementAt.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/index.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/index.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/index.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 3 findings, files read: 14 -->
