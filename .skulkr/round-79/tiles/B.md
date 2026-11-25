## A tile that arrives already stale is drawn but reported neither in `stale` nor in `pending`, so the frame loop can stop with outdated content on screen
- where: packages/tiles/src/pyramid.ts:211 (`drawsFor`'s `mark`), with packages/tiles/src/cache.ts:86 (`put` sets `drawnAt: frame`) and packages/tiles/src/pyramid.ts:153 (`arrive`)
- scenario: a stale tile T is on screen and its rebake goes out async (`bake` answers null, so `defer` records it). An edit then meets T, and `dirty` sets the in-flight record's `dirtiedAt`. On a later frame `bake` returns T's payload. `arrive` calls `cache.put`, which sets `drawnAt = frame`, then marks the new tile `stale = true`. In `drawsFor`, `mark(t)` only pushes onto `stale` when `t.drawnAt !== frame`, which is already false, so T is left out of `frame.stale`. `pending` was computed from this frame's bake order, where T counted as baked, so it doesn't include T either. Because the rebake replaced an existing tile, `bornAt` carries over, alpha is 1 and `fading` is false. The frame can therefore answer `pending: 0, fading: false, stale: []` while a tile missing the edit sits on screen. A caller that asks for frames only while `pending` or `fading` is set stops, and the edit never shows until something else asks for a frame. The same happens for a new tile when `fadeMs` is 0. It should come out as `stale` (or count toward `pending`) on the frame it arrives in.
- evidence: read
- severity: medium

## Files read
packages/tiles/src/cache.ts
packages/tiles/src/index.ts
packages/tiles/src/pyramid.ts
packages/tiles/src/scheme.ts
packages/tiles/src/stream.ts

<!-- done: 1 findings, files read: 5 -->
