---
'@weasel-js/hud': minor
---

The loupe is round by default: a bare circle moved by its interior and resized from its rim, with no titlebar or close box.

Pass `shape: 'rect'` to `createLoupe` (or `useLoupe`'s settings) for the titled window it was before. Prefer the round lens unless the lens needs a title or must be closed from its own chrome. A round lens with no `bounds` starts 200 px across.

<!-- entry: rank=10 new api behavior visual -->
